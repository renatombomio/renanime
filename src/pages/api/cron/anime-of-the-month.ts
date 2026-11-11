import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

type AniListCandidate = {
  id: number;
  popularity: number;
  status: string;
  seasonYear: number | null;
  title: { romaji: string | null; english: string | null };
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

function getCurrentSeason(date: Date) {
  const month = date.getUTCMonth() + 1;
  if (month === 12) return { season: "WINTER", year: date.getUTCFullYear() + 1 };
  if (month <= 2) return { season: "WINTER", year: date.getUTCFullYear() };
  if (month <= 5) return { season: "SPRING", year: date.getUTCFullYear() };
  if (month <= 8) return { season: "SUMMER", year: date.getUTCFullYear() };
  return { season: "FALL", year: date.getUTCFullYear() };
}

function getMonthWindow(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const cronSecret = import.meta.env.CRON_SECRET;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY;

  if (!cronSecret || !supabaseUrl || !supabaseSecretKey) {
    console.error("[anime-of-the-month] Missing CRON_SECRET, PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
    return Response.json({ success: false, error: "CRON_CONFIGURATION_MISSING" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const { start, end } = getMonthWindow(now);
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: existing, error: existingError } = await supabase
      .from("anime_of_the_week")
      .select("id, anilist_id, week_start, week_end")
      .eq("week_start", start)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return Response.json({
        success: true,
        alreadySelected: true,
        month: { start, end },
        selection: existing,
      });
    }

    const { season, year } = getCurrentSeason(now);
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query MonthlyPopularAnime($season: MediaSeason!, $year: Int!) {
          Page(page: 1, perPage: 1) {
            media(
              type: ANIME,
              season: $season,
              seasonYear: $year,
              status: RELEASING,
              isAdult: false,
              sort: POPULARITY_DESC
            ) {
              id
              popularity
              status
              seasonYear
              title { romaji english }
            }
          }
        }`,
        variables: { season, year },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((item: { message?: string }) => item.message).filter(Boolean).join("; "));
    }

    const candidate = payload.data?.Page?.media?.[0] as AniListCandidate | undefined;
    if (!candidate?.id) throw new Error("AniList returned no currently airing anime for this season.");

    const { data: selection, error: insertError } = await supabase
      .from("anime_of_the_week")
      .insert({
        week_start: start,
        week_end: end,
        anilist_id: candidate.id,
        selection_source: "anilist",
        selection_reason: `Anime en emisión con mayor popularidad de la temporada ${season} ${year}.`,
        source_rank: 1,
      })
      .select("id, anilist_id, week_start, week_end, selection_source, selection_reason, source_rank")
      .single();

    if (insertError) {
      // A concurrent retry may have inserted this month's row after our initial check.
      if (insertError.code === "23505") {
        const { data: concurrentSelection, error: concurrentError } = await supabase
          .from("anime_of_the_week")
          .select("id, anilist_id, week_start, week_end")
          .eq("week_start", start)
          .maybeSingle();
        if (!concurrentError && concurrentSelection) {
          return Response.json({ success: true, alreadySelected: true, month: { start, end }, selection: concurrentSelection });
        }
      }
      throw insertError;
    }

    return Response.json({
      success: true,
      alreadySelected: false,
      month: { start, end },
      season: { name: season, year },
      selection,
      selectedAnime: {
        id: candidate.id,
        title: candidate.title.romaji || candidate.title.english || "Untitled",
        popularity: candidate.popularity,
      },
    });
  } catch (error) {
    console.error("[anime-of-the-month] Monthly selection failed:", error);
    return Response.json({ success: false, error: "MONTHLY_ANIME_SELECTION_FAILED" }, { status: 502 });
  }
};
