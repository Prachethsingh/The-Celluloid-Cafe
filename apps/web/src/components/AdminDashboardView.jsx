import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { PageHeading, Panel, DataTable, Feedback, LoadingState } from './ui';

export default function AdminDashboardView() {
  const [status, setStatus] = useState(null);
  const [sources, setSources] = useState([]);
  const [titles, setTitles] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [titleId, setTitleId] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [provenance, setProvenance] = useState('');
  const load = useCallback(() => Promise.all([api.getSystemStatus(), api.request('/admin/sources'), api.getAllContent()]).then(([health, result, catalog]) => {
      setStatus(health); setSources(result.sources); setTitles(catalog.filter(item => item.type === 'movie'));
      setTitleId(previous => previous || catalog.find(item => item.type === 'movie')?.id || '');
  }).catch(reason => setError(reason.message)).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);
  const synchronize = async () => {
    setBusy(true); setError(null); setMessage(null);
    try { const result = await api.triggerSync(); setMessage(`Synchronized ${result.synced_records} records.`); }
    catch (reason) { setError(reason.message); }
    finally { await load(); setBusy(false); }
  };
  const remove = async source => {
    setBusy(true); setError(null);
    try { await api.request('/admin/sources/' + encodeURIComponent(source.id), { method: 'DELETE' }); setMessage('Source removed.'); await load(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <div className="admin-view-container">
    <PageHeading eyebrow="Operations" title="Admin Dashboard" description="Monitor the catalog and manage the media sources available to viewers." actions={status && <button className="btn btn-outline" disabled={busy} onClick={synchronize}><RefreshCw size={16} />{busy ? 'Working…' : 'Synchronize catalog'}</button>} />
    {error && <Feedback tone="error">{error}</Feedback>}
    {message && <Feedback tone="success">{message}</Feedback>}
    {loading ? <LoadingState label="Loading operations…" /> : !status ? <Panel title="Administrator access required" description="Sign in with an administrator account to manage the catalog and sources."><p>Use Account to sign in, then reopen this workspace.</p></Panel> : <>
      <dl className="admin-metrics-grid">{[['Movies', status.movies_count], ['Series', status.series_count], ['Playback sources', status.sources_count]].map(([label, value]) => <div className="admin-metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="page-description">Database: {status.services.database}. Cache: {status.services.cache}. Catalog last refreshed: {status.catalog_last_synced_at ? new Date(status.catalog_last_synced_at).toLocaleString() : 'not yet synchronized'}.</p>
      <div className="admin-workspace">
        <Panel title="Synchronization activity" description="Results from actual upstream catalog requests.">
          <DataTable caption="Recent synchronization jobs" columns={[{ key: 'started_at', label: 'Started', render: row => <time dateTime={row.started_at}>{new Date(row.started_at).toLocaleString()}</time> }, { key: 'status', label: 'Status', render: row => <span className="status-label">{row.status}</span> }]} rows={status.jobs} emptyMessage="No synchronization jobs have run." />
        </Panel>
        <Panel title="Add a playback source" description="Choose a film and provide an accessible media URL and its origin.">
          <form className="admin-source-form" onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError(null); setMessage(null);
            const title = titles.find(item => item.id === titleId);
            try {
              if (!title) throw new Error('Select a catalog title first.');
              await api.request('/admin/sources', { method: 'POST', body: JSON.stringify({ content_id: titleId, type: title.type, url, format, provenance, name: `${title.title} source` }) });
              setMessage('Source saved.'); setUrl(''); setProvenance(''); await load();
            } catch (reason) { setError(reason.message); }
            finally { setBusy(false); }
          }}>
            <label>Title<select required value={titleId} onChange={event => setTitleId(event.target.value)}>{titles.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Media URL<input required value={url} placeholder="https://your-media-host/movie.mp4" onChange={event => setUrl(event.target.value)} /></label>
            <label>Format<select value={format} onChange={event => setFormat(event.target.value)}><option value="mp4">MP4</option><option value="webm">WebM</option><option value="m3u8">HLS</option><option value="mpd">DASH (adaptive engine required)</option></select></label>
            <label>Source origin<input required maxLength={500} value={provenance} placeholder="Where this media comes from" onChange={event => setProvenance(event.target.value)} /></label>
            <button className="btn btn-primary" disabled={busy || !titles.length}>Save source</button>
          </form>
        </Panel>
      </div>
      <Panel className="sources-panel" title="Configured playback sources" description="Sources are bound to their catalog titles; removing one makes it unavailable for new playback requests.">
        <DataTable caption="Configured playback sources" rows={sources} emptyMessage="No sources configured. Add the first source using the form above." columns={[{ key: 'name', label: 'Title source' }, { key: 'format', label: 'Format' }, { key: 'provenance', label: 'Origin' }, { key: 'actions', label: 'Action', render: row => <button className="btn btn-outline" disabled={busy} onClick={() => remove(row)}>Remove source</button> }]} />
      </Panel>
    </>}
  </div>;
}
