import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Plus, Check, Star, Clock, Globe, ShieldCheck, Film } from 'lucide-react';
import { PLATFORMS, COUNTRIES } from '../data/referenceData';
import { api } from '../services/api';
import { useDialog } from '../hooks/useDialog';
import Artwork from './Artwork';
import { titleArtworkUrl } from '../services/artwork';

export default function ContentDetailModal({
  item,
  onClose,
  currentCountry,
  onCountryChange,
  onPlay,
  onOpenProviders,
  onToggleWatchlist,
  isWatchlisted,
  onSelectSimilar,
  catalogItems = [],
}) {
  const dialog = useDialog(onClose);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [enrichedMeta, setEnrichedMeta] = useState(null);
  const episodesRef = useRef(null);

  useEffect(() => {
    let active = true;
    const imdbId = item.imdb_id || (item.id?.startsWith('tt') ? item.id : null);
    if (imdbId) {
      api.getVegaMetadata(item.type || 'movie', imdbId).then(meta => {
        if (active && meta) {
          setEnrichedMeta(meta);
        }
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [item]);

  if (!item) return null;

  const countryAvail = item.availability_verified ? item.availability?.[currentCountry] || [] : [];

  const isSeries = item.type === 'series';
  const rawSeasons = item.seasons || [];

  const resolvedSeasons = (rawSeasons && rawSeasons.length > 0)
    ? rawSeasons
    : (enrichedMeta?.videos && enrichedMeta.videos.length > 0)
    ? Object.entries(
        enrichedMeta.videos.reduce((acc, ep) => {
          const sNum = ep.season ?? 1;
          if (!acc[sNum]) acc[sNum] = [];
          acc[sNum].push({
            id: ep.id || `ep-${ep.season}-${ep.episode}`,
            addon_video_id: ep.id,
            season_number: sNum,
            title: ep.name || `Episode ${ep.episode}`,
            episode_number: ep.episode,
            overview: ep.overview,
            thumbnail_url: ep.thumbnail,
          });
          return acc;
        }, {})
      ).map(([sNum, eps]) => ({
        season_number: parseInt(sNum, 10),
        title: `Season ${sNum}`,
        episodes: eps
      }))
    : [];

  const seasons = resolvedSeasons;
  const activeSeasonData = seasons.find(s => s.season_number === selectedSeason) || seasons[0];
  const posterUrl = titleArtworkUrl(item.poster_url) || titleArtworkUrl(enrichedMeta?.poster_url);
  const backdropUrl = titleArtworkUrl(item.backdrop_url) || titleArtworkUrl(enrichedMeta?.backdrop_url);
  const playbackItem = { ...item, poster_url: posterUrl, backdrop_url: backdropUrl };
  const playEpisode = episode => onPlay({ ...playbackItem, episode: { ...episode, season_number: activeSeasonData.season_number } });
  const chooseEpisode = () => {
    episodesRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    episodesRef.current?.focus({ preventScroll: true });
  };

  // Find similar titles
  const allContent = catalogItems;
  const similarItems = allContent
    .filter(c => c.id !== item.id && c.genres?.some(g => item.genres?.includes(g)))
    .slice(0, 4);

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-heading"
        className="detail-modal-container glass-panel animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        {/* Modal Banner Backdrop */}
        <div
          className={`detail-backdrop-banner ${backdropUrl ? '' : 'no-artwork'}`}
        >
          {backdropUrl && <Artwork src={backdropUrl} title={item.title} kind="backdrop" eager />}
          
          <div className="detail-banner-badges">
            {item.rating && <span className="badge badge-amber">
              <Star size={12} fill="#fbbf24" /> {item.rating} / 10
            </span>}
            <span className="badge badge-dim">{item.year || item.first_air_date?.slice(0, 4)}</span>
            <span className="badge badge-dim">{item.runtime || (isSeries ? `${seasons.length} Seasons` : 'Runtime unavailable')}</span>
            {item.authorized_playback && (
              <span className="badge badge-dim">
                <ShieldCheck size={12} /> Source availability checked on play
              </span>
            )}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="detail-body-grid">
          {/* Left Column: Poster & Quick Facts */}
          <div className="detail-left-col">
            <Artwork src={posterUrl} title={item.title} kind="poster" className="detail-artwork" />

            <div className="detail-quick-specs glass-card">
              <div className="spec-item">
                <span className="spec-label">Language</span>
                <span className="spec-val">{item.language || 'Not supplied'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Country</span>
                <span className="spec-val">{item.country || 'Not supplied'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Director / Creator</span>
                <span className="spec-val">{item.director || item.creator || 'Not supplied'}</span>
              </div>
              {item.audio_tracks && (
                <div className="spec-item">
                  <span className="spec-label">Audio Tracks</span>
                  <span className="spec-val">{item.audio_tracks.join(', ')}</span>
                </div>
              )}
              {item.subtitles && (
                <div className="spec-item">
                  <span className="spec-label">Subtitles</span>
                  <span className="spec-val">{item.subtitles.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Title, Story, Actions, Availability & Seasons */}
          <div className="detail-right-col">
            <div className="detail-header-block">
              <h1 id="detail-heading" className="detail-title">{item.title}</h1>
              {item.original_title && item.original_title !== item.title && (
                <p className="detail-original-title">Original: {item.original_title}</p>
              )}
              {item.tagline && <p className="detail-tagline">"{item.tagline}"</p>}

              {/* Genres */}
              <div className="detail-genres-row">
                {item.genres?.map(g => (
                  <span key={g} className="genre-pill">{g}</span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="detail-actions-row">
              <button
                className="btn-primary"
                disabled={isSeries && !seasons.length}
                onClick={() => isSeries ? chooseEpisode() : onPlay(playbackItem)}
              >
                <Play size={18} fill="#ffffff" />
                <span>{isSeries ? 'Choose an episode' : 'Find playback source'}</span>
              </button>

              <button
                className={`btn-secondary ${isWatchlisted ? 'in-watchlist' : ''}`}
                onClick={() => onToggleWatchlist(item.id)}
              >
                {isWatchlisted ? <Check size={18} className="text-emerald" /> : <Plus size={18} />}
                <span>{isWatchlisted ? 'Saved in Watchlist' : 'Add to Watchlist'}</span>
              </button>

              {titleArtworkUrl(item.trailer_url) && (
                <button
                  className="btn-secondary"
                  onClick={() => setShowTrailerModal(true)}
                >
                  <Film size={18} />
                  <span>Trailer</span>
                </button>
              )}
            </div>

            {/* Synopsis */}
            <div className="detail-section">
              <h3 className="section-heading-sm">Overview</h3>
              <p className="detail-description-text">{item.description}</p>
            </div>

            {/* Where Available (Multi-Platform Country Aware) */}
            <div className="detail-section avail-section glass-card">
              <div className="avail-section-head">
                <div className="avail-head-title">
                  <Globe size={18} className="text-indigo" />
                  <h3>Service availability</h3>
                </div>
                
                {/* Modal Country Selector */}
                <div className="modal-country-select-wrapper">
                  <span>Region:</span>
                  <select
                    value={currentCountry}
                    onChange={(e) => onCountryChange(e.target.value)}
                    className="modal-country-select"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="avail-grid">
                {countryAvail.length > 0 ? (
                  countryAvail.map(avail => {
                    const plat = PLATFORMS.find(
                      p => p.id === avail.platformId || (p.id === 'hbo' && avail.platformId === 'max')
                    );
                    if (!plat) return null;
                    return (
                      <div
                        key={avail.platformId}
                        className={`avail-card-item ${avail.available ? 'status-avail' : 'status-unavail'}`}
                      >
                        <div className="avail-card-top">
                          <span
                            className="avail-badge-dot"
                            style={{ backgroundColor: avail.available ? '#10b981' : '#ef4444' }}
                          />
                          <span className="avail-plat-name">{plat.name}</span>
                        </div>
                        <div className="avail-card-bottom">
                          <span className="avail-status-text">
                            {avail.available ? 'Available' : 'Not Available'}
                          </span>
                          {avail.available && (
                            <span className="avail-tier-text">
                              {avail.tier} • {avail.quality}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="no-avail-msg">No verified service availability for this region.</p>
                )}
              </div>

              <div className="avail-legal-disclaimer">
                <ShieldCheck size={14} className="text-muted" />
                <span>
                  A source listing does not guarantee access or playback. Confirm availability with the service.
                </span>
              </div>
            </div>

            {/* Cast & Crew */}
            {item.cast && item.cast.length > 0 && (
              <div className="detail-section">
                <h3 className="section-heading-sm">Cast & Crew</h3>
                <div className="cast-row-scroll">
                  {item.cast.map(c => (
                    <div key={c.name} className="cast-card">
                      <img width="256" height="256"
                        src={titleArtworkUrl(c.avatar) || undefined}
                        alt=""
                        hidden={!titleArtworkUrl(c.avatar)}
                        onError={event => { event.currentTarget.hidden = true; }}
                        className="cast-avatar"
                        loading="lazy"
                      />
                      <span className="cast-name">{c.name}</span>
                      <span className="cast-role">{c.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seasons & Episodes for TV Series */}
            {isSeries && !seasons.length && <div role="status" className="detail-section">
              <p>No episodes have been supplied for this series. Browse a provider to choose a title and episode.</p>
              {onOpenProviders && <button className="btn-secondary" onClick={onOpenProviders}>Browse providers</button>}
            </div>}
            {isSeries && seasons.length > 0 && (
              <div ref={episodesRef} tabIndex={-1} className="detail-section seasons-section" role="region" aria-label="Choose an episode">
                <h3 className="section-heading-sm">Seasons & Episodes</h3>

                <div className="seasons-tab-bar">
                  {seasons.map(s => (
                    <button
                      key={s.season_number}
                      className={`season-tab-btn ${selectedSeason === s.season_number ? 'active' : ''}`}
                      onClick={() => setSelectedSeason(s.season_number)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>

                <div className="episodes-list">
                  {activeSeasonData?.episodes?.map(ep => (
                    <div key={ep.id} className="episode-item glass-card">
                      <div
                        className="ep-thumb-wrapper"
                        onClick={() => playEpisode(ep)}
                      >
                        <Artwork src={ep.thumbnail_url} title={ep.title} kind="backdrop" />
                        <div className="ep-play-overlay">
                          <Play size={18} fill="#ffffff" />
                        </div>
                      </div>

                      <div className="ep-details">
                        <div className="ep-header-row">
                          <h4 className="ep-title">
                            {ep.episode_number}. {ep.title}
                          </h4>
                          <span className="ep-runtime">
                            <Clock size={12} /> {ep.runtime}
                          </span>
                        </div>
                        <p className="ep-description">{ep.description}</p>
                        
                        <div className="ep-actions-row">
                          <button
                            className="ep-watch-btn"
                            onClick={() => playEpisode(ep)}
                          >
                            <Play size={13} fill="#ffffff" /> Play Episode
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Titles */}
            {similarItems.length > 0 && onSelectSimilar && (
              <div className="detail-section">
                <h3 className="section-heading-sm">Similar Titles</h3>
                <div className="similar-grid">
                  {similarItems.map(sim => (
                    <div
                      key={sim.id}
                      className="similar-card glass-card"
                      onClick={() => onSelectSimilar(sim)}
                    >
                      <Artwork src={sim.poster_url} title={sim.title} kind="poster" />
                      <div className="similar-info">
                        <span className="similar-title">{sim.title}</span>
                        {sim.rating && <span className="similar-rating">
                          <Star size={11} fill="#fbbf24" /> {sim.rating}
                        </span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Embedded Trailer Modal */}
        {showTrailerModal && (
          <div className="trailer-modal-backdrop" onClick={() => setShowTrailerModal(false)}>
            <div className="trailer-modal-content glass-card" onClick={e => e.stopPropagation()}>
              <div className="trailer-header">
                <h3>{item.title} — Official Trailer</h3>
                <button onClick={() => setShowTrailerModal(false)}><X size={18} /></button>
              </div>
              <div className="trailer-video-box">
                <video
                  src={item.trailer_url}
                  controls
                  autoPlay
                  className="trailer-player"
                >
                  <track kind="captions" src="/captions/empty.vtt" srcLang="en" label="English" default />
                </video>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
