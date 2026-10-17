import { useState, useEffect, useRef } from 'react';
import { X, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { executeVegaProvider } from '../services/vegaSandbox';
import ProviderBrowser from './ProviderBrowser';
import AddonManager from './AddonManager';
import { useDialog } from '../hooks/useDialog';
import { readProviderList } from '../services/providerPreferences';

const readList = readProviderList;

export default function VegaProvidersModal({ isOpen, onClose, onPlay }) {
  const dialogRef = useDialog(onClose, isOpen);
  const [tab, setTab] = useState('list');
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [order, setOrder] = useState(() => readList('mp_vega_provider_order'));
  const [disabled, setDisabled] = useState(() => readList('mp_disabled_vega_providers'));
  const [pings, setPings] = useState({});
  const [pinging, setPinging] = useState(null);
  const [sandboxProvider, setSandboxProvider] = useState('vega');
  const [operation, setOperation] = useState('catalog');
  const [input, setInput] = useState('');
  const [sandboxType, setSandboxType] = useState('movie');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const execution = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.getVegaProviders().then(data => {
      if (!active) return;
      setProviders(data.providers); setError('');
      setOrder(previous => [...new Set([...previous.filter(key => data.providers.some(provider => provider.value === key)), ...data.providers.map(provider => provider.value)])]);
    }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; execution.current?.abort(); };
  }, [isOpen]);
  const toggle = provider => {
    const next = disabled.includes(provider) ? disabled.filter(value => value !== provider) : [...disabled, provider];
    setDisabled(next); localStorage.setItem('mp_disabled_vega_providers', JSON.stringify(next));
  };
  const move = (index, offset) => {
    const next = [...order]; const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); localStorage.setItem('mp_vega_provider_order', JSON.stringify(next));
  };
  const run = async () => {
    execution.current?.abort(); const controller = new AbortController(); execution.current = controller;
    setRunning(true); setResult(null);
    try {
      const data = await executeVegaProvider(sandboxProvider, operation, { type: sandboxType, link: input, url: input, filter: input, searchQuery: input, page: 1 }, { signal: controller.signal });
      if (!controller.signal.aborted) setResult({ data });
    } catch (reason) { if (!controller.signal.aborted) setResult({ error: reason.message }); }
    finally { if (execution.current === controller) setRunning(false); }
  };
  if (!isOpen) return null;
  const visible = providers.filter(provider => (category === 'all' || provider.type === category) && `${provider.name} ${provider.value}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="providers-heading" className="modal-container vega-modal" onClick={event => event.stopPropagation()}>
      <header className="providers-header"><div><p className="eyebrow">Playback & discovery</p><h2 id="providers-heading">Provider workspace</h2><p>{providers.length} Providers Loaded · {providers.filter(provider => provider.built).length} built</p></div><button className="modal-close-btn" onClick={onClose} aria-label="Close providers"><X size={20} /></button></header>
      <nav className="providers-tabs" aria-label="Provider workspace sections">{[['list', 'All Providers'], ['browse', 'Browse provider titles'], ['addons', 'Stremio add-ons'], ['order', 'Scraper Priority Order'], ['sandbox', 'Scraper Sandbox Runner']].map(([key, label]) => <button className={`type-chip ${tab === key ? 'active' : ''}`} key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <div className="modal-body providers-body">
        {error && <p role="alert">{error}</p>}
        {tab === 'browse' && <ProviderBrowser providers={providers} disabledProviders={disabled} onPlay={onPlay} />}
        {tab === 'addons' && <AddonManager onPlay={onPlay} />}
        {tab === 'list' && <>
          <div className="provider-browser-actions"><label>Find a provider<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Provider name" /></label><label>Region<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All regions</option>{[...new Set(providers.map(provider => provider.type))].map(type => <option key={type} value={type}>{type}</option>)}</select></label></div>
          <p className="page-description">Modules are bundled locally. Online results depend on the provider, browser access, and its verification requirements.</p>
          <button className="btn btn-primary" onClick={() => { localStorage.setItem('mp_disabled_vega_providers', '[]'); setDisabled([]); }}>Enable all providers</button>
          <p className="page-description">All providers are locally enabled by default. Automatic playback skips upstream-disabled modules, follows your priority order, and stops when a supported source is found.</p>
          <ul className="provider-registry">{visible.map(provider => <li key={provider.value}>
            <div><strong>{provider.name}</strong><span className="provider-version">v{provider.version}</span><p>{provider.type} · {provider.built ? 'Modules ready' : 'Build unavailable'}{provider.disabled ? ' · Upstream disabled' : ''}</p>{pings[provider.value] && <p>{pings[provider.value].status} · {pings[provider.value].latencyMs}ms</p>}</div>
            <div className="provider-row-actions"><button className="btn btn-outline" disabled={pinging === provider.value || disabled.includes(provider.value)} onClick={async () => {
              setPinging(provider.value); try { const response = await api.pingVegaProvider(provider.value); setPings(previous => ({ ...previous, [provider.value]: response })); } catch { setPings(previous => ({ ...previous, [provider.value]: { status: 'offline', latencyMs: 0 } })); } finally { setPinging(null); }
            }}>{pinging === provider.value ? <RefreshCw size={14} /> : 'Check connection'}</button><button className="btn btn-outline" aria-label={`${disabled.includes(provider.value) ? 'Enable' : 'Disable'} ${provider.name}`} onClick={() => toggle(provider.value)}>{disabled.includes(provider.value) ? 'Disabled' : 'Enabled'}</button></div>
          </li>)}</ul>
          {!visible.length && <p>No providers match these filters.</p>}
        </>}
        {tab === 'order' && <><p className="page-description">Set resolver priority. Only providers compatible with a title identity or its selected provider link are queried.</p><ol className="provider-registry">{order.map((key, index) => <li key={key}><span><span className="provider-version">{String(index + 1).padStart(2, '0')}</span>{providers.find(provider => provider.value === key)?.name || key}</span><div className="provider-row-actions"><button className="btn btn-outline" aria-label={`Move ${key} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button className="btn btn-outline" aria-label={`Move ${key} down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button></div></li>)}</ol></>}
        {tab === 'sandbox' && <>
          <p className="page-description">Run an original provider operation. Supply its URL, catalog filter, or search query where needed.</p>
          <div className="sandbox-form"><label>Provider<select aria-label="Provider" value={sandboxProvider} onChange={event => setSandboxProvider(event.target.value)}>{providers.map(provider => <option key={provider.value} value={provider.value}>{provider.name}</option>)}</select></label><label>Operation<select aria-label="Provider operation" value={operation} onChange={event => setOperation(event.target.value)}>{['catalog', 'posts', 'search', 'meta', 'episodes', 'stream', 'settings'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Content type<select value={sandboxType} onChange={event => setSandboxType(event.target.value)}><option value="movie">Movie</option><option value="series">Series</option></select></label><label>Provider input<input aria-label="Provider input" value={input} onChange={event => setInput(event.target.value)} placeholder="URL, filter, or search text" /></label></div>
          <button className="btn btn-primary" disabled={running} onClick={run}>{running ? 'Running…' : 'Run Scraper'}</button>
          {result && <div className="provider-result"><h3>{result.error ? 'Provider error' : 'Provider response'}</h3><pre role={result.error ? 'alert' : undefined}>{result.error || JSON.stringify(result.data, null, 2)}</pre></div>}
        </>}
      </div>
    </div>
  </div>;
}
