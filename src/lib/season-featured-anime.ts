import { getPersistentCache } from "./server/persistent-cache";

type AniListAnime = {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  popularity: number;
};
type AniListResponse = {
  data?: { Page?: { pageInfo?: { hasNextPage: boolean }; media?: AniListAnime[] } };
  errors?: Array<{ message?: string }>;
};
export type SeasonalAnime = { id: number; title: string; cover: string; tint: string; popularity: number };
type SeasonalResult = { season: { season: string; year: number }; anime: SeasonalAnime[] };
const ANILIST_ENDPOINT = "https://graphql.anilist.co";
function getCurrentSeason(date: Date) {
  const month = date.getUTCMonth() + 1;
  if (month === 12) return { season: "WINTER", year: date.getUTCFullYear() + 1 };
  if (month <= 2) return { season: "WINTER", year: date.getUTCFullYear() };
  if (month <= 5) return { season: "SPRING", year: date.getUTCFullYear() };
  if (month <= 8) return { season: "SUMMER", year: date.getUTCFullYear() };
  return { season: "FALL", year: date.getUTCFullYear() };
}
export async function getSeasonFeaturedAnime() {
  const current = getCurrentSeason(new Date());
  return getPersistentCache<SeasonalResult>("season-featured", current, 3600, async () => {
    const allMedia: AniListAnime[] = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: `query SeasonalAnime($season: MediaSeason!, $year: Int!, $page: Int!) {
            Page(page: $page, perPage: 50) {
              pageInfo { hasNextPage }
              media(type: ANIME, season: $season, seasonYear: $year, status: RELEASING, isAdult: false, sort: POPULARITY_DESC) {
                id title { romaji english } coverImage { extraLarge large color } bannerImage format popularity
              }
            }
          }`,
          variables: { season: current.season, year: current.year, page },
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
      const payload = await response.json() as AniListResponse;
      if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
      const pageData = payload.data?.Page;
      if (!pageData || !Array.isArray(pageData.media)) throw new Error("AniList returned an invalid seasonal anime response.");
      allMedia.push(...pageData.media);
      hasNextPage = pageData.pageInfo?.hasNextPage ?? false;
      page += 1;
    }
    const anime = allMedia.map((item) => ({
      id: item.id, title: item.title.romaji || item.title.english || "Untitled",
      cover: item.coverImage.extraLarge || item.coverImage.large || item.bannerImage || "",
      tint: item.coverImage.color || "#ec4899", popularity: item.popularity,
    })).filter((item) => Boolean(item.cover));
    return { season: current, anime };
  });
}
