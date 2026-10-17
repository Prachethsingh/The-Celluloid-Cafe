export function episodeIdentity(item: any): { season: number; episode: number } | null {
  const encoded = String(item.episode_id || '').match(/^tt\d+:(\d+):(\d+)$/);
  const season = Number(encoded?.[1] ?? item.season_number);
  const episode = Number(encoded?.[2] ?? item.episode_number);
  return item.episode_id && Number.isInteger(season) && season >= 0 && Number.isInteger(episode) && episode > 0 ? { season, episode } : null;
}

export function seasonNumber(group: any): number | null {
  const explicit = group.season_number ?? group.season;
  const match = String(group.title || '').match(/\b(?:season\s*|s)(\d+)\b/i);
  const value = explicit ?? match?.[1];
  return value !== undefined && Number.isInteger(Number(value)) ? Number(value) : null;
}

export function matchesEpisode(entry: any, target: { season: number; episode: number }, groupSeason: number | null) {
  const title = String(entry.title || '');
  // Never interpret a multi-episode pack as one episode.
  if (/\b(?:episodes?|e)\s*\d+\s*[-–]\s*\d+/i.test(title)) return false;
  const pair = title.match(/\bs(\d+)\s*e(\d+)\b/i);
  const single = title.match(/\b(?:episode\s*|ep\.?\s*|e)(\d+)\b/i);
  const season = entry.season_number ?? entry.season ?? pair?.[1] ?? groupSeason;
  const episode = entry.episode_number ?? entry.episode ?? pair?.[2] ?? single?.[1];
  return season !== null && season !== undefined && Number(season) === target.season && Number(episode) === target.episode && typeof entry.link === 'string';
}