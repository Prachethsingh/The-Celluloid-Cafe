const versionKey = 'mp_provider_defaults_v2';
export function readProviderList(key) {
  try {
    if (localStorage.getItem(versionKey) !== 'all-enabled') {
      localStorage.setItem('mp_disabled_vega_providers', '[]');
      localStorage.setItem(versionKey, 'all-enabled');
    }
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : [];
  } catch { return []; }
}