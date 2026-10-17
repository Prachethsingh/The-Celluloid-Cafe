import React from 'react';
import { Star, Play, Heart, CheckCircle2 } from 'lucide-react';
import { PLATFORMS } from '../data/referenceData';
import Artwork from './Artwork';

export default function ContentCard({
  item,
  currentCountry,
  onPlay,
  onToggleWatchlist,
  isWatchlisted,
  onOpenDetails
}) {
  const avail = item.availability || {};
  const countryAvail = avail[currentCountry] || avail['US'] || [];
  const availablePlatforms = countryAvail.filter(a => a.available);

  return (
    <article className="content-card glass-card">
      <div className="card-poster-wrapper" onClick={() => onOpenDetails(item)}>
        <Artwork src={item.poster_url} title={item.title} kind="poster" className="card-artwork" />

        <div className="card-poster-overlay">
          <button
            className="card-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(item);
            }}
            title={`Play ${item.title}`}
            aria-label={`Play ${item.title}`}
          >
            <Play size={20} fill="#ffffff" />
          </button>
        </div>

        <button
          className={`card-watchlist-btn ${isWatchlisted ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(item.id);
          }}
          title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
          aria-label={`${isWatchlisted ? 'Remove' : 'Save'} ${item.title} ${isWatchlisted ? 'from' : 'to'} watchlist`}
          aria-pressed={isWatchlisted}
        >
          <Heart size={16} fill={isWatchlisted ? '#ffffff' : 'none'} />
        </button>

        <div className="card-top-badges">
          {item.rating && <span className="badge badge-amber rating-pill">
            <Star size={11} fill="#fbbf24" /> {item.rating}
          </span>}
          {item.availability_verified && (
            <span className="badge badge-emerald" title="Verified availability metadata">
              <CheckCircle2 size={11} /> Listed
            </span>
          )}
        </div>
      </div>

      <div className="card-info" role="button" tabIndex={0} aria-label={`Details for ${item.title}`} onClick={() => onOpenDetails(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDetails(item); } }}>
        <h3 className="card-title" title={item.title}>{item.title}</h3>
        
        <div className="card-metadata">
          <span className="meta-year">{item.year || item.first_air_date?.slice(0, 4)}</span>
          <span className="meta-dot">•</span>
          <span className="meta-type">{item.type === 'movie' ? 'Movie' : 'Series'}</span>
          <span className="meta-dot">•</span>
          <span className="meta-genre">{item.genres?.[0] || 'Drama'}</span>
        </div>

        {/* Available Streaming Platforms in Current Country */}
        <div className="card-avail-row">
          {availablePlatforms.length > 0 ? (
            <div className="card-avail-tags">
              {availablePlatforms.slice(0, 3).map(avail => {
                const plat = PLATFORMS.find(
                  p => p.id === avail.platformId || (p.id === 'hbo' && avail.platformId === 'max')
                );
                if (!plat) return null;
                return (
                  <span
                    key={avail.platformId}
                    className="card-avail-dot"
                    style={{ borderColor: plat.color }}
                    title={`Listed on ${plat.name}; confirm current access with the service`}
                  >
                    {plat.name.split(' ')[0]}
                  </span>
                );
              })}
              {availablePlatforms.length > 3 && (
                <span className="card-avail-more">+{availablePlatforms.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="card-avail-none">Check regional rights</span>
          )}
        </div>
      </div>
    </article>
  );
}
