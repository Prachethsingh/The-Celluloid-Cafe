import { useState } from 'react';
import { titleArtworkUrl } from '../services/artwork';

// Key the image state by URL so changing titles cannot inherit a previous failure.
function ArtworkImage({ src, title, kind, className, eager }) {
  const [state, setState] = useState(src ? 'loading' : 'missing');
  return <div className={`artwork artwork-${kind} ${className || ''}`} data-artwork-state={state}>
    <div className="artwork-fallback" aria-hidden="true"><span>{kind === 'poster' ? 'POSTER UNAVAILABLE' : 'ARTWORK UNAVAILABLE'}</span><strong>{title}</strong></div>
    {src && state !== 'failed' && <img src={src} alt="" width={kind === 'poster' ? 400 : 960} height={kind === 'poster' ? 600 : 540} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setState('loaded')} onError={() => setState('failed')} />}
    {state === 'loading' && <div className="artwork-skeleton" aria-hidden="true" />}
  </div>;
}
export default function Artwork({ src, ...props }) {
  const url = titleArtworkUrl(src);
  return <ArtworkImage key={url || 'missing'} src={url} {...props} />;
}
