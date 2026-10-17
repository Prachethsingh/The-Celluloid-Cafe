import { useEffect, useRef, useState } from 'react';
import { connectAddon, createStremioAdapter, installedAddons, removeAddon, saveAddon } from '../services/providers/stremioAdapter';
import { Feedback, LoadingState, EmptyState } from './ui';

export default function AddonManager({ onPlay }) {
  const [addons, setAddons] = useState(installedAddons);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [queried, setQueried] = useState(false);
  const invocation = useRef(null);
  useEffect(() => () => invocation.current?.abort(), []);
  const addon = addons.find(entry => entry.id === selected);
  const catalogs = addon?.manifest.catalogs || [];
  const catalog = catalogs.find(entry => `${entry.type}:${entry.id}` === catalogId) || catalogs[0];
  const run = async action => {
    invocation.current?.abort();
    const controller = new AbortController(); invocation.current = controller;
    setBusy(true); setError(''); setMessage('');
    try { await action(controller.signal, () => !controller.signal.aborted); }
    catch (reason) { if (!controller.signal.aborted) setError(reason.message || 'The add-on operation failed.'); }
    finally { if (invocation.current === controller) setBusy(false); }
  };
  const choose = id => { invocation.current?.abort(); setBusy(false); setSelected(id); setCatalogId(''); setQuery(''); setItems([]); setDetails(null); setQueried(false); setError(''); setMessage(''); };
  const browse = () => run(async (signal, active) => {
    const results = await createStremioAdapter(addon).browse(catalog, { query, signal });
    if (active()) { setItems(results); setDetails(null); setQueried(true); }
  });
  return <section className="addon-workspace" aria-label="Stremio add-ons">
    <p className="page-description">Connect an add-on you trust using its HTTPS manifest. Requests go directly from your browser; the service must support browser access. Connections are stored on this device.</p>
    <form className="provider-browser-actions" onSubmit={event => { event.preventDefault(); run(async (signal, active) => {
      const connected = await connectAddon(url.trim(), signal);
      if (!active()) return;
      saveAddon(connected); setAddons(installedAddons()); setSelected(connected.id); setCatalogId(''); setQuery(''); setItems([]); setDetails(null); setQueried(false); setUrl(''); setMessage(`Connected ${connected.manifest.name}.`);
    }); }}><label>Add-on manifest URL<input type="url" required aria-label="Add-on manifest URL" placeholder="https://your-addon.example/manifest.json" value={url} onChange={event => setUrl(event.target.value)} /></label><button className="btn-primary" disabled={busy || !url.trim()}>Connect add-on</button></form>
    {error && <Feedback tone="error">{error} Check the service connection and browser access settings.</Feedback>}
    {message && <Feedback tone="success">{message}</Feedback>}
    {busy && <LoadingState label="Waiting for add-on response…" />}
    {!addons.length && !busy && <EmptyState title="No add-ons connected" description="Use a configured manifest from a media service you are permitted to access." />}
    {!!addons.length && <><ul className="provider-registry">{addons.map(entry => <li key={entry.id}><div><strong>{entry.manifest.name}</strong><p>{new URL(entry.url).hostname} · v{entry.manifest.version} · {entry.manifest.types.join(', ')}</p></div><div className="provider-row-actions"><button className="btn-secondary" disabled={busy} aria-pressed={selected === entry.id} onClick={() => choose(entry.id)}>Browse {entry.manifest.name}</button><button className="btn-secondary" disabled={busy} aria-label={`Remove ${entry.manifest.name}`} onClick={() => { removeAddon(entry.id); setAddons(installedAddons()); if (entry.id === selected) choose(''); }}>Remove</button></div></li>)}</ul></>}
    {addon && <div className="addon-catalog"><h3>{addon.manifest.name}</h3>{!details && catalogs.length ? <><div className="provider-browser-actions"><label>Add-on catalog<select aria-label="Add-on catalog" value={catalog ? `${catalog.type}:${catalog.id}` : ''} onChange={event => { setCatalogId(event.target.value); setQuery(''); setItems([]); setDetails(null); setQueried(false); }} disabled={busy}>{catalogs.map(entry => <option key={`${entry.type}:${entry.id}`} value={`${entry.type}:${entry.id}`}>{entry.name || entry.id} · {entry.type}</option>)}</select></label><button className="btn-secondary" disabled={busy || !catalog} onClick={browse}>Load add-on titles</button></div><form className="provider-browser-actions" onSubmit={event => { event.preventDefault(); browse(); }}><label>Search add-on catalog<input aria-label="Search add-on catalog" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} disabled={busy || !catalog?.extra.some(extra => extra.name === 'search')} /></label><button className="btn-secondary" disabled={busy || !query.trim() || !catalog?.extra.some(extra => extra.name === 'search')}>Search add-on</button></form></> : !details && <Feedback>This add-on provides streams without a browse catalog. It is queried for compatible confirmed title IDs.</Feedback>}
    {!details && <ul className="provider-posts">{items.map(item => <li key={item.id}><button className="btn-secondary" disabled={busy} onClick={() => run(async (signal, active) => { const result = await createStremioAdapter(addon).getMetadata(item, { signal }); if (active()) setDetails(result); })}>{item.title}</button></li>)}</ul>}
    {queried && !busy && !error && !items.length && <EmptyState title="No add-on titles returned" description="Try another catalog or search." />}
    {details && <article className="addon-title"><button className="btn-secondary" disabled={busy} onClick={() => setDetails(null)}>Back to add-on titles</button><h3>{details.item.title}</h3><p>{details.item.description}</p>{details.item.type === 'movie' ? <button className="btn-primary" onClick={() => onPlay(details.item)}>Find add-on playback source</button> : details.episodes.length ? <div className="addon-episodes">{details.episodes.map(episode => <button className="btn-secondary" key={episode.id} onClick={() => onPlay({ ...details.item, episode })}>Play {episode.title}</button>)}</div> : <Feedback>No episode identities were returned. CinePulse will not guess an episode.</Feedback>}</article>}
    </div>}
  </section>;
}
