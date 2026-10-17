import { API_BASE } from './api';

let hostPromise;
const pending = new Map();
const encodeBytes = bytes => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
};

async function getText(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Vega request failed (${response.status})`);
  }
  return response.text();
}

async function handleRpc(provider, urls, operation, args) {
  const storageKey = `mp_vega_kv_${provider}`;
  const store = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
  const write = data => localStorage.setItem(storageKey, JSON.stringify(data));
  switch (operation) {
    case 'getBaseUrl': {
      const entry = urls[args.providerValue];
      if (!entry?.url) throw new Error(`No vendored URL for ${args.providerValue}`);
      return entry.url;
    }
    case 'kvGet': return store()[args.key];
    case 'kvSet': { const data = store(); data[args.key] = args.value; write(data); return null; }
    case 'kvDelete': { const data = store(); const existed = Object.hasOwn(data, args.key); delete data[args.key]; write(data); return existed; }
    case 'kvKeys': return Object.keys(store());
    case 'kvClear': write({}); return null;
    case 'getCookies': throw new Error('This provider needs cookie access that is unavailable in the web sandbox.');
    case 'openWebView': throw new Error('This provider needs native website verification. Select a web-compatible provider.');
    case 'crypto': {
      if (args.method === 'getRandomBytesAsync') {
        if (!Number.isInteger(args.byteCount) || args.byteCount < 1 || args.byteCount > 65536) throw new Error('Invalid random byte count');
        return encodeBytes(crypto.getRandomValues(new Uint8Array(args.byteCount)));
      }
      if (args.method !== 'digestStringAsync') throw new Error('Unsupported crypto operation');
      const bytes = new Uint8Array(await crypto.subtle.digest(args.algorithm, new TextEncoder().encode(args.data)));
      return args.options?.encoding === 'base64' ? encodeBytes(bytes) : Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    }
    case 'fetch': {
      const url = new URL(args.url);
      let response;
      // Use the exact URL map shipped with the compiled providers.
      if (url.hostname === 'raw.githubusercontent.com' && /^\/Zenda-Cross\/vega-providers\/(?:refs\/heads\/)?main\/urls\.json$/.test(url.pathname)) {
        response = new Response(JSON.stringify(urls), { headers: { 'Content-Type': 'application/json' } });
      } else {
        if (url.protocol !== 'https:') throw new Error('Provider requests must use HTTPS');
        const init = args.init || {};
        let body;
        if (init.body?.kind === 'text') body = init.body.value;
        if (init.body?.kind === 'base64') body = Uint8Array.from(atob(init.body.value), character => character.charCodeAt(0));
        response = await fetch(url, { method: init.method || 'GET', headers: init.headers, body, credentials: 'omit', redirect: init.redirect || 'follow', signal: AbortSignal.timeout(15000) });
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('Provider response exceeds the sandbox limit');
      return { status: response.status, statusText: response.statusText, url: response.url || args.url, headers: Array.from(response.headers.entries()), bodyBase64: encodeBytes(bytes) };
    }
    default: throw new Error(`Unsupported sandbox operation: ${operation}`);
  }
}

async function createHost() {
  const [runtime, urlsText] = await Promise.all([getText(`${API_BASE}/vega/runtime`), getText(`${API_BASE}/vega/urls`)]);
  const urls = JSON.parse(urlsText);
  const channel = crypto.randomUUID();
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'Vega provider sandbox';
  const send = message => frame.contentWindow.postMessage({ channel, message }, '*');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { window.removeEventListener('message', receive); frame.remove(); reject(new Error('Vega sandbox did not initialize')); }, 10000);
    const receive = async event => {
      if (event.source !== frame.contentWindow || event.data?.channel !== channel) return;
      const message = event.data.message;
      if (message?.type === 'ready') { clearTimeout(timer); resolve(); return; }
      const invocation = pending.get(message?.token);
      if (!invocation) return;
      if (message.type === 'result') {
        pending.delete(message.token);
        clearTimeout(invocation.timer);
        if (message.error) invocation.reject(new Error(message.error));
        else {
          localStorage.setItem(`mp_vega_state_${invocation.provider}`, JSON.stringify(message.state || {}));
          invocation.resolve(message.result);
        }
      } else if (message.type === 'rpc') {
        try { send({ type: 'rpc-result', token: message.token, id: message.id, result: await handleRpc(invocation.provider, urls, message.operation, message.args || {}) }); }
        catch (error) { send({ type: 'rpc-result', token: message.token, id: message.id, error: error.message }); }
      }
    };
    window.addEventListener('message', receive);
    const bootstrap = `window.ReactNativeWebView = {postMessage: function(value) {parent.postMessage({channel:${JSON.stringify(channel)},message:JSON.parse(value)}, '*')}};window.addEventListener('message', function(event) {if(event.source === parent && event.data.channel === ${JSON.stringify(channel)}) window.__sandboxReceive(JSON.stringify(event.data.message));});`;
    frame.srcdoc = `<script>${bootstrap}</script><script>${runtime.replace(/<\/script/gi, '<\\/script')}</script>`;
    document.body.appendChild(frame);
  });
  return { send };
}

const operations = {
  catalog: ['catalog', undefined],
  posts: ['posts', 'getPosts'],
  search: ['posts', 'getSearchPosts'],
  meta: ['meta', 'getMeta'],
  stream: ['stream', 'getStream'],
  episodes: ['episodes', 'getEpisodes'],
  settings: ['settings', 'getSettingsSchema'],
};

export async function executeVegaProvider(provider, operation, args = {}, { signal } = {}) {
  signal?.throwIfAborted();
  const definition = operations[operation];
  if (!definition) throw new Error('Unsupported provider operation');
  const [module, exportName] = definition;
  if (!hostPromise) hostPromise = createHost().catch(error => { hostPromise = null; throw error; });
  const [host, moduleCode] = await Promise.all([hostPromise, getText(`${API_BASE}/vega/providers/${encodeURIComponent(provider)}/modules/${module}`, signal)]);
  signal?.throwIfAborted();
  const token = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const complete = callback => value => { signal?.removeEventListener('abort', abort); callback(value); };
    const abort = () => { pending.delete(token); clearTimeout(timer); host.send({ type: 'cancel', token }); complete(reject)(signal.reason); };
    const timer = setTimeout(() => { pending.delete(token); host.send({ type: 'cancel', token }); complete(reject)(new Error('Provider execution timed out')); }, 30000);
    signal?.addEventListener('abort', abort, { once: true });
    pending.set(token, { provider, resolve: complete(resolve), reject: complete(reject), timer });
    host.send({ type: 'invoke', token, moduleCode, exportName: provider === 'moviesApi' && operation === 'stream' ? 'mpGetStream' : exportName, args: { ...args, providerValue: provider, provider, commonHeaders: {} }, state: JSON.parse(localStorage.getItem(`mp_vega_state_${provider}`) || '{}'), timeoutMs: 30000 });
  });
}
