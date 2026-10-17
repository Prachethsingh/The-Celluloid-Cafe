import React from 'react';
import { Home, Search, Heart, User } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab, watchlistCount, onOpenAuth }) {
  return (
    <nav className="bottom-nav glass-panel" aria-label="Mobile Navigation">
      <button
        className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
      >
        <Home size={20} />
        <span>Home</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'search' ? 'active' : ''}`}
        onClick={() => setActiveTab('search')}
      >
        <Search size={20} />
        <span>Search</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'library' ? 'active' : ''}`}
        aria-label="Library"
        onClick={() => setActiveTab('library')}
      >
        <div className="bottom-icon-relative">
          <Heart size={20} />
          {watchlistCount > 0 && <span className="bottom-badge">{watchlistCount}</span>}
        </div>
        <span>Library</span>
      </button>

      <button
        className="bottom-nav-item"
        onClick={onOpenAuth}
      >
        <User size={20} />
        <span>Profile</span>
      </button>
    </nav>
  );
}
