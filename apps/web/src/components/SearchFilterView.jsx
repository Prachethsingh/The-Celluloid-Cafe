import React, { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, RotateCcw, Film, Tv } from 'lucide-react';
import { GENRES, PLATFORMS } from '../data/referenceData';
import { api } from '../services/api';
import ContentCard from './ContentCard';
import { PageHeading, Feedback, LoadingState, EmptyState } from './ui';

export default function SearchFilterView({
  currentCountry,
  watchlist,
  onPlay,
  onToggleWatchlist,
  onOpenDetails,
  initialQuery = ''
}) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState('all'); // 'all', 'movie', 'series'
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [minYear, setMinYear] = useState(2000);
  const [maxYear, setMaxYear] = useState(2026);
  const [sortBy, setSortBy] = useState('popularity');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef(null);
  const generation = useRef(0);

  const LANGUAGES = ['All', 'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Korean', 'Japanese', 'Spanish'];

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    generation.current += 1;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
      const data = await api.searchPage(query, {
        type: selectedType,
        genre: selectedGenre,
        language: selectedLanguage,
        platform: selectedPlatform,
        minRating,
        minYear,
        maxYear,
        sortBy
      }, 1, controller.signal);

      if (!isCancelled) {
        setResults(data.items);
        setHasMore(data.has_more);
        setPage(1);
        setIsLoading(false);
      }
      } catch (reason) {
        if (!isCancelled) { setError(reason.message); setIsLoading(false); }
      }
    }, 180);

    return () => {
      isCancelled = true;
      controller.abort();
      request.current?.abort();
      clearTimeout(timer);
    };
  }, [query, selectedType, selectedGenre, selectedLanguage, selectedPlatform, minRating, minYear, maxYear, sortBy, currentCountry, retry]);

  const resetFilters = () => {
    setQuery('');
    setSelectedType('all');
    setSelectedGenre('All');
    setSelectedLanguage('All');
    setSelectedPlatform('all');
    setMinRating(0);
    setMinYear(2000);
    setMaxYear(2026);
    setSortBy('popularity');
  };

  const activeFiltersCount = [
    selectedType !== 'all',
    selectedGenre !== 'All',
    selectedLanguage !== 'All',
    selectedPlatform !== 'all',
    minRating > 0,
    minYear > 2000,
    maxYear < 2026,
    sortBy !== 'popularity'
  ].filter(Boolean).length;

  return (
    <div className="search-view-container animate-fade-in">
      <PageHeading eyebrow="Find your next watch" title="Search the collection" description="Search titles and narrow the results by genre, year, rating, or service." />
      {/* Search Header Banner */}
      <div className="search-header-box glass-panel">
        <div className="search-input-wrapper">
          <Search size={22} className="search-icon-input" />
          <input
            type="text"
            placeholder="Search movie and series titles"
            aria-label="Search movie and series titles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-main-input"
            autoFocus
          />
          {query && (
            <button className="clear-search-btn" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="search-header-actions">
          {/* Mobile Filter Toggle Button */}
          <button
            className={`btn-secondary filter-toggle-btn ${activeFiltersCount > 0 ? 'has-active' : ''}`}
            onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            aria-expanded={showFiltersDrawer}
            aria-controls="search-filters"
          >
            <SlidersHorizontal size={18} />
            <span>Filters</span>
            {activeFiltersCount > 0 && <span className="filter-count-badge">{activeFiltersCount}</span>}
          </button>

          {/* Quick Sort Dropdown */}
          <select
            className="sort-dropdown glass-card"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort Results"
          >
            <option value="popularity">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="year">Newest Release</option>
            <option value="title">Title (A-Z)</option>
          </select>

          {activeFiltersCount > 0 && (
            <button className="btn-secondary reset-filters-btn" onClick={resetFilters} title="Reset all filters">
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Type Tabs Bar */}
      <div className="search-type-bar">
        <button
          className={`type-chip ${selectedType === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedType('all')}
          aria-pressed={selectedType === 'all'}
        >
          All Titles
        </button>
        <button
          className={`type-chip ${selectedType === 'movie' ? 'active' : ''}`}
          onClick={() => setSelectedType('movie')}
          aria-pressed={selectedType === 'movie'}
        >
          <Film size={15} /> Movies
        </button>
        <button
          className={`type-chip ${selectedType === 'series' ? 'active' : ''}`}
          onClick={() => setSelectedType('series')}
          aria-pressed={selectedType === 'series'}
        >
          <Tv size={15} /> TV Series
        </button>
      </div>

      {/* Genre Pills Horizontal Row */}
      <div className="genre-pills-row">
        {GENRES.map(g => (
          <button
            key={g}
            className={`genre-filter-pill ${selectedGenre === g ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g)}
            aria-pressed={selectedGenre === g}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Advanced Filter Drawer / Desktop Sidebar Section */}
      <div id="search-filters" className={`filter-drawer ${showFiltersDrawer ? 'open' : 'closed'} glass-card`}>
        <div className="filter-grid">
          {/* Language */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-language">Language</label>
            <select
              id="filter-language"
              className="filter-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGES.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Platform in Region */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-platform">Platform (Region)</label>
            <select
              id="filter-platform"
              className="filter-select"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Min Rating */}
          <div className="filter-group">
            <div className="filter-label-flex">
              <label className="filter-label" htmlFor="filter-rating">Min Rating</label>
              <span className="filter-val-badge">⭐ {minRating > 0 ? `${minRating}+` : 'Any'}</span>
            </div>
            <input
              id="filter-rating"
              type="range"
              min="0"
              max="9"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="filter-slider"
            />
          </div>

          {/* Release Year Range */}
          <div className="filter-group">
            <div className="filter-label-flex">
              <label className="filter-label">Release Year</label>
              <span className="filter-val-badge">{minYear} – {maxYear}</span>
            </div>
            <div className="year-inputs-row">
              <input
                type="number"
                aria-label="Earliest release year"
                min="1980"
                max={maxYear}
                value={minYear}
                onChange={(e) => setMinYear(e.target.value === '' ? 2000 : Number(e.target.value))}
                className="year-num-input"
              />
              <span className="year-dash">—</span>
              <input
                type="number"
                aria-label="Latest release year"
                min={minYear}
                max="2026"
                value={maxYear}
                onChange={(e) => setMaxYear(e.target.value === '' ? 2026 : Number(e.target.value))}
                className="year-num-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="search-results-section" aria-busy={isLoading}>
        {error && <Feedback tone="error" action={<button className="btn-secondary" onClick={() => setRetry(value => value + 1)}>Retry search</button>}>{error}</Feedback>}
        <div className="results-header-info">
          <span className="results-count" aria-live="polite">
            {isLoading ? 'Searching...' : error ? 'Search could not be completed' : `Found ${results.length} ${results.length === 1 ? 'title' : 'titles'}`}
          </span>
          {query && (
            <span className="results-query-label">for "<strong>{query}</strong>"</span>
          )}
        </div>

        {isLoading && <LoadingState label="Searching the collection…" />}
        {results.length > 0 ? (
          <div className="content-cards-grid">
            {results.map(item => (
              <ContentCard
                key={item.id}
                item={item}
                currentCountry={currentCountry}
                onPlay={onPlay}
                onToggleWatchlist={onToggleWatchlist}
                isWatchlisted={watchlist.includes(item.id)}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </div>
        ) : !isLoading && !error ? <EmptyState className="zero-results-card" title="No movies or series found" description="Try different terms, clear filters, or switch region availability." action={<button className="btn-primary" onClick={resetFilters}>Clear All Filters</button>} /> : null}
        {hasMore && <button className="btn-secondary" disabled={isLoading} onClick={async () => {
          setIsLoading(true); setError(null);
          const currentGeneration = generation.current;
          const controller = new AbortController();
          request.current = controller;
          try {
            const data = await api.searchPage(query, { type: selectedType, genre: selectedGenre, language: selectedLanguage, platform: selectedPlatform, minRating, minYear, maxYear, sortBy }, page + 1, controller.signal);
            if (controller.signal.aborted || currentGeneration !== generation.current) return;
            setResults(items => [...items, ...data.items]); setPage(data.page); setHasMore(data.has_more);
          } catch (reason) { if (!controller.signal.aborted && currentGeneration === generation.current) setError(reason.message); }
          finally { if (!controller.signal.aborted && currentGeneration === generation.current) setIsLoading(false); }
        }}>Load more results</button>}
      </div>
    </div>
  );
}
