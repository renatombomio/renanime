import type { APIRoute } from "astro";

export const prerender = false;

type AniListCandidate = {
  id: number;
  popularity: number;
  status: string;
  seasonYear: number | null;
  title: { romaji: string | null; english: string | null };
};

type SavedSelection = {
  id: string;
  anilist_id: number;
  week_start: string;
  week_end: string;
  selection_source?: string;
  selection_reason?: string;
  source_rank?: number;
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
  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}

// Supabase secret keys are sent as apikey, not as a Bearer JWT.
async function supabaseRequest<T>(
  url: string,
  secretKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export const GET: APIRoute = async ({ request }) => {
  const cronSecret = import.meta.env.CRON_SECRET;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY;

  if (!cronSecret || !supabaseUrl || !supabaseSecretKey) {
    console.error("[anime-of-the-month] Missing CRON_SECRET, PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
    return Response.json({ success: false, error: "CRON_CONFIGURATION_MISSING" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const { start, end } = getMonthWindow(now);
  const selectionPath = `anime_of_the_week?select=id,anilist_id,week_start,week_end&week_start=eq.${start}&limit=1`;

  try {
    const existing = await supabaseRequest<SavedSelection[]>(supabaseUrl, supabaseSecretKey, selectionPath);
    if (existing[0]) {
      return Response.json({
        success: true,
        alreadySelected: true,
        month: { start, end },
        selection: existing[0],
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

    const inserted = await supabaseRequest<SavedSelection[]>(
      supabaseUrl,
      supabaseSecretKey,
      "anime_of_the_week?select=id,anilist_id,week_start,week_end,selection_source,selection_reason,source_rank",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          week_start: start,
          week_end: end,
          anilist_id: candidate.id,
          selection_source: "anilist",
          selection_reason: `Anime en emisión con mayor popularidad de la temporada ${season} ${year}.`,
          source_rank: 1,
        }),
      },
    );

    return Response.json({
      success: true,
      alreadySelected: false,
      month: { start, end },
      season: { name: season, year },
      selection: inserted[0],
      selectedAnime: {
        id: candidate.id,
        title: candidate.title.romaji || candidate.title.english || "Untitled",
        popularity: candidate.popularity,
      },
    });
  } catch (error) {
    // A duplicate month row means another invocation completed first; never overwrite it.
    if (error instanceof Error && /23505|duplicate key/i.test(error.message)) {
      try {
        const existing = await supabaseRequest<SavedSelection[]>(supabaseUrl, supabaseSecretKey, selectionPath);
        if (existing[0]) {
          return Response.json({ success: true, alreadySelected: true, month: { start, end }, selection: existing[0] });
        }
      } catch (lookupError) {
        console.error("[anime-of-the-month] Duplicate selection lookup failed:", lookupError);
      }
    }
    console.error("[anime-of-the-month] Monthly selection failed:", error);
    return Response.json({ success: false, error: "MONTHLY_ANIME_SELECTION_FAILED" }, { status: 502 });
  }
};
