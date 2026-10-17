import React from 'react';
import { Play, X, Clock } from 'lucide-react';
import Artwork from './Artwork';

export default function ContinueWatchingRow({ items, onResume, onRemove }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="continue-watching-section">
      <div className="section-header">
        <div className="section-title-col">
          <h2 className="section-title">Continue Watching</h2>
          <span className="section-subtitle">Pick up right where you left off</span>
        </div>
      </div>

      <div className="cw-row-scroll">
        {items.map(item => (
          <div key={item.id} className="cw-card glass-card">
            <div className="cw-thumbnail-wrapper" onClick={() => onResume(item)}>
              <Artwork src={item.backdrop_url || item.poster_url} title={item.title} kind="backdrop" />
              <div className="cw-overlay">
                <button className="cw-play-btn" title="Resume Playback" aria-label={`Resume ${item.episode_title || item.title}`}>
                  <Play size={18} fill="#ffffff" />
                </button>
              </div>

              <button
                className="cw-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                title="Remove from history"
                aria-label="Remove"
              >
                <X size={14} />
              </button>

              <div className="cw-progress-container">
                <div
                  className="cw-progress-bar"
                  style={{ width: `${Math.min(100, Math.max(0, Number(item.percentage) || 0))}%` }}
                />
              </div>
            </div>

            <div className="cw-info" onClick={() => onResume(item)}>
              <div className="cw-title-row">
                <h3 className="cw-title" title={item.title}>{item.title}</h3>
                <span className="cw-pct">{Math.min(100, Math.max(0, Number(item.percentage) || 0))}%</span>
              </div>
              {item.episode_title ? (
                <p className="cw-episode-sub">{item.episode_title}</p>
              ) : (
                <p className="cw-time-left">
                  <Clock size={12} /> {item.last_watched || 'Recently watched'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
