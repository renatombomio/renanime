import type { APIRoute } from "astro";

type AniListAnime = {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  popularity: number;
};

type AniListResponse = {
  data?: { Page?: { media?: AniListAnime[] } };
  errors?: Array<{ message?: string }>;
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const CACHE_SECONDS = 60 * 60;

function getCurrentSeason(date: Date) {
  const month = date.getUTCMonth() + 1;
  if (month === 12) return { season: "WINTER", year: date.getUTCFullYear() + 1 };
  if (month <= 2) return { season: "WINTER", year: date.getUTCFullYear() };
  if (month <= 5) return { season: "SPRING", year: date.getUTCFullYear() };
  if (month <= 8) return { season: "SUMMER", year: date.getUTCFullYear() };
  return { season: "FALL", year: date.getUTCFullYear() };
}

export const GET: APIRoute = async () => {
  const { season, year } = getCurrentSeason(new Date());

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query SeasonalFeaturedAnime($season: MediaSeason!, $year: Int!) {
          Page(page: 1, perPage: 5) {
            media(
              type: ANIME,
              season: $season,
              seasonYear: $year,
              status: RELEASING,
              isAdult: false,
              sort: POPULARITY_DESC
            ) {
              id
              title { romaji english }
              coverImage { extraLarge large color }
              bannerImage
              format
              popularity
            }
          }
        }`,
        variables: { season, year },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
    const payload = await response.json() as AniListResponse;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
    }

    const media = payload.data?.Page?.media;
    if (!Array.isArray(media)) throw new Error("AniList returned an invalid seasonal anime response.");

    const anime = media.map((item) => ({
      id: item.id,
      title: item.title.romaji || item.title.english || "Untitled",
      cover: item.coverImage.extraLarge || item.coverImage.large || item.bannerImage,
      tint: item.coverImage.color || "#ec4899",
      popularity: item.popularity,
    })).filter((item) => item.cover);

    return Response.json({ success: true, season: { name: season, year }, anime }, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` },
    });
  } catch (error) {
    console.error("[season-featured-anime] AniList request failed:", error);
    return Response.json(
      { success: false, error: "SEASON_FEATURED_ANIME_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
};
