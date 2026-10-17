import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PLATFORMS } from '../data/referenceData';

export default function PlatformPillsBar({ selectedPlatform, onSelectPlatform }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="platform-pills-container">
      <button
        className="platform-scroll-btn left"
        onClick={() => scroll('left')}
        aria-label="Scroll platforms left"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="platform-pills-scroll" ref={scrollRef}>
        <button
          className={`platform-pill ${!selectedPlatform || selectedPlatform === 'all' ? 'active' : ''}`}
          onClick={() => onSelectPlatform('all')}
        >
          <span className="platform-pill-text">ALL PLATFORMS</span>
        </button>

        <button
          className={`platform-pill ${selectedPlatform === 'vega' ? 'active' : ''}`}
          style={{
            '--brand-color': '#8b5cf6',
          }}
          onClick={() => onSelectPlatform('vega')}
          title="Zenda-Cross Vega Providers & Cinemeta Live Catalogs"
        >
          <span
            className="platform-pill-text"
            style={{ color: selectedPlatform === 'vega' ? '#ffffff' : '#c4b5fd' }}
          >
            ⚡ VEGA LIVE
          </span>
        </button>

        {PLATFORMS.map((plat) => {
          const isSelected = selectedPlatform === plat.id;
          return (
            <button
              key={plat.id}
              className={`platform-pill ${isSelected ? 'active' : ''}`}
              style={{
                '--brand-color': plat.color,
              }}
              onClick={() => onSelectPlatform(plat.id)}
              title={`Filter by ${plat.name}`}
            >
              <span
                className="platform-pill-text"
                style={{ color: '#f8fafc' }}
              >
                {plat.brandText || plat.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="platform-scroll-btn right"
        onClick={() => scroll('right')}
        aria-label="Scroll platforms right"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
