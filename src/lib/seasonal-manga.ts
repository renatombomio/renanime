type AniListManga = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  description: string | null;
  volumes: number | null;
  staff: { edges: Array<{ role: string; node: { name: { full: string | null } } }> };
};

type AniListResponse = {
  data?: { Page?: { media?: AniListManga[] } };
  errors?: Array<{ message?: string }>;
};

export type SeasonalMangaItem = {
  id: number;
  title: string;
  author: string | null;
  cover: string | null;
  synopsis: string | null;
  volumes: number | null;
};

const ENDPOINT = "https://graphql.anilist.co";
const CACHE_MS = 60 * 60 * 1000;
let cache: { expiresAt: number; manga: SeasonalMangaItem | null } | null = null;

function cleanDescription(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/<br[^>]*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim() || null;
}

export async function getSeasonalManga(): Promise<SeasonalMangaItem | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.manga;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query SeasonalManga {
        Page(page: 1, perPage: 1) {
          media(type: MANGA, status: RELEASING, isAdult: false, sort: TRENDING_DESC) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            description(asHtml: false)
            volumes
            staff(perPage: 10, sort: RELEVANCE) {
              edges { role node { name { full } } }
            }
          }
        }
      }`,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload = await response.json() as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  }

  const item = payload.data?.Page?.media?.[0] ?? null;
  if (!item) {
    cache = { manga: null, expiresAt: Date.now() + CACHE_MS };
    return null;
  }

  const author = item.staff.edges.find((edge) => /story|art|author|original creator/i.test(edge.role));
  const manga: SeasonalMangaItem = {
    id: item.id,
    title: item.title.romaji || item.title.english || item.title.native || "Untitled",
    author: author?.node.name.full || null,
    cover: item.coverImage.extraLarge || item.coverImage.large || null,
    synopsis: cleanDescription(item.description),
    volumes: item.volumes,
  };

  cache = { manga, expiresAt: Date.now() + CACHE_MS };
  return manga;
}
