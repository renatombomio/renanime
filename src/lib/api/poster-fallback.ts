const ANILIST_BASE = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";
const KITSU_BASE = "https://kitsu.io/api/edge";
const MIN_REQUEST_INTERVAL = 700;

export type PosterFormat = "MOVIE" | "SERIES" | undefined;

interface Candidate {
  idMal?: number | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: string[];
  abbreviatedTitles?: string[];
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let lastRequestAt = 0;
let queue = Promise.resolve();

function normalizeTitle(value: string): string {
  return value.toLocaleLowerCase("en")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeTitle(value).split(/\s+/).filter((token) => token.length > 2));
}

function similarity(query: string, candidate: string): number {
  const wanted = tokens(query);
  const found = tokens(candidate);
  if (!wanted.size || !found.size) return 0;
  let overlap = 0;
  wanted.forEach((token) => { if (found.has(token)) overlap += 1; });
  return overlap / wanted.size;
}

function titleVariants(candidate: Candidate): string[] {
  return [
    candidate.title?.romaji,
    candidate.title?.english,
    candidate.title?.native,
    ...(candidate.synonyms ?? []),
    ...(candidate.abbreviatedTitles ?? []),
  ].filter(Boolean) as string[];
}

function formatMatches(format: PosterFormat, candidateFormat?: string | null): boolean {
  if (!format) return true;
  if (format === "MOVIE") return candidateFormat === "MOVIE" || candidateFormat === "Movie" || candidateFormat === "movie";
  return ["TV", "ONA", "ONAs", "SERIES", "TV_SHORT"].includes(String(candidateFormat).toUpperCase());
}

export function selectBestAnimeCandidate<T extends Candidate>(
  candidates: T[],
  requestedTitle: string,
  requestedFormat?: PosterFormat,
): T | null {
  const ranked = candidates
    .filter((candidate) => formatMatches(requestedFormat, candidate.format))
    .map((candidate) => {
      const titles = titleVariants(candidate);
      const exact = titles.some((title) => normalizeTitle(title) === normalizeTitle(requestedTitle));
      const score = exact ? 1 : Math.max(0, ...titles.map((title) => similarity(requestedTitle, title)));
      return { candidate, score, exact };
    })
    .filter((item) => item.exact || item.score >= 0.55)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score);

  return ranked[0]?.candidate ?? null;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestWithTimeout(url: URL, headers?: HeadersInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAniList(query: string, format?: PosterFormat): Promise<Candidate | null> {
  const gql = `query PosterSearch($search:String!,$perPage:Int!,$format:MediaFormat){Page(page:1,perPage:$perPage){media(search:$search,type:ANIME,format:$format,sort:SEARCH_MATCH){idMal title{romaji english native} synonyms format coverImage{extraLarge large}}}}`;
  try {
    const response = await fetch(ANILIST_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: query, perPage: 10, format: format === "MOVIE" ? "MOVIE" : undefined } }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const items = Array.isArray(payload?.data?.Page?.media) ? payload.data.Page.media : [];
    return selectBestAnimeCandidate(items, query, format);
  } catch {
    return null;
  }
}

async function requestJikanByMalId(idMal: number): Promise<string | null> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL) await wait(MIN_REQUEST_INTERVAL - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(`${JIKAN_BASE}/anime/${idMal}`);
  const response = await requestWithTimeout(url);
  if (!response?.ok) return null;

  try {
    const item = await response.json();
    return item?.data?.images?.webp?.large_image_url
      || item?.data?.images?.jpg?.large_image_url
      || item?.data?.images?.webp?.image_url
      || item?.data?.images?.jpg?.image_url
      || null;
  } catch {
    return null;
  }
}

