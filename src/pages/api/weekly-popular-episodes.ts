import type { APIRoute } from "astro";

type AniListMedia = {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  popularity: number;
  isAdult: boolean;
  countryOfOrigin: string | null;
};
type AiringSchedule = { episode: number; airingAt: number; media: AniListMedia };
type WeeklyEpisode = { animeId: number; title: string; banner: string | null; tint: string | null; format: string | null; episode: number; airingLabel: string | null; popularity: number };
type AniListResponse = { data?: { Page?: { pageInfo?: { hasNextPage?: boolean }; airingSchedules?: AiringSchedule[] } }; errors?: Array<{ message?: string }> };

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const MAX_PAGES = 3;
const CACHE_SECONDS = 60 * 60;

const QUERY = `
  query WeeklyPopularEpisodes($page: Int!, $from: Int!, $to: Int!) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, notYetAired: false, sort: TIME) {
        episode airingAt
        media { id title { romaji english } coverImage { large color } bannerImage format popularity isAdult countryOfOrigin }
      }
    }
  }
`;

function getPreviousUtcWeekRange(now: Date): { from: number; to: number } {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  const previousMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: Math.floor(previousMonday.getTime() / 1000), to: Math.floor(thisMonday.getTime() / 1000) };
}

function getDisplayTitle(media: AniListMedia): string { return media.title.romaji || media.title.english || "Untitled"; }

function getAiringLabel(airingAt: number, now: Date, lang: "es" | "en"): string | null {
  if (airingAt * 1000 <= now.getTime()) return null;
  const locale = lang === "en" ? "en-GB" : "es-ES";
  const date = new Date(airingAt * 1000);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Europe/Amsterdam" }).format(date);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Amsterdam" }).format(date);
  return `${weekday.charAt(0).toLocaleUpperCase(locale)}${weekday.slice(1)} ${time}`;
}

async function fetchAiringPage(page: number, from: number, to: number): Promise<AniListResponse> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { page, from, to } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload = await response.json() as AniListResponse;
  if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  if (!payload.data?.Page || !Array.isArray(payload.data.Page.airingSchedules)) throw new Error("AniList returned an invalid airing schedule response.");
  return payload;
}

export const GET: APIRoute = async ({ request }) => {
  const now = new Date();
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";
  const { from, to } = getPreviousUtcWeekRange(now);
  try {
    const schedules: AiringSchedule[] = [];
    let hasNextPage = true;
    for (let page = 1; page <= MAX_PAGES && hasNextPage; page += 1) {
      const payload = await fetchAiringPage(page, from, to);
      const result = payload.data!.Page!;
      schedules.push(...result.airingSchedules!);
      hasNextPage = Boolean(result.pageInfo?.hasNextPage);
    }
    if (schedules.length === 0) throw new Error("AniList returned no airing schedules for the current UTC week.");
    const byAnime = new Map<number, AiringSchedule>();
    for (const schedule of schedules) {
      if (!schedule.media || schedule.media.isAdult) continue;
      const previous = byAnime.get(schedule.media.id);
      if (!previous || schedule.episode > previous.episode) byAnime.set(schedule.media.id, schedule);
    }
    const episodes: WeeklyEpisode[] = [...byAnime.values()]
      .sort((a, b) => b.media.popularity - a.media.popularity)
      .slice(0, 5)
      .map((schedule) => ({
        animeId: schedule.media.id, title: getDisplayTitle(schedule.media),
        banner: schedule.media.bannerImage || schedule.media.coverImage?.large || null,
        tint: schedule.media.coverImage?.color || "#ec4899", format: schedule.media.format,
        episode: schedule.episode, airingLabel: getAiringLabel(schedule.airingAt, now, lang),
        popularity: schedule.media.popularity,
      }));
    return Response.json({ success: true, window: { from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString() }, episodes }, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600` },
    });
  } catch (error) {
    console.error("[weekly-popular-episodes] AniList request failed:", error);
    return Response.json({ success: false, error: "WEEKLY_POPULAR_EPISODES_UNAVAILABLE" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};
