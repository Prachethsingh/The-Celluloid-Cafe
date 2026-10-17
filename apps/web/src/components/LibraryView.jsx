import React, { useState } from 'react';
import { Heart, History, Trash2, Play, Film, Tv, CheckCircle2, BarChart3, Download, Upload, HardDrive, FolderSync, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import ContentCard from './ContentCard';
import Artwork from './Artwork';
import { PageHeading } from './ui';

export default function LibraryView({
  currentCountry,
  watchlist,
  continueWatching,
  onPlay,
  onToggleWatchlist,
  onOpenDetails,
  onClearHistory,
  onNavigateHome,
  onLibraryRestored,
  catalogItems = []
}) {
  const [activeSubTab, setActiveSubTab] = useState('watchlist'); // 'watchlist' | 'history' | 'stats' | 'backup'
  const [vegaCategory, setVegaCategory] = useState('all'); // 'all' | 'watching' | 'plantowatch' | 'completed' | 'onhold' | 'dropped'
  const [filterType, setFilterType] = useState('all');

  // Backup & Storage states
  const [backupSuccess, setBackupSuccess] = useState(null);
  const [backupError, setBackupError] = useState(null);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const allContent = catalogItems;
  const watchlistedItems = allContent.filter(item => watchlist.includes(item.id));
  const progressFor = item => continueWatching.find(progress => (progress.content_id || progress.id) === item.id);
  const complete = progress => progress && (progress.percentage >= 90 || (progress.duration_seconds > 0 && progress.progress_seconds >= progress.duration_seconds * .9));

  // Partition watchlisted items into Vega App 6 categories
  const categoryFilteredItems = watchlistedItems.filter(item => {
    if (vegaCategory === 'all') return true;
    if (vegaCategory === 'watching') {
      return progressFor(item) && !complete(progressFor(item));
    }
    if (vegaCategory === 'completed') {
      return complete(progressFor(item));
    }
    if (vegaCategory === 'plantowatch') {
      return !progressFor(item);
    }
    return true;
  });

  const finalFilteredItems = categoryFilteredItems.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  // Calculate Vega Statistics
  const totalWatchedSeconds = continueWatching.reduce((acc, cw) => acc + (cw.progress_seconds || 0), 0);
  const totalWatchedHours = (totalWatchedSeconds / 3600).toFixed(1);
  const completedCount = continueWatching.filter(complete).length;

  const handleExportBackup = async () => {
    try {
      const backup = await api.exportVegaBackup({
        watchlist,
        continueWatching,
        downloads: [], providerOrder: JSON.parse(localStorage.getItem('mp_vega_provider_order') || '[]'), settings: {}
      });
      if (backup) {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vega_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setBackupSuccess('Vega backup exported and saved to your device!');
        setTimeout(() => setBackupSuccess(null), 3500);
      }
    } catch {
      setBackupError('Failed to generate backup payload');
      setTimeout(() => setBackupError(null), 3500);
    }
  };

  const handleImportBackup = async () => {
    try {
      if (!restoreConfirmed) throw new Error('Confirm that this replaces the local library first.');
      if (api.user) throw new Error('Sign out before restoring a local library. This restore does not overwrite an account library.');
      if (!importJsonText.trim()) return;
      const parsed = JSON.parse(importJsonText);
      const res = await api.importVegaBackup(parsed);
      if (res.success) {
        if (!Array.isArray(res.data.watchlist) || res.data.watchlist.some(id => typeof id !== 'string') || !Array.isArray(res.data.continueWatching) || res.data.continueWatching.some(entry => !entry || typeof entry !== 'object' || typeof entry.content_id !== 'string')) throw new Error('The backup contains invalid library records.');
        localStorage.setItem('mp_watchlist', JSON.stringify(res.data.watchlist));
        localStorage.setItem('mp_continue_watching', JSON.stringify(res.data.continueWatching));
        if (Array.isArray(res.data.providerOrder) && res.data.providerOrder.every(id => typeof id === 'string')) localStorage.setItem('mp_vega_provider_order', JSON.stringify(res.data.providerOrder));
        onLibraryRestored?.();
        setBackupSuccess(`Backup restored successfully! ${res.restoredItems.watchlistCount} watchlists, ${res.restoredItems.historyCount} history items recovered.`);
        setImportJsonText('');
        setTimeout(() => setBackupSuccess(null), 4000);
      }
    } catch (err) {
      setBackupError(err.message || 'Invalid Vega JSON format');
      setTimeout(() => setBackupError(null), 4000);
    }
  };

  const handleClearCache = () => {
    localStorage.removeItem('mp_cache_segments');
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  return (
    <div className="library-view-container">
      {/* Library Header */}
      <div className="library-header">
<PageHeading eyebrow="Personal collection" title="Your library" description="Saved titles, viewing history, and a backup of your collection." />

        {/* Sub-Tabs */}
        <div className="library-tabs-bar" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            className={`lib-tab-btn ${activeSubTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('watchlist')}
          >
            <Heart size={16} />
            <span>Library</span>
            <span className="lib-tab-counter">{watchlistedItems.length}</span>
          </button>

          <button
            className={`lib-tab-btn ${activeSubTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('history')}
          >
            <History size={16} />
            <span>Watch History</span>
            <span className="lib-tab-counter">{continueWatching.length}</span>
          </button>

          <button
            className={`lib-tab-btn ${activeSubTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('stats')}
          >
            <BarChart3 size={16} />
            <span>Viewing activity</span>
          </button>

          <button
            className={`lib-tab-btn ${activeSubTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('backup')}
          >
            <FolderSync size={16} />
            <span>Backup</span>
          </button>
        </div>
      </div>

      {/* WATCHLIST TAB */}
      {activeSubTab === 'watchlist' && (
        <div className="watchlist-tab-content">
          {/* Vega 6-tier Categories (matching packages/vega-app Library.tsx) */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
            {[
              { id: 'all', label: 'All', count: watchlistedItems.length },
              { id: 'watching', label: 'Watching', count: watchlistedItems.filter(item => progressFor(item) && !complete(progressFor(item))).length },
              { id: 'plantowatch', label: 'Plan to Watch', count: watchlistedItems.filter(item => !progressFor(item)).length },
              { id: 'completed', label: 'Completed', count: watchlistedItems.filter(item => complete(progressFor(item))).length }
            ].map(cat => (
              <button key={cat.id} onClick={() => setVegaCategory(cat.id)} className={`type-chip ${vegaCategory === cat.id ? 'active' : ''}`} aria-pressed={vegaCategory === cat.id}>
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          <div className="watchlist-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="lib-filter-chips">
              <button
                className={`type-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All Content ({finalFilteredItems.length})
              </button>
              <button
                className={`type-chip ${filterType === 'movie' ? 'active' : ''}`}
                onClick={() => setFilterType('movie')}
              >
                <Film size={14} /> Movies ({finalFilteredItems.filter(i => i.type === 'movie').length})
              </button>
              <button
                className={`type-chip ${filterType === 'series' ? 'active' : ''}`}
                onClick={() => setFilterType('series')}
              >
                <Tv size={14} /> Series ({finalFilteredItems.filter(i => i.type === 'series').length})
              </button>
            </div>
          </div>

          {finalFilteredItems.length > 0 ? (
            <div className="content-cards-grid">
              {finalFilteredItems.map(item => (
                <ContentCard
                  key={item.id}
                  item={item}
                  currentCountry={currentCountry}
                  onPlay={onPlay}
                  onToggleWatchlist={onToggleWatchlist}
                  isWatchlisted={true}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          ) : (
            <div className="empty-lib-card glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Heart size={48} className="empty-lib-icon text-muted" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#e2e8f0' }}>No titles in this category</h3>
              <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '14px' }}>
                Browse our streaming catalog and click the heart icon on any movie or TV series.
              </p>
              <button className="btn btn-primary" onClick={onNavigateHome}>
                Explore Featured Movies & Series
              </button>
            </div>
          )}
        </div>
      )}

      {/* WATCH HISTORY TAB */}
      {activeSubTab === 'history' && (
        <div className="history-tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>
              Showing {continueWatching.length} playback sessions
            </span>
            {continueWatching.length > 0 && (
              <button
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={onClearHistory}
              >
                <Trash2 size={14} /> Clear All History
              </button>
            )}
          </div>

          {continueWatching.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {continueWatching.map((item, idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{ borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => onPlay(item)}
                >
                  <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                    <Artwork src={item.backdrop_url || item.poster_url} title={item.title} kind="backdrop" />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="play-splash-circle" style={{ width: '48px', height: '48px' }}>
                        <Play size={20} fill="#ffffff" />
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.2)' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, item.percentage || 0))}%`, background: 'var(--color-accent)' }} />
                    </div>
                  </div>

                  <div style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>{item.title}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 600 }}>{item.percentage || 0}%</span>
                    </div>
                    {item.episode_title && (
                      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#94a3b8' }}>{item.episode_title}</p>
                    )}
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {Math.floor((item.progress_seconds || 0) / 60)}m / {Math.floor((item.duration_seconds || 0) / 60)}m watched
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-lib-card glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <History size={48} className="empty-lib-icon text-muted" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#e2e8f0' }}>No Watch History</h3>
              <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '14px' }}>
                Your watched videos, timestamps, and episode checkpoints will automatically synchronize here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* STATS & ANALYTICS TAB */}
      {activeSubTab === 'stats' && (
        <div className="stats-tab-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Saved playback progress</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9' }}>{totalWatchedHours} hrs</div>
              <p className="metric-description">Positions recorded by the player</p>
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Completed Titles</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9' }}>{completedCount}</div>
              <p className="metric-description">At least 90% reached</p>
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Active Watchlist Size</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9' }}>{watchlistedItems.length}</div>
              <p className="metric-description">Titles in this library</p>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP & STORAGE TAB (matching packages/vega-app backup.ts and clearAppCache.ts) */}
      {activeSubTab === 'backup' && (
        <div className="backup-tab-content">
          {backupSuccess && (
            <div role="status" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '12px 18px', borderRadius: '10px', color: '#34d399', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> <span>{backupSuccess}</span>
            </div>
          )}
          {backupError && (
            <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '12px 18px', borderRadius: '10px', color: '#f87171', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> <span>{backupError}</span>
            </div>
          )}

          <div className="library-backup-grid">
            {/* Export & Diagnostics */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', marginBottom: '8px' }}>
                <Download size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Export Vega Backup</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
                Export saved title IDs, playback checkpoints, and provider order. Movie files and account credentials are excluded.
              </p>
              <button className="btn btn-primary" onClick={handleExportBackup} style={{ width: '100%' }}>
                <Download size={16} /> Export Vega JSON Backup
              </button>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '24px 0 16px' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '8px' }}>
                <HardDrive size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Storage & Cache Diagnostics</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '16px' }}>
                Remove the local segment-cache entry without changing your saved titles or account.
              </p>
              <button
                className="btn btn-outline"
                onClick={handleClearCache}
                style={{ width: '100%', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
              >
                {cacheCleared ? '✓ Segment Cache Emptied!' : 'Clear Stream Buffers & Cache'}
              </button>
            </div>

            {/* Import & Restore */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', marginBottom: '8px' }}>
                <Upload size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Restore from Vega Backup</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '14px' }}>
                Paste a compatible backup, then confirm replacement of this device’s local library. Sign out before restoring; this does not replace an account library.
              </p>
              <textarea
                aria-label="Library backup JSON"
                value={importJsonText}
                onChange={e => setImportJsonText(e.target.value)}
                placeholder='Paste Vega backup JSON here... {"version": 1, "data": {...}}'
                style={{
                  width: '100%',
                  height: '140px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '10px',
                  marginBottom: '16px',
                  resize: 'none',
                  outline: 'none'
                }}
              />
              <label className="restore-confirmation"><input type="checkbox" checked={restoreConfirmed} onChange={event => setRestoreConfirmed(event.target.checked)} /> Replace this device’s local watchlist and playback history with the backup</label>
              <button
                className="btn btn-outline"
                onClick={handleImportBackup}
                disabled={!importJsonText.trim() || !restoreConfirmed || !!api.user}
                style={{ width: '100%' }}
              >
                <Upload size={16} /> Validate & Restore Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
