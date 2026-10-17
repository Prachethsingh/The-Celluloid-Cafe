// Demo fixtures must never masquerade as verified title artwork or availability.
export function cleanCatalogItem(item: any) {
  const demo = item.metadata_provenance === 'demo-seed' || !item.metadata_provenance;
  const clean = { ...item };
  if (demo) {
    clean.metadata_provenance = 'demo-seed';
    clean.poster_url = null; clean.backdrop_url = null;
    clean.artwork_provenance = 'unavailable';
    clean.rating = null; clean.rating_provenance = 'unverified';
    clean.availability = {}; clean.availability_verified = false;
    clean.availability_provenance = 'unverified';
    clean.cast = (Array.isArray(item.cast) ? item.cast : []).map((person: any) => ({ ...person, avatar: null }));
    clean.seasons = (Array.isArray(item.seasons) ? item.seasons : []).map((season: any) => ({ ...season, episodes: (Array.isArray(season.episodes) ? season.episodes : []).map((episode: any) => {
      const { stream_url, thumbnail_url, ...metadata } = episode;
      return { ...metadata, thumbnail_url: null };
    }) }));
    delete clean.trailer_url; delete clean.authorized_playback;
    delete clean.audio_tracks; delete clean.subtitles; delete clean.qualities;
  }
  delete clean.stream_url; delete clean.stream_url_webm;
  return clean;
}
