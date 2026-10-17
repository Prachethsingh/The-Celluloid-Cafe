import type { Platform } from '../types/index.js';

export const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' }
];

export const PLATFORMS: Platform[] = [
  { id: 'netflix', name: 'Netflix', slug: 'netflix', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'prime', name: 'Prime Video', slug: 'prime-video', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'disney', name: 'Disney+', slug: 'disney', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'appletv', name: 'Apple TV+', slug: 'apple-tv', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'hbo', name: 'HBO', slug: 'hbo', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'max', name: 'Max (HBO)', slug: 'max', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'hulu', name: 'Hulu', slug: 'hulu', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'paramount', name: 'Paramount+', slug: 'paramount', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'peacock', name: 'Peacock', slug: 'peacock', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'crunchyroll', name: 'Crunchyroll', slug: 'crunchyroll', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'mgm', name: 'MGM+', slug: 'mgm', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'shudder', name: 'Shudder', slug: 'shudder', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'discovery', name: 'Discovery+', slug: 'discovery', logo_url: '', subscription_required: true, country_code: 'US', active: true },
  { id: 'hotstar', name: 'Disney+ / Hotstar', slug: 'hotstar', logo_url: '', subscription_required: true, country_code: 'IN', active: true },
  { id: 'zee5', name: 'Zee5', slug: 'zee5', logo_url: '', subscription_required: true, country_code: 'IN', active: true }
];