const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function createAdaptiveFixtures(page, directory, webm) {
  // Use the existing locally encoded VP8 recording, split at its first Cluster.
  const cluster = webm.indexOf(Buffer.from([0x1f, 0x43, 0xb6, 0x75]));
  if (cluster < 0) throw new Error('The local WebM recording has no media cluster.');
  await fs.writeFile(path.join(directory, 'adaptive-init.webm'), webm.subarray(0, cluster));
  await fs.writeFile(path.join(directory, 'adaptive-segment.webm'), webm.subarray(cluster));
  await fs.writeFile(path.join(directory, 'adaptive.mpd'), `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT6S" minBufferTime="PT1S">
  <Period duration="PT6S"><AdaptationSet contentType="video" mimeType="video/webm" segmentAlignment="true">
    <Representation id="fixture-vp8" bandwidth="150000" codecs="vp8" width="320" height="180">
      <SegmentList timescale="1000" duration="6000"><Initialization sourceURL="adaptive-init.webm"/><SegmentURL media="adaptive-segment.webm"/></SegmentList>
    </Representation>
  </AdaptationSet></Period>
</MPD>`);

  // Record fragmented MP4 locally; neither test downloads a public sample film.
  const recording = await page.evaluate(async () => {
    const mimeType = ['video/mp4;codecs=avc1.42001e', 'video/mp4;codecs=avc1.42E01E'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('The adaptive HLS fixture requires an H.264 MP4 MediaRecorder encoder in this Chromium installation.');
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 150000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
    let frame = 0;
    const draw = () => { context.fillStyle = frame++ % 2 ? '#233952' : '#477ba8'; context.fillRect(0, 0, 320, 180); };
    draw(); recorder.start(1000);
    const timer = setInterval(draw, 50);
    await new Promise(resolve => setTimeout(resolve, 6000));
    recorder.stop(); await stopped;
    clearInterval(timer); stream.getTracks().forEach(track => track.stop());
    return { bytes: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())), mimeType };
  });
  const mp4 = Buffer.from(recording.bytes);
  let offset = 0;
  const fragments = [];
  while (offset + 8 <= mp4.length) {
    let size = mp4.readUInt32BE(offset);
    const type = mp4.toString('ascii', offset + 4, offset + 8);
    if (size === 1) size = Number(mp4.readBigUInt64BE(offset + 8));
    if (size === 0) size = mp4.length - offset;
    if (size < 8 || offset + size > mp4.length) throw new Error('Invalid MP4 fixture box size.');
    if (type === 'moof') fragments.push(offset);
    offset += size;
  }
  if (!fragments.length) throw new Error('The local MP4 recording is not fragmented.');
  await fs.writeFile(path.join(directory, 'adaptive-init.mp4'), mp4.subarray(0, fragments[0]));
  const codec = recording.mimeType.split('codecs=')[1];
  const entries = [];
  for (let i = 0; i < fragments.length; i++) {
    const filename = `adaptive-${i}.m4s`;
    await fs.writeFile(path.join(directory, filename), mp4.subarray(fragments[i], fragments[i + 1] || mp4.length));
    entries.push(`#EXTINF:${(6 / fragments.length).toFixed(6)},\n${filename}`);
  }
  await fs.writeFile(path.join(directory, 'adaptive-media.m3u8'), `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MAP:URI="adaptive-init.mp4"\n${entries.join('\n')}\n#EXT-X-ENDLIST\n`);
  await fs.writeFile(path.join(directory, 'adaptive.m3u8'), `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=150000,RESOLUTION=320x180,CODECS="${codec}"\nadaptive-media.m3u8\n`);
};
