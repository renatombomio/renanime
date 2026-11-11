import type { APIRoute } from "astro";
import { getSeasonFeaturedAnime } from "../../lib/season-featured-anime";

const CACHE_SECONDS = 60 * 60;

export const GET: APIRoute = async () => {
  try {
    const { season, anime } = await getSeasonFeaturedAnime();

    return Response.json({ success: true, season, anime }, {
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
