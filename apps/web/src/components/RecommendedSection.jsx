import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { PLATFORMS } from '../data/referenceData';

export default function RecommendedSection({
  recommendedItems = [],
  topItems = [],
  onPlay,
  onOpenDetails,
  selectedPlatform = 'all',
  onResetPlatform,
}) {
  const [activeCategory, setActiveCategory] = useState('movies'); // 'movies' | 'series' | 'popular'
  const [topTimeRange, setTopTimeRange] = useState('day'); // 'day' | 'week' | 'month'

  const activePlatformObj = PLATFORMS.find((p) => p.id === selectedPlatform);

  // Filter items based on activeCategory with smart fallback
  const categoryItems = recommendedItems.filter((item) => {
    if (activeCategory === 'movies') return item.type === 'movie';
    if (activeCategory === 'series') return item.type === 'series';
    return true; // 'popular'
  });

  const filteredItems = categoryItems.length > 0 ? categoryItems : recommendedItems;

  return (
    <div className="flx-main-grid-layout">
      {/* Left Column: Recommended Grid */}
      <div className="flx-recommended-col">
        {/* Header Bar: ▶ RECOMMENDED + Category Tabs */}
        <div className="flx-section-header-row">
          <div className="flx-title-group">
            <span className="flx-cyan-play-icon">▶</span>
            <h2 className="flx-section-title">
              {activePlatformObj
                ? `AVAILABLE ON ${activePlatformObj.name.toUpperCase()}`
                : 'RECOMMENDED'}
            </h2>
            {activePlatformObj && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: activePlatformObj.color + '22',
                  color: '#f8fafc',
                  border: `1px solid ${activePlatformObj.color}55`,
                }}
              >
                {filteredItems.length} titles
              </span>
            )}
          </div>

          <div className="flx-category-tabs">
            <button
              className={`flx-cat-tab ${activeCategory === 'movies' ? 'active' : ''}`}
              onClick={() => setActiveCategory('movies')}
            >
              Movies
            </button>
            <button
              className={`flx-cat-tab ${activeCategory === 'series' ? 'active' : ''}`}
              onClick={() => setActiveCategory('series')}
            >
              TV Series
            </button>
            <button
              className={`flx-cat-tab ${activeCategory === 'popular' ? 'active' : ''}`}
              onClick={() => setActiveCategory('popular')}
            >
              Popular
            </button>
          </div>
        </div>

        {/* Poster Cards Grid */}
        {filteredItems.length > 0 ? (
          <div className="flx-posters-row">
            {filteredItems.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flx-poster-card"
                onClick={() => onOpenDetails ? onOpenDetails(item) : onPlay(item)}
              >
                <div className="flx-card-poster-wrap">
                  <img width="400" height="600"
                    src={item.poster_url}
                    alt={item.title}
                    className="flx-card-img"
                    loading="lazy"
                  />

                  {/* Hover Overlay with Play Button */}
                  <div className="flx-card-hover-overlay">
                    <button
                      className="flx-hover-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      title="Play stream"
                    >
                      <Play size={20} fill="#ffffff" color="#ffffff" />
                    </button>
                  </div>
                </div>

                {/* Card Label info */}
                <div className="flx-card-bottom-info">
                  <h3 className="flx-card-title" title={item.title}>
                    {item.title}
                  </h3>
                  <div className="flx-card-sub-meta">
                    <span>{item.type === 'movie' ? 'Movie' : 'TV'}</span>
                    <span>•</span>
                    <span>{item.year || 2026}</span>
                    {item.rating && (
                      <>
                        <span>•</span>
                        <span className="flx-card-rating">★ {item.rating}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              margin: '20px 0',
            }}
          >
            <p style={{ color: '#94a3b8', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
              No titles currently available on this platform in your region.
            </p>
            {onResetPlatform && (
              <button
                className="btn-primary"
                onClick={onResetPlatform}
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Show All Platforms
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Column: TOP 5 Sidebar */}
      <div className="flx-top5-sidebar">
        <div className="flx-top5-header-row">
          <div className="flx-top5-title-group">
            <span className="flx-cyan-bar" />
            <h3 className="flx-top5-title">TOP 5</h3>
          </div>

          <div className="flx-top5-tabs">
            {['day', 'week', 'month'].map((t) => (
              <button
                key={t}
                className={`flx-top5-tab ${topTimeRange === t ? 'active' : ''}`}
                onClick={() => setTopTimeRange(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Top 5 Ranked List */}
        <div className="flx-top5-list">
          {topItems.slice(0, 5).map((item, idx) => (
            <div
              key={item.id}
              className="flx-top5-item"
              onClick={() => onOpenDetails ? onOpenDetails(item) : onPlay(item)}
            >
              {/* Huge Bold Rank Number 1..5 */}
              <span className="flx-top5-rank">{idx + 1}</span>

              {/* Thumbnail image */}
              <div className="flx-top5-thumb-wrap">
                <img width="400" height="600"
                  src={item.poster_url}
                  alt={item.title}
                  className="flx-top5-thumb"
                  loading="lazy"
                />
              </div>

              {/* Title & Metadata */}
              <div className="flx-top5-info">
                <h4 className="flx-top5-item-title" title={item.title}>
                  {item.title}
                </h4>
                <span className="flx-top5-item-meta">
                  {item.type === 'movie' ? 'Movie' : 'TV'} • {item.year || 2026}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
