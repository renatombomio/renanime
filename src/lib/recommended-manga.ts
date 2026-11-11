type AniListManga = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  description: string | null;
  genres: string[];
  meanScore: number | null;
  averageScore: number | null;
  chapters: number | null;
  volumes: number | null;
  status: string | null;
  siteUrl: string;
};

type AniListResponse = {
  data?: { Page?: { media?: AniListManga[] } };
  errors?: Array<{ message?: string }>;
};

export type RecommendedManga = {
  id: number;
  title: string;
  cover: string;
  tint: string;
  description: string;
  genres: string[];
  score: number | null;
  chapters: number | null;
  volumes: number | null;
  status: string | null;
  siteUrl: string;
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
let cachedManga: { expiresAt: number; manga: RecommendedManga | null } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export async function getRecommendedManga(): Promise<RecommendedManga | null> {
  if (cachedManga && cachedManga.expiresAt > Date.now()) return cachedManga.manga;

  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query RecommendedManga {
        Page(page: 1, perPage: 1) {
          media(type: MANGA, format: MANGA, isAdult: false, sort: POPULARITY_DESC) {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            description(asHtml: false)
            genres
            meanScore
            averageScore
            chapters
            volumes
            status
            siteUrl
          }
        }
      }`,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload = await response.json() as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  }

  const item = payload.data?.Page?.media?.[0];
  const manga: RecommendedManga | null = item ? {
    id: item.id,
    title: item.title.romaji || item.title.english || item.title.native || "Untitled",
    cover: item.coverImage.extraLarge || item.coverImage.large || "",
    tint: item.coverImage.color || "#ec4899",
    description: (item.description || "").replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim(),
    genres: item.genres || [],
    score: item.meanScore ?? item.averageScore ?? null,
    chapters: item.chapters,
    volumes: item.volumes,
    status: item.status,
    siteUrl: item.siteUrl,
  } : null;

  cachedManga = { manga, expiresAt: Date.now() + CACHE_MS };
  return manga;
}
