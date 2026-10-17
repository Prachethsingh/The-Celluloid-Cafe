import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { resolvePlayback, getNextPlayable } from '../services/playbackResolver';
import Artwork from './Artwork';
import { titleArtworkUrl } from '../services/artwork';
import { attachAdaptivePlayback, requiresAdaptiveEngine } from '../services/adaptivePlayback';

export default function VideoPlayerModal({ content, onClose, onProgressUpdated, onOpenProviders, onPlayNext }) {
  const [autoplay, setAutoplay] = useState(() => { try { return localStorage.getItem('mp_autoplay_next') !== 'false'; } catch { return true; } });
  const [nextStatus, setNextStatus] = useState('');
  const nextRequest = useRef(null);
  useEffect(() => () => nextRequest.current?.abort(), []);
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const lastSaved = useRef(0);
  const [resolution, setResolution] = useState({ status: 'loading', sources: [], diagnostics: [] });
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState(null);
  const [mediaState, setMediaState] = useState('connecting');
  const [attempt, setAttempt] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [tracks, setTracks] = useState([]);
  const [quality, setQuality] = useState('auto');
  const adaptive = useRef(null);
  const source = resolution.sources[selected];
  const episodeId = content.episode?.id;
  const title = episodeId ? `${content.title} — ${content.episode.title || 'Episode ' + (content.episode.episode_number || content.episode.episode || 1)}` : content.title;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setResolution({ status: 'unavailable', sources: [], diagnostics: ['Finding sources timed out. Retry or browse another provider.'] });
    }, 45000);
    resolvePlayback(content, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setResolution({ ...result, status: result.sources.length ? 'resolved' : 'unavailable' });
        setSelected(0);
      }
    }).catch(reason => {
      if (!controller.signal.aborted) setResolution({ status: 'unavailable', sources: [], diagnostics: [reason.message] });
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [content, attempt]);

  useEffect(() => {
    if (!source || error || !['connecting', 'buffering'].includes(mediaState)) return;
    const timeout = setTimeout(() => {
      videoRef.current?.pause();
      if (selected + 1 < resolution.sources.length) {
        setSelected(selected + 1); setMediaState('connecting'); setTracks([]); setQuality('auto');
        return;
      }
      setError('The media host did not respond in time. Retry or try another source.');
      setMediaState('failed');
    }, 20000);
    return () => clearTimeout(timeout);
  }, [source, attempt, mediaState, error, selected, resolution.sources.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video || !requiresAdaptiveEngine(video, source)) return;
    const controller = new AbortController();
    let failed = false;
    const fail = reason => {
      if (controller.signal.aborted || failed) return;
      failed = true;
      if (selected + 1 < resolution.sources.length) {
        setSelected(selected + 1); setError(null); setMediaState('connecting'); setTracks([]); setQuality('auto');
      } else { setError(reason.message); setMediaState('failed'); }
    };
    attachAdaptivePlayback(video, source, { signal: controller.signal, onTracks: setTracks, onError: fail }).then(engine => {
      if (!controller.signal.aborted) adaptive.current = engine;
    }).catch(fail);
    return () => { controller.abort(); adaptive.current = null; };
  }, [source, attempt, selected, resolution.sources.length]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);

  const saveProgress = () => {
    const video = videoRef.current;
    if (!video || video.currentTime < 1 || !Number.isFinite(video.duration)) return;
    const items = api.updateProgress(content.id, {
      title: content.title, type: content.type || 'movie', episode_id: episodeId || null,
      episode_title: episodeId ? title : null, progress_seconds: Math.floor(video.currentTime),
      duration_seconds: Math.floor(video.duration), poster_url: content.poster_url,
      backdrop_url: content.backdrop_url, source_provider: source?.provider,
      provider: content.provider, provider_link: content.provider_link, provider_page_link: content.provider_page_link,
      imdb_id: content.imdb_id, tmdb_id: content.tmdb_id, episode: content.episode,
      addon_id: content.addon_id, addon_media_id: content.addon_media_id,
    });
    onProgressUpdated?.(items);
  };
  const close = () => { nextRequest.current?.abort(); saveProgress(); onClose(); };
  const ended = async () => {
    setMediaState('ended'); saveProgress();
    if (!autoplay || content.type === 'series' || !onPlayNext || nextRequest.current) return;
    const controller = new AbortController(); nextRequest.current = controller;
    setNextStatus('Finding the next movie…');
    try {
      const next = await getNextPlayable(content, controller.signal, item => setNextStatus(`Checking providers for ${item.title}…`));
      if (!controller.signal.aborted) {
        if (next) onPlayNext(next);
        else setNextStatus('No more movies with available sources in this collection.');
      }
    } catch (reason) { if (!controller.signal.aborted) setNextStatus(reason.message); }
    finally { if (nextRequest.current === controller) nextRequest.current = null; }
  };
  const retry = () => {
    setTracks([]); setQuality('auto');
    setError(null); setMediaState('connecting'); setSelected(0);
    setResolution({ status: 'loading', sources: [], diagnostics: [] });
    setAttempt(value => value + 1);
  };
  const mediaError = () => {
    if (selected + 1 < resolution.sources.length) { selectSource(selected + 1); return; }
    const code = videoRef.current?.error?.code;
    const message = code === 2 ? 'A network interruption stopped this stream. Check your connection or try another source.' : code === 3 ? 'The browser could not decode this media. Try another source or format.' : 'This stream could not be played. The format may be unsupported, or the host may have denied access. Try another source.';
    setMediaState('failed'); setError(message);
  };
  const selectSource = index => { saveProgress(); setSelected(index); setError(null); setMediaState('connecting'); setTracks([]); setQuality('auto'); };
  const sourceLabel = item => `${item.provider || 'Configured source'}${item.quality ? ` · ${item.quality}` : ''} · ${String(item.format || 'video').toUpperCase()}`;

  return (
    <div className="player-modal-backdrop animate-fade-in">
      <div ref={dialogRef} className="player-container" role="dialog" aria-modal="true" aria-labelledby="playback-title" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), select:not(:disabled), summary, video[tabindex]')).filter(element => element.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div className="player-top-bar visible">
          <div className="player-title-col">
            <h2 id="playback-title" className="player-title">{title}</h2>
            <span className="player-session-badge" role="status">{source ? `${sourceLabel(source)} · ${error ? 'Playback failed' : mediaState === 'playing' ? 'Playing' : mediaState === 'paused' ? 'Paused' : mediaState === 'ended' ? 'Finished' : mediaState === 'buffering' ? 'Buffering' : 'Connecting to media'}` : resolution.status === 'loading' ? 'Finding title sources' : 'No source available'}</span>
          </div>
          <div className="player-top-actions">
            {content.type !== 'series' && <button className="btn-secondary" aria-pressed={autoplay} onClick={() => {
              const enabled = !autoplay; setAutoplay(enabled);
              try { localStorage.setItem('mp_autoplay_next', String(enabled)); } catch { /* Device storage may be unavailable. */ }
              if (!enabled) { nextRequest.current?.abort(); nextRequest.current = null; setNextStatus('Autoplay stopped.'); }
            }}>Autoplay next: {autoplay ? 'On' : 'Off'}</button>}
            {source && <details className="playback-settings"><summary>Playback settings</summary><div className="playback-settings-panel">
              <label>Source<select aria-label="Playback source" value={selected} onChange={event => selectSource(Number(event.target.value))}>{resolution.sources.map((item, index) => <option value={index} key={index}>{sourceLabel(item)} · Option {index + 1}</option>)}</select></label>
              <p>Quality is reported by the source. Only returned media choices are listed.</p>
              {!!tracks.length && <label>Video quality<select aria-label="Video quality" value={quality} onChange={event => {
                const value = event.target.value; const player = adaptive.current?.player;
                if (!player) return;
                if (value === 'auto') player.configure({ abr: { enabled: true } });
                else { const track = tracks.find(entry => String(entry.id) === value); if (!track) return; player.configure({ abr: { enabled: false } }); player.selectVariantTrack(track, true); }
                setQuality(value);
              }}><option value="auto">Auto (recommended)</option>{tracks.map(track => <option value={track.id} key={track.id}>{track.height}p{track.language ? ` · ${track.language}` : ''}</option>)}</select></label>}
              <label>Playback speed<select aria-label="Playback speed" value={speed} onChange={event => { const value = Number(event.target.value); setSpeed(value); if (videoRef.current) videoRef.current.playbackRate = value; }}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option value={value} key={value}>{value}×{value === 1 ? ' Normal' : ''}</option>)}</select></label>
            </div></details>}
            <button ref={closeRef} className="player-close-btn" onClick={close} aria-label="Close Player"><X size={22} /></button>
          </div>
        </div>

        {resolution.status === 'loading' && <div role="status" style={{ margin: 'auto', padding: 24, textAlign: 'center' }}><RefreshCw className="spin-icon" size={26} /><p>Finding sources for {title}…</p></div>}
        {resolution.status === 'unavailable' && <div role="alert" style={{ margin: 'auto', padding: 28, maxWidth: 580, textAlign: 'center' }}>
          <h3>No playable source is available for this title.</h3>
          <p>{resolution.diagnostics[0] || 'No matching media source was returned. Choose another provider or configure a source for this title.'}</p>
          {resolution.diagnostics.length > 0 && <details><summary>Source details</summary><ul>{resolution.diagnostics.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
          <button className="btn-primary" onClick={retry}>Retry sources</button>
          {onOpenProviders && <button className="btn-secondary" onClick={onOpenProviders}>Browse providers</button>}
        </div>}

        {source && <video key={`${selected}:${source.url}:${attempt}`} ref={videoRef} className="main-html-video" src={requiresAdaptiveEngine(document.createElement('video'), source) ? undefined : source.url} poster={titleArtworkUrl(content.backdrop_url || content.poster_url) || undefined} controls playsInline tabIndex={0} preload="metadata" crossOrigin={source.subtitles?.length ? 'anonymous' : undefined} style={{ width: '100%', height: '100%', objectFit: 'contain', visibility: error ? 'hidden' : 'visible' }}
          onPlaying={() => { setMediaState('playing'); setError(null); }}
          onWaiting={() => { if (!error) setMediaState('buffering'); }}
          onPause={() => { if (!error) setMediaState('paused'); saveProgress(); }}
          onError={mediaError}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (!video) return;
            const progress = api.getContinueWatching().find(item => (item.content_id || item.id) === content.id && (item.episode_id || null) === (episodeId || null));
            if (progress && Number.isFinite(video.duration) && progress.progress_seconds < video.duration - 3) video.currentTime = progress.progress_seconds;
            video.playbackRate = speed;
            video.play().catch(reason => { if (reason.name === 'NotAllowedError') setMediaState('paused'); else if (reason.name !== 'AbortError') mediaError(); });
          }}
          onTimeUpdate={() => { if (videoRef.current && Math.abs(videoRef.current.currentTime - lastSaved.current) >= 5) { lastSaved.current = videoRef.current.currentTime; saveProgress(); } }}
          onEnded={ended}>
          {(source.subtitles && source.subtitles.length > 0) ? (
            source.subtitles.map(track => <track kind="captions" key={track.url} src={track.url} srcLang={track.language} label={track.label} default={track.default} />)
          ) : (
            <track kind="captions" src="/captions/empty.vtt" srcLang="en" label="English" default />
          )}
        </video>}
        {nextStatus && <div role="status" className="player-error-panel"><p>{nextStatus}</p><button className="btn-secondary" onClick={() => { nextRequest.current?.abort(); nextRequest.current = null; setNextStatus('Autoplay stopped.'); }}>Cancel next movie</button></div>}
        {source && !error && mediaState === 'connecting' && <div className="player-connecting" role="status"><Artwork src={content.backdrop_url} title={title} kind="backdrop" /><p>Connecting to media. Playback has not started.</p></div>}
        {error && <div role="alert" className="player-error-panel">
          <h3>Playback stopped</h3><p>{error}</p><div className="player-error-actions"><button className="btn-primary" onClick={retry}>Retry sources</button>{resolution.sources.length > 1 && <button className="btn-secondary" onClick={() => selectSource((selected + 1) % resolution.sources.length)}>Try another source</button>}{onOpenProviders && <button className="btn-secondary" onClick={onOpenProviders}>Browse providers</button>}</div>
        </div>}
      </div>
    </div>
  );
}
