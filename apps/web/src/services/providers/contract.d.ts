export interface Media {
  id: string;
  title: string;
  type: 'movie' | 'series';
  episode?: { id: string; title?: string; addon_video_id?: string; provider_link?: string };
}
export interface Stream {
  id: string;
  provider: string;
  content_id: string;
  episode_id: string | null;
  url: string;
  format: 'mp4' | 'webm' | 'm3u8' | 'mpd' | 'video';
  quality: string | null;
  provenance: string;
}
export interface ProviderAdapter {
  id: string;
  kind: 'vega' | 'stremio';
  search(query: string, options?: { signal?: AbortSignal }): Promise<unknown[]>;
  getStreams(media: Media, options?: { signal?: AbortSignal; link?: string }): Promise<Stream[]>;
}
