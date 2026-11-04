import { isAnimeCandidateMatch, type PosterFormat } from "./poster-fallback";

export interface FallbackAnimeMedia {
  id: string;
  title?: { romaji?: string | null; english?: string | null };
  description?: string | null;
  genres?: string[];
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  studios?: { nodes?: { name: string }[] };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface JikanAnime {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  synopsis?: string | null;
  genres?: { name: string }[];
  year?: number | null;
  type?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: string | null;
  studios?: { name: string }[];
  images?: {
    webp?: { large_image_url?: string; image_url?: string };
    jpg?: { large_image_url?: string; image_url?: string };
  };
}

const BASE_URL = "https://api.jikan.moe/v4";
const MIN_INTERVAL = 1100;
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, FallbackAnimeMedia | null>();
const pending = new Map<string, Promise<FallbackAnimeMedia | null>>();

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeFormat(value?: string | null): string {
  if (value === "Movie") return "MOVIE";
  if (value === "TV") return "TV";
  if (value === "OVA") return "OVA";
  if (value === "ONA") return "ONA";
  if (value === "Special") return "SPECIAL";
  if (value === "Music") return "MUSIC";
  return "UNKNOWN";
}

function durationMinutes(value?: string | null): number | undefined {
  const match = value?.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : undefined;
}

function toMedia(item: JikanAnime): FallbackAnimeMedia {
  const cover = item.images?.webp?.large_image_url
    || item.images?.jpg?.large_image_url
    || item.images?.webp?.image_url
    || item.images?.jpg?.image_url;
  return {
    id: `mal-${item.mal_id}`,
    title: { romaji: item.title || null, english: item.title_english || null },
    description: item.synopsis || null,
    genres: item.genres?.map((genre) => genre.name) ?? [],
    startDate: item.year ? { year: item.year } : null,
    format: normalizeFormat(item.type),
    status: item.status === "Finished Airing" ? "FINISHED"
      : item.status === "Currently Airing" ? "RELEASING"
      : item.status === "Not yet aired" ? "NOT_YET_RELEASED" : "UNKNOWN",
    episodes: item.episodes ?? undefined,
    duration: durationMinutes(item.duration),
    studios: { nodes: item.studios?.map((studio) => ({ name: studio.name })) ?? [] },
    coverImage: cover ? { extraLarge: cover, large: cover } : undefined,
  };
}

/**
 * Resolve a title against Jikan only after AniList has no trustworthy match.
 * Candidate titles are checked before returning data so SEARCH_MATCH cannot
 * silently open an unrelated anime.
 */
export function fetchFallbackAnime(
  title: string,
  format?: PosterFormat,
): Promise<FallbackAnimeMedia | null> {
  const query = title.trim();
  if (!query) return Promise.resolve(null);
  const key = query.toLocaleLowerCase("en") + "::" + (format || "");
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const existing = pending.get(key);
  if (existing) return existing;

  const task = queue.then(async () => {
    const delay = MIN_INTERVAL - (Date.now() - lastRequestAt);
    if (delay > 0) await wait(delay);
    lastRequestAt = Date.now();

    const url = new URL(`${BASE_URL}/anime`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");
    if (format === "MOVIE") url.searchParams.set("type", "movie");
    if (format === "SERIES") url.searchParams.set("type", "tv");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const payload = await response.json() as { data?: JikanAnime[] };
      const candidates = Array.isArray(payload.data) ? payload.data : [];
      const match = candidates.find((item) => isAnimeCandidateMatch(
        query,
        format,
        { romaji: item.title, english: item.title_english, native: item.title_japanese },
        item.type,
      ));
      return match ? toMedia(match) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }).then((result) => {
    cache.set(key, result);
    return result;
  }).catch(() => {
    cache.set(key, null);
    return null;
  }).finally(() => pending.delete(key));

  pending.set(key, task);
  queue = task.then(() => undefined, () => undefined);
  return task;
}
