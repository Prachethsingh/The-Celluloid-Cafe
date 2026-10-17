import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import HeroSpotlight from './components/HeroSpotlight';
import ContentCard from './components/ContentCard';
import ContinueWatchingRow from './components/ContinueWatchingRow';
import ContentDetailModal from './components/ContentDetailModal';
import VideoPlayerModal from './components/VideoPlayerModal';
import SearchFilterView from './components/SearchFilterView';
import LibraryView from './components/LibraryView';
import AdminDashboardView from './components/AdminDashboardView';
import AuthModal from './components/AuthModal';
import VegaProvidersModal from './components/VegaProvidersModal';

import { api } from './services/api';
import './App.css';
import './design-system.css';
import { useNavigation } from './hooks/useNavigation';
import { frequentlyAskedQuestions } from './siteContent';

export default function App() {
  const [activeTab, setActiveTab] = useNavigation();
  const [contentFilter, setContentFilter] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [currentCountry, setCurrentCountry] = useState(api.getCountry());
  const [watchlist, setWatchlist] = useState(api.getWatchlist());
  const [continueWatching, setContinueWatching] = useState(api.getContinueWatching());
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [activePlaybackItem, setActivePlaybackItem] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVegaModalOpen, setIsVegaModalOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const interstellar = recommendedItems.find(item => item.title?.toLowerCase() === 'interstellar');
  const otherFeatured = recommendedItems.filter(item => item.id !== interstellar?.id).sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0));
  const heroItems = [...(interstellar ? [interstellar] : []), ...otherFeatured].slice(0, 3);

  useEffect(() => {
    api.loadSession().then(() => { setWatchlist(api.getWatchlist()); setContinueWatching(api.getContinueWatching()); }).catch(() => setNotice('Account service unavailable. Your local library remains on this device.'));
    const syncError = event => setNotice('Library synchronization failed: ' + event.detail);
    window.addEventListener('library-sync-error', syncError);
    return () => window.removeEventListener('library-sync-error', syncError);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshCatalog = () => api.getAllContent()
      .then(items => { if (active) setRecommendedItems(items); })
      .catch(() => { if (active) setNotice('Catalog service unavailable. Showing the last successfully loaded catalog.'); });
    refreshCatalog();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCatalog();
    }, 60_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') refreshCatalog();
    };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      canonical.setAttribute('href', `${window.location.origin}${window.location.pathname}`);
    }
  }, []);

  const getFilteredRecommended = () => {
    let list = recommendedItems;

    if (contentFilter === 'movies') {
      list = list.filter(item => item.type === 'movie');
    } else if (contentFilter === 'series') {
      list = list.filter(item => item.type === 'series');
    } else if (contentFilter === 'anime' || contentFilter === 'anime-movies' || contentFilter === 'anime-series') {
      list = list.filter(item => item.genres?.includes('Animation') || item.language?.toLowerCase() === 'japanese');
    } else if (contentFilter === 'trending') {
      list = list.filter(item => item.is_trending || item.rating >= 8.0);
    }

    if (selectedPlatform && selectedPlatform !== 'all') {
      if (selectedPlatform === 'vega') {
        list = list.filter(item => item.provider === 'vega-cinemeta' || item.source?.includes('vega'));
      } else {
        list = list.filter(item => {
          const avail = item.availability && Object.keys(item.availability).length > 0 ? item.availability : {};
          const countryAvail = avail[currentCountry] || avail['US'] || [];
          return countryAvail.some(p => {
            const matchPlatform = p.platformId === selectedPlatform || (selectedPlatform === 'hbo' && p.platformId === 'max') || (selectedPlatform === 'max' && p.platformId === 'hbo');
            return matchPlatform && p.available;
          });
        });
      }
    }

    return list;
  };

  const handleToggleWatchlist = (contentId) => {
    const contentItem = recommendedItems.find(item => item.id === contentId);
    const updated = api.toggleWatchlist(contentId, contentItem);
    setWatchlist([...updated]);
  };

  const isWatchlisted = (contentId) => watchlist.includes(contentId);

  const handleCountryChange = (country) => {
    api.setCountry(country);
    setCurrentCountry(country);
  };

  const handleRemoveContinueWatching = (id) => {
    const updated = api.removeFromContinueWatching(id);
    setContinueWatching([...updated]);
  };

  const handlePlayContent = (item) => {
    const contentId = item.content_id || item.id;
    const original = recommendedItems.find(entry => entry.id === contentId) || item;
    const content = { ...original, ...item, id: contentId };
    if (content.type === 'series' && !content.episode?.id) {
      setActivePlaybackItem(null);
      setSelectedDetailItem(content);
      return;
    }
    setSelectedDetailItem(null);
    setActivePlaybackItem(content);
  };

  const openPlaybackProviders = () => {
    setActivePlaybackItem(null);
    setSelectedDetailItem(null);
    setIsVegaModalOpen(true);
  };

  return (
    <div className="app-container flx-theme-root">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to main content</a>
      {notice && <p role="alert" className="app-notice">{notice}<button className="btn btn-outline" onClick={() => setNotice(null)}>Dismiss</button></p>}

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        contentFilter={contentFilter}
        setContentFilter={setContentFilter}
        watchlistCount={watchlist.length}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSearch={() => setActiveTab('search')}
        onOpenVega={() => setIsVegaModalOpen(true)}
      />

      <main id="main-content" tabIndex={-1} className="main-content-area">
        <h1 className="visually-hidden">CinePulse Movie and Series Discovery</h1>

        {activeTab === 'home' && (
          <div className="home-view-wrapper animate-fade-in">
            <HeroSpotlight
              items={heroItems}
              onExplore={item => setSelectedDetailItem(item)}
              onToggleWatchlist={handleToggleWatchlist}
              isWatchlisted={isWatchlisted}
            />

            <div className="catalog-area">
              <div className="catalog-section">
                <div className="catalog-heading">
                  <div><h2>Browse the Collection</h2><p>{getFilteredRecommended().length} titles in {currentCountry}. Select any title to explore available streams.</p></div>
                  <div className="catalog-types" aria-label="Collection filters">
                    {[['all', 'All titles'], ['movies', 'Movies'], ['series', 'Series'], ['anime', 'Anime']].map(([key, label]) => <button key={key} className={`flx-cat-tab ${contentFilter === key ? 'active' : ''}`} aria-pressed={contentFilter === key} onClick={() => setContentFilter(key)}>{label}</button>)}
                  </div>
                </div>
                {!getFilteredRecommended().length && <div className="workspace-panel"><h3>No titles match this filter</h3><p>Choose another streaming service or clear your filters.</p><button className="btn btn-outline" onClick={() => { setSelectedPlatform('all'); setContentFilter('all'); }}>Clear collection filters</button></div>}
                <div className="catalog-grid">
                  {getFilteredRecommended().map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      currentCountry={currentCountry}
                      onPlay={handlePlayContent}
                      onToggleWatchlist={handleToggleWatchlist}
                      isWatchlisted={isWatchlisted(item.id)}
                      onOpenDetails={(it) => setSelectedDetailItem(it)}
                    />
                  ))}
                </div>
              </div>

              {continueWatching.length > 0 && (
                <div style={{ marginTop: '3.5rem' }}>
                  <ContinueWatchingRow
                    items={continueWatching}
                    onResume={handlePlayContent}
                    onRemove={handleRemoveContinueWatching}
                  />
                </div>
              )}

              <section className="faq-section" id="faq" aria-labelledby="faq-heading">
                <div className="section-header">
                  <div className="section-title-col">
                    <h2 id="faq-heading" className="section-title">Frequently Asked Questions</h2>
                    <span className="section-subtitle">Quick answers to help you start streaming</span>
                  </div>
                </div>
                <div className="faq-grid">
                  {frequentlyAskedQuestions.map(([question, answer]) => (
                    <article className="faq-card glass-card" key={question}>
                      <h3 className="faq-question">{question}</h3>
                      <p className="faq-answer">{answer}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <SearchFilterView
            currentCountry={currentCountry}
            watchlist={watchlist}
            onPlay={handlePlayContent}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenDetails={(item) => setSelectedDetailItem(item)}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            catalogItems={recommendedItems}
            onLibraryRestored={() => { setWatchlist(api.getWatchlist()); setContinueWatching(api.getContinueWatching()); }}
            currentCountry={currentCountry}
            watchlist={watchlist}
            continueWatching={continueWatching}
            onPlay={handlePlayContent}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenDetails={(item) => setSelectedDetailItem(item)}
            onClearHistory={() => {
              api.clearHistory();
              setContinueWatching([]);
            }}
            onNavigateHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'admin' && <AdminDashboardView />}
      </main>

      <footer className="site-information" aria-label="About CinePulse">
        <div className="footer-introduction">
          <h2>CinePulse Media</h2>
          <p>We build CinePulse to help you discover movies, organize watchlists, and find verified streaming options.</p>
          <div className="site-editorial-meta">
            <p>
              <span>Curated by <strong itemProp="author">CinePulse Editorial Team</strong></span>
              <span> · </span>
              <span>Updated <time dateTime="2026-10-09">October 9, 2026</time></span>
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <button onClick={() => setActiveTab('home')}>Discover</button>
            <button onClick={() => setActiveTab('search')}>Search</button>
            <button onClick={() => setActiveTab('library')}>Library</button>
          </nav>
        </div>
        <div className="footer-information">
          <details>
            <summary>About & attribution</summary>
            <p>Respective owners hold all copyrights for trademarks and media artwork.</p>
          </details>
          <details>
            <summary>Privacy & device data</summary>
            <p>We store your local watchlist directly in your browser.</p>
            <p>When you create an account, we sync your library across devices.</p>
          </details>
          <details>
            <summary>Usage & playback</summary>
            <p>You choose which streaming providers you want to access.</p>
            <p>We recommend verifying source availability directly with each provider.</p>
          </details>
          <details>
            <summary>Support</summary>
            <p>If you encounter playback issues, test another available provider.</p>
            <p>Our team actively maintains ongoing platform updates.</p>
          </details>
          <details open>
            <summary>Frequently asked questions</summary>
            {frequentlyAskedQuestions.map(([question, answer]) => (
              <div className="footer-question" key={question}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </div>
            ))}
          </details>
        </div>
      </footer>

      {selectedDetailItem && (
        <ContentDetailModal
          key={selectedDetailItem.id}
          catalogItems={recommendedItems}
          onSelectSimilar={setSelectedDetailItem}
          item={selectedDetailItem}
          currentCountry={currentCountry}
          onCountryChange={handleCountryChange}
          onClose={() => setSelectedDetailItem(null)}
          onPlay={handlePlayContent}
          onOpenProviders={openPlaybackProviders}
          onToggleWatchlist={handleToggleWatchlist}
          isWatchlisted={isWatchlisted(selectedDetailItem.id)}
        />
      )}

      {activePlaybackItem && (
        <VideoPlayerModal
          key={`${activePlaybackItem.id}:${activePlaybackItem.episode?.id || ''}`}
          content={activePlaybackItem}
          onPlayNext={setActivePlaybackItem}
          onClose={() => setActivePlaybackItem(null)}
          onOpenProviders={openPlaybackProviders}
          onProgressUpdated={(updated) => setContinueWatching([...updated])}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => { setWatchlist(api.getWatchlist()); setContinueWatching(api.getContinueWatching()); }}
        />
      )}

      <VegaProvidersModal
        isOpen={isVegaModalOpen}
        onClose={() => setIsVegaModalOpen(false)}
        onPlay={item => { setIsVegaModalOpen(false); handlePlayContent(item); }}
      />

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />
    </div>
  );
}