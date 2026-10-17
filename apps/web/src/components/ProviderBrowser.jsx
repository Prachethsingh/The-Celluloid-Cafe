import { useEffect, useRef, useState } from 'react';
import { createVegaAdapter } from '../services/providers/vegaAdapter';
import { Feedback, LoadingState, EmptyState } from './ui';

const list = value => Array.isArray(value) ? value : [];
const keyFor = async (provider, link) => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(link)));
  return `vega:${provider}:${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

export default function ProviderBrowser({ providers, disabledProviders, onPlay }) {
  const [provider, setProvider] = useState(providers[0]?.value || 'vega');
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState('posts');
  const [selection, setSelection] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [queried, setQueried] = useState(false);
  const invocation = useRef(null);
  const disabled = disabledProviders.includes(provider);

  useEffect(() => () => invocation.current?.abort(), []);
  const chooseProvider = value => {
    invocation.current?.abort();
    setProvider(value);
    setQueried(false);
    setCategories([]); setFilter(''); setQuery(''); setPosts([]); setSelection(null); setEpisodes([]); setError(''); setStatus('idle'); setPage(1);
  };
  const currentProvider = providers.find(item => item.value === provider);
  const supports = module => !currentProvider?.modules || currentProvider.modules.includes(module);

  const run = async (operation, args, receive) => {
    invocation.current?.abort();
    const controller = new AbortController(); invocation.current = controller;
    setError(''); setStatus('loading');
    try {
      const result = await createVegaAdapter(provider).execute(operation, args, { signal: controller.signal });
      if (!controller.signal.aborted) { receive(result); setStatus('ready'); }
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure.message || 'Provider operation failed.'); setStatus('error'); }
    }
  };
  const loadCatalog = () => run('catalog', {}, result => {
    const entries = [...list(result?.catalog), ...list(result?.genres)].filter(entry => typeof entry?.title === 'string' && typeof entry.filter === 'string');
    setCategories(entries); setFilter(entries[0]?.filter || '');
  });
  const loadPosts = (operation, nextPage = 1) => {
    setSelection(null); setEpisodes([]); setPosts([]);
    return run(operation, { filter, searchQuery: query.trim(), page: nextPage }, result => {
      setPosts(list(result).filter(post => typeof post?.title === 'string' && typeof post.link === 'string'));
      setQueried(true);
      setMode(operation); setPage(nextPage);
    });
  };
  const openPost = post => {
    setSelection(null); setEpisodes([]);
    return run('meta', { link: post.link }, meta => {
      if (!meta || typeof meta.title !== 'string') throw new Error('This provider returned no title metadata.');
      setSelection({ post, meta });
    });
  };
  const play = async (link, index) => {
    if (!selection || !link?.link || !onPlay) return;
    const { post, meta } = selection;
    const series = meta.type === 'series';
    onPlay({
      id: await keyFor(provider, post.link), title: meta.title, type: series ? 'series' : 'movie',
      description: meta.synopsis || '', poster_url: meta.poster || meta.image || post.image,
      provider, provider_link: link.link, provider_page_link: post.link,
      imdb_id: meta.imdbId, tmdb_id: meta.tmdbId,
      ...(series ? { episode: { id: await keyFor(provider, link.link), title: link.title || `Episode ${index + 1}`, provider_link: link.link } } : {}),
    });
  };
  const busy = status === 'loading';
  return <section className="provider-browser" aria-label="Browse provider titles">
    <p>Select a provider, browse its catalog or search, then choose a title and playback link. Results come directly from that provider.</p>
    <label>Browse provider<select aria-label="Browse provider" value={provider} onChange={event => chooseProvider(event.target.value)}>
      {providers.map(item => <option key={item.value} value={item.value}>{item.name}{item.built === false ? ' (not built)' : ''}</option>)}
    </select></label>
    {disabled && <p role="status">This provider is disabled. Enable it in All Providers to browse.</p>}
    {!supports('catalog') && <p>This provider resolves streams only. It is used for compatible catalog titles with a confirmed identity.</p>}
    {providers.find(item => item.value === provider)?.disabled && <p>Upstream marks this provider disabled; its service may be unavailable.</p>}
    <div className="provider-browser-actions">
      <button className="btn btn-outline" disabled={busy || disabled || !supports('catalog')} onClick={loadCatalog}>Load categories</button>
      <label>Category<select aria-label="Provider category" value={filter} onChange={event => setFilter(event.target.value)} disabled={busy || !categories.length}>
        {categories.map((category, index) => <option key={`${index}:${category.filter}`} value={category.filter}>{category.title}</option>)}
      </select></label>
      <button className="btn btn-outline" disabled={busy || disabled || !categories.length} onClick={() => loadPosts('posts')}>Browse titles</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); if (query.trim() && !busy && !disabled) loadPosts('search'); }} className="provider-browser-actions">
      <label>Search this provider<input aria-label="Search this provider" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} /></label>
      <button className="btn btn-primary" disabled={busy || disabled || !query.trim() || !supports('posts')}>Search titles</button>
    </form>
    {busy && <LoadingState label="Loading provider response…" />}
    {error && <Feedback tone="error">{error} Browser access, provider availability, or native verification may prevent this operation.</Feedback>}
    {!busy && !error && !queried && !!categories.length && <Feedback>Categories are ready. Choose one and select Browse titles.</Feedback>}
    {status === 'ready' && queried && !posts.length && !selection && <EmptyState title="No titles returned" description="Choose a different category or try another search." />}
    {!selection && <ul className="provider-posts">{posts.map(post => <li key={post.link}><button className="btn btn-outline" disabled={busy} onClick={() => openPost(post)}>{post.title}</button></li>)}</ul>}
    {!!posts.length && !selection && <div className="provider-browser-actions">
      <button className="btn btn-outline" disabled={busy || page <= 1} onClick={() => loadPosts(mode, page - 1)}>Previous page</button>
      <span>Page {page}</span><button className="btn btn-outline" disabled={busy} onClick={() => loadPosts(mode, page + 1)}>Next page</button>
    </div>}
    {selection && <article>
      <button className="btn btn-outline" onClick={() => { invocation.current?.abort(); setSelection(null); setEpisodes([]); setError(''); setStatus('ready'); }}>Back to provider titles</button>
      <h3>{selection.meta.title}</h3><p>{selection.meta.synopsis}</p>
      {list(selection.meta.linkList).map((group, index) => <section key={`${index}:${group.title}`}>
        <h4>{group.title || 'Playback links'}</h4>
        {list(group.directLinks).map((link, position) => <button className="btn btn-primary" key={`${position}:${link.link}`} onClick={() => play(link, position)}>Play {link.title || 'title'}</button>)}
        {group.episodesLink && <button className="btn btn-outline" disabled={busy} onClick={() => run('episodes', { url: group.episodesLink }, result => setEpisodes(list(result)))}>Load episodes for {group.title || 'season'}</button>}
      </section>)}
      {episodes.map((episode, index) => <button className="btn btn-primary" key={`${index}:${episode.link}`} onClick={() => play(episode, index)}>Play {episode.title || `Episode ${index + 1}`}</button>)}
      {!list(selection.meta.linkList).length && <p>This provider returned no playback links for this title.</p>}
    </article>}
  </section>;
}
