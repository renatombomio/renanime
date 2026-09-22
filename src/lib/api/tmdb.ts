export type TmdbMediaType = "tv" | "movie";

export interface TmdbArtwork {
  backdrop?: string;
  logo?: string;
  poster?: string;
}

interface TmdbSearchResult {
  id: number;
  name?: string;
  original_name?: string;
  title?: string;
  original_title?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface TmdbLogo {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
  width?: number;
  height?: number;
}

interface TmdbImagesResponse {
  logos?: TmdbLogo[];
  backdrops?: { file_path: string; vote_average?: number; width?: number }[];
}

const IMAGE_BASE = "https://image.tmdb.org/t/p";
const CACHE_PREFIX = "renanime:tmdb-artwork:";

function imageUrl(size: string, path?: string | null) {
  return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickSearchResult(results: TmdbSearchResult[], title: string) {
  const normalized = normalizeTitle(title);
  return [...results]
    .map((result) => {
      const candidates = [result.name, result.original_name, result.title, result.original_title]
        .filter(Boolean)
        .map((value) => normalizeTitle(value as string));
      const exact = candidates.includes(normalized) ? 100 : 0;
      const starts = candidates.some((value) => value.startsWith(normalized) || normalized.startsWith(value)) ? 25 : 0;
      return { result, score: exact + starts };
    })
    .sort((a, b) => b.score - a.score)[0]?.result;
}

function pickLogo(logos: TmdbLogo[]) {
  return [...logos]
    .filter((logo) => logo.file_path)
    .sort((a, b) => {
      const languageScore = (value?: string | null) => value === "en" ? 30 : value === null ? 20 : 0;
      return (
        languageScore(b.iso_639_1) - languageScore(a.iso_639_1) ||
        (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
        (b.width ?? 0) - (a.width ?? 0)
      );
    })[0];
}

export async function getTmdbArtwork(
  title: string,
  format: "SERIES" | "MOVIE" = "SERIES",
): Promise<TmdbArtwork | null> {
  if (typeof window === "undefined") return null;

  const cacheKey = `${CACHE_PREFIX}${format}:${title.toLowerCase()}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as TmdbArtwork;
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }

  try {
    const type: TmdbMediaType = format === "MOVIE" ? "movie" : "tv";
    const searchResponse = await fetch(
      `/api/tmdb/search/${type}?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`,
    );
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json() as TmdbSearchResponse;
    const match = pickSearchResult(searchData.results ?? [], title);
    if (!match) return null;

    const imagesResponse = await fetch(
      `/api/tmdb/${type}/${match.id}/images?language=en-US&include_image_language=en,null,ja`,
    );
    if (!imagesResponse.ok) return null;

    const images = await imagesResponse.json() as TmdbImagesResponse;
    const logo = pickLogo(images.logos ?? []);
    const artwork: TmdbArtwork = {
      backdrop: imageUrl("w1280", match.backdrop_path),
      poster: imageUrl("w780", match.poster_path),
      logo: imageUrl("original", logo?.file_path),
    };

    sessionStorage.setItem(cacheKey, JSON.stringify(artwork));
    return artwork;
  } catch {
    return null;
  }
}

export async function getTmdbArtworkBatch(
  entries: { title: string; format?: "SERIES" | "MOVIE" }[],
) {
  const results: Record<string, TmdbArtwork | null> = {};
  await Promise.all(
    entries.map(async (entry) => {
      results[entry.title] = await getTmdbArtwork(entry.title, entry.format ?? "SERIES");
    }),
  );
  return results;
}