async function requestJikan(query: string, format?: PosterFormat): Promise<string | null> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL) await wait(MIN_REQUEST_INTERVAL - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(JIKAN_BASE + "/anime");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  if (format === "MOVIE") url.searchParams.set("type", "movie");
  if (format === "SERIES") url.searchParams.set("type", "tv");

  const response = await requestWithTimeout(url);
  if (!response?.ok) return null;

  try {
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const candidates: Candidate[] = items.map((item: any) => ({
      idMal: item?.mal_id,
      title: { romaji: item?.title, english: item?.title_english, native: item?.title_japanese },
      synonyms: Array.isArray(item?.title_synonyms) ? item.title_synonyms : [],
      format: item?.type,
      coverImage: {
        extraLarge: item?.images?.webp?.large_image_url || item?.images?.jpg?.large_image_url,
        large: item?.images?.webp?.image_url || item?.images?.jpg?.image_url,
      },
    }));
    const item = selectBestAnimeCandidate(candidates, query, format);
    return item?.coverImage?.extraLarge || item?.coverImage?.large || null;
  } catch {
    return null;
  }
}

async function requestKitsu(query: string, format?: PosterFormat): Promise<string | null> {
  const url = new URL(KITSU_BASE + "/anime");
  url.searchParams.set("filter[text]", query);
  url.searchParams.set("page[limit]", "10");

  const response = await requestWithTimeout(url, { Accept: "application/vnd.api+json" });
  if (!response?.ok) return null;

  try {
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const candidates: Candidate[] = items.map((item: any) => {
      const a = item?.attributes;
      const subtype = String(a?.subtype || "").toUpperCase();
      return {
        title: { romaji: a?.canonicalTitle, english: a?.titles?.en, native: a?.titles?.ja_jp },
        abbreviatedTitles: Array.isArray(a?.abbreviatedTitles) ? a.abbreviatedTitles : [],
        format: subtype === "MOVIE" ? "MOVIE" : subtype === "TV" ? "TV" : subtype,
        coverImage: {
          extraLarge: a?.posterImage?.large || a?.posterImage?.original,
          large: a?.posterImage?.medium || a?.posterImage?.small,
        },
      };
    });
    const item = selectBestAnimeCandidate(candidates, query, format);
    return item?.coverImage?.extraLarge || item?.coverImage?.large || null;
  } catch {
    return null;
  }
}

export function isAnimeCandidateMatch(
  requestedTitle: string,
  requestedFormat: PosterFormat,
  candidateTitle?: Candidate["title"],
  candidateFormat?: string | null,
): boolean {
  return Boolean(selectBestAnimeCandidate(
    [{ title: candidateTitle, format: candidateFormat }],
    requestedTitle,
    requestedFormat,
  ));
}

async function resolvePoster(query: string, format?: PosterFormat): Promise<string | null> {
  // AniList is the primary catalogue. When it identifies the exact entry,
  // use its MAL id for Jikan instead of performing another title search.
  const aniList = await requestAniList(query, format);
  if (aniList?.coverImage?.extraLarge || aniList?.coverImage?.large) {
    return aniList.coverImage.extraLarge || aniList.coverImage.large || null;
  }

  if (aniList?.idMal) {
    const jikanById = await requestJikanByMalId(aniList.idMal);
    if (jikanById) return jikanById;
  }

  // Only fall back to Jikan title search when AniList could not identify the entry.
  const jikan = await requestJikan(query, format);
  if (jikan) return jikan;

  return requestKitsu(query, format);
}

export function fetchFallbackPoster(title: string, format?: PosterFormat): Promise<string | null> {
  const query = title.trim();
  if (!query) return Promise.resolve(null);

  const key = query.toLocaleLowerCase("en") + "::" + (format || "");
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const existing = pending.get(key);
  if (existing) return existing;

  const task = queue
    .then(() => resolvePoster(query, format))
    .then((poster) => {
      cache.set(key, poster);
      return poster;
    })
    .catch(() => {
      cache.set(key, null);
      return null;
    })
    .finally(() => pending.delete(key));

  pending.set(key, task);
  queue = task.then(() => undefined, () => undefined);
  return task;
}
