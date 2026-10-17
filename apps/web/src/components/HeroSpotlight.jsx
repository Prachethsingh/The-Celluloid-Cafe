import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react';
import Artwork from './Artwork';

export default function HeroSpotlight({ items = [], onExplore, onToggleWatchlist, isWatchlisted }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const item = items[index] || items[0];
  const primaryGenre = item.genres?.includes('Sci-Fi') ? 'Sci-Fi' : item.genres?.[0];
  const move = offset => setIndex(current => (current + offset + items.length) % items.length);
  return <section className="feature-spotlight flx-hero-section" aria-label="Featured Cinema Spotlight">
    <div className="feature-copy">
      <p className="eyebrow spotlight-kicker">The CinePulse spotlight</p>
      <h2 className="feature-title">{item.title}</h2>
      <div className="feature-metadata"><span>{item.year || item.first_air_date?.slice(0, 4) || 'Year unavailable'}</span>{primaryGenre && <span>{primaryGenre}</span>}{item.runtime && <span>{item.runtime}</span>}<span className="feature-kind">{item.type === 'series' ? 'SERIES' : 'FILM'}</span></div>
      <p className="feature-description">{item.description || 'Story details have not been supplied by the catalog source.'}</p>
      <div className="feature-actions">
        <button className="btn btn-primary" onClick={() => onExplore(item)}><span className="explore-play-mark"><ChevronRight size={17} fill="currentColor" /></span>Explore {item.type === 'series' ? 'series' : 'film'}</button>
        <button className="btn btn-outline" onClick={() => onToggleWatchlist(item.id)}>{isWatchlisted(item.id) ? <Check size={17} /> : <Plus size={17} />}{isWatchlisted(item.id) ? 'In watchlist' : 'Watchlist'}</button>
      </div>
    </div>
    <div className="feature-artwork" key={item.id}>
      <Artwork src={item.backdrop_url} title={item.title} kind="backdrop" eager />
    </div>
    <div className="spotlight-footer">
      <span className="spotlight-footer-label">Stories that stay with you</span>
      <div className="spotlight-controls" aria-label="Spotlight controls">
        <button className="spotlight-arrow" aria-label="Previous featured title" onClick={() => move(-1)}><ChevronLeft size={19} /></button>
        <span className="spotlight-count"><strong>{String(index + 1).padStart(2, '0')}</strong><span>/</span>{String(items.length).padStart(2, '0')}</span>
        <button className="spotlight-arrow" aria-label="Next featured title" onClick={() => move(1)}><ChevronRight size={19} /></button>
      </div>
    </div>
  </section>;
}
