import crypto from 'node:crypto';

if (process.env.NODE_ENV === 'production' && (!process.env.PLAYBACK_SIGNING_KEY || process.env.PLAYBACK_SIGNING_KEY.length < 32)) throw new Error('Production requires PLAYBACK_SIGNING_KEY with at least 32 characters');
export const PLAYBACK_SIGNING_KEY = process.env.PLAYBACK_SIGNING_KEY || crypto.randomBytes(32).toString('hex');
export const PLAYBACK_TOKEN_EXPIRE_SECONDS = 3600;

export const QUALITY_LADDER = [
  { quality: 360, label: '360p Data Saver', bandwidth: 800000, resolution: '640x360', codecs: 'avc1.4d401e,mp4a.40.2' },
  { quality: 480, label: '480p SD', bandwidth: 1400000, resolution: '854x480', codecs: 'avc1.4d401f,mp4a.40.2' },
  { quality: 720, label: '720p HD', bandwidth: 2800000, resolution: '1280x720', codecs: 'avc1.64001f,mp4a.40.2' },
  { quality: 1080, label: '1080p Full HD', bandwidth: 5000000, resolution: '1920x1080', codecs: 'avc1.640028,mp4a.40.2' },
];

export const SUBTITLE_LANGS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  de: 'German',
};

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function createPlaybackToken(payload: Record<string, any>): string {
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const body = JSON.stringify(payload);

  const encHeader = base64UrlEncode(header);
  const encBody = base64UrlEncode(body);
  const signingInput = `${encHeader}.${encBody}`;

  const signature = crypto
    .createHmac('sha256', PLAYBACK_SIGNING_KEY)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}

export function verifyPlaybackToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encHeader, encBody, signature] = parts;
    const signingInput = `${encHeader}.${encBody}`;

    const expectedSig = crypto
      .createHmac('sha256', PLAYBACK_SIGNING_KEY)
      .update(signingInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const signatureBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expectedSig);
    if (signatureBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(signatureBytes, expectedBytes)) return null;
    const header = JSON.parse(base64UrlDecode(encHeader));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const payload = JSON.parse(base64UrlDecode(encBody));
    if (!Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function generateMasterHlsManifest(
  contentType: string,
  contentId: string,
  baseUrl: string,
  token: string,
  episodeId?: string
): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:4',
    '#EXT-X-INDEPENDENT-SEGMENTS',
  ];

  // Subtitle definitions
  for (const [code, label] of Object.entries(SUBTITLE_LANGS)) {
    const isDefault = code === 'en' ? 'YES' : 'NO';
    const subUri = `${baseUrl}/playback/subtitles/${code}.vtt?token=${token}`;
    lines.push(
      `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${label}",DEFAULT=${isDefault},AUTOSELECT=YES,LANGUAGE="${code}",URI="${subUri}"`
    );
  }

  // Variant quality rungs
  const epParam = episodeId ? `&episode_id=${episodeId}` : '';
  for (const rung of QUALITY_LADDER) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rung.bandwidth},RESOLUTION=${rung.resolution},SUBTITLES="subs",CODECS="${rung.codecs}"`
    );
    lines.push(
      `${baseUrl}/playback/${contentType}/${contentId}/quality/${rung.quality}/index.m3u8?token=${token}${epParam}`
    );
  }

  return lines.join('\n') + '\n';
}

export function generateVariantHlsPlaylist(
  contentType: string,
  contentId: string,
  quality: number,
  durationSeconds: number = 5400,
  segmentDuration: number = 6,
  token: string = ''
): string {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${segmentDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];

  const totalSegments = Math.max(1, Math.floor(durationSeconds / segmentDuration));
  const displaySegments = Math.min(totalSegments, 60);

  for (let i = 0; i < displaySegments; i++) {
    lines.push(`#EXTINF:${segmentDuration.toFixed(3)},`);
    const pad = i.toString().padStart(4, '0');
    lines.push(`segment_${quality}p_${pad}.ts?token=${token}`);
  }

  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n') + '\n';
}

export function generateDashManifest(
  contentType: string,
  contentId: string,
  durationSeconds: number = 5400,
  baseUrl: string = '',
  token: string = ''
): string {
  const durIso = `PT${durationSeconds}S`;

  const representations = QUALITY_LADDER.map(r => {
    const [w, h] = r.resolution.split('x');
    return `      <Representation id="${r.quality}p" bandwidth="${r.bandwidth}" width="${w}" height="${h}" codecs="avc1.640028">
        <BaseURL>${baseUrl}/playback/${contentType}/${contentId}/quality/${r.quality}/</BaseURL>
        <SegmentTemplate media="chunk-$Number$.m4s?token=${token}" initialization="init.mp4?token=${token}" duration="6000" timescale="1000"/>
      </Representation>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="static"
     mediaPresentationDuration="${durIso}"
     minBufferTime="PT2S">
  <Period id="1" start="PT0S">
    <AdaptationSet mimeType="video/mp4" contentType="video" subsegmentAlignment="true">
${representations}
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" subsegmentAlignment="true" lang="en">
      <Representation id="audio-en" bandwidth="128000" codecs="mp4a.40.2" audioSamplingRate="48000">
        <BaseURL>${baseUrl}/playback/${contentType}/${contentId}/audio/</BaseURL>
        <SegmentTemplate media="audio-$Number$.m4s?token=${token}" initialization="audio-init.mp4?token=${token}" duration="6000" timescale="1000"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
`;
}

export function generateWebVTTSubtitles(lang: string, title: string = 'Authorized Stream'): string {
  return `WEBVTT - Movie Platform Authorized Subtitles
Language: ${lang}
Title: ${title}

00:00:01.000 --> 00:00:04.500
[Movie Platform — Authorized & Ad-Free Playback]

00:00:05.000 --> 00:00:09.000
Verified license with authorized content providers.

00:00:10.000 --> 00:00:15.000
Enjoy high-definition streaming with zero advertisements.

00:00:16.000 --> 00:00:22.000
Adaptive bitrate streaming active: 1080p, 720p, 480p, 360p.
`;
}
