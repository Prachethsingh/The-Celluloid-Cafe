export interface Platform {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  website_url?: string;
  subscription_required: boolean;
  country_code: string;
  active: boolean;
}

export interface AvailabilityItem {
  platformId: string;
  platformName: string;
  available: boolean;
  subscription_type: 'subscription' | 'free' | 'rent' | 'buy';
  quality: number;
}

export interface CountryAvailability {
  [countryCode: string]: AvailabilityItem[];
}

export interface CastMember {
  name: string;
  role: string;
}

export interface Movie {
  id: string;
  title: string;
  original_title?: string;
  type: 'movie';
  year: number;
  release_date: string;
  runtime: number; // in minutes
  rating: number;
  rating_source: string;
  language: string;
  genres: string[];
  director: string;
  cast: CastMember[];
  poster_url: string;
  backdrop_url: string;
  trailer_url?: string;
  description: string;
  popularity: number;
  is_trending?: boolean;
  is_new?: boolean;
  availability: CountryAvailability;
  stream_url?: string;
}

export interface Episode {
  id: string;
  episode_number: number;
  title: string;
  runtime: number;
  description: string;
  release_date: string;
  thumbnail_url: string;
  stream_url?: string;
}

export interface Season {
  id: string;
  season_number: number;
  title: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  title: string;
  type: 'series';
  first_air_date: string;
  last_air_date?: string;
  rating: number;
  rating_source: string;
  language: string;
  genres: string[];
  creator: string;
  cast: CastMember[];
  poster_url: string;
  backdrop_url: string;
  description: string;
  popularity: number;
  is_trending?: boolean;
  seasons_count: number;
  seasons: Season[];
  availability: CountryAvailability;
}

export type ContentItem = Movie | Series;

export interface PlaybackSession {
  session_id: string;
  authorized: boolean;
  token: string;
  expires_at: string;
  expires_in: number;
  content_type: 'movie' | 'series' | 'episode';
  content_id: string;
  episode_id?: string;
  stream_url: string;
  hls_manifest_url: string;
  dash_manifest_url: string;
  qualities: Array<{
    quality: number;
    label: string;
    bandwidth: number;
    resolution: string;
    codecs: string;
  }>;
  subtitles: Array<{
    id: string;
    language_code: string;
    label: string;
    kind: string;
    url: string;
  }>;
  license_type: string;
}
