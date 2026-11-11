import type { APIRoute } from "astro";

type AniListMedia = {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  format: string | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  isAdult: boolean;
};

type AniListResponse = {
  data?: { Page?: { pageInfo?: { hasNextPage?: boolean }; media?: AniListMedia[] } };
  errors?: Array<{ message?: string }>;
};

export type UpcomingRelease = {
  id: number;
  title: string;
  poster: string | null;
  date: string;
  format: "SERIES" | "MOVIE";
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const MAX_PAGES = 3;
const CACHE_MS = 60 * 60 * 1000;
const SUPPORTED_FORMATS = ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA"];

let cached: { expiresAt: number; items: UpcomingRelease[] } | null = null;

const QUERY = `
  query UpcomingAnimeReleases($page: Int!, $from: FuzzyDateInt!, $to: FuzzyDateInt!, $formats: [MediaFormat!]) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      media(
        type: ANIME,
        status: NOT_YET_RELEASED,
        isAdult: false,
        format_in: $formats,
        startDate_greater: $from,
        startDate_lesser: $to,
        sort: START_DATE
      ) {
        id
        title { romaji english }
        coverImage { extraLarge large }
        format
        startDate { year month day }
        isAdult
      }
    }
  }
`;

function toFuzzyDate(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function toIsoDate(startDate: AniListMedia["startDate"]): string | null {
  const { year, month, day } = startDate;
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function fetchPage(page: number, from: number, to: number): Promise<AniListResponse> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { page, from, to, formats: SUPPORTED_FORMATS },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload = await response.json() as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  }
  if (!payload.data?.Page || !Array.isArray(payload.data.Page.media)) {
    throw new Error("AniList returned an invalid upcoming releases response.");
  }
  return payload;
}

export async function getUpcomingReleases(now = new Date()): Promise<UpcomingRelease[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 90);
  const from = toFuzzyDate(start);
  const to = toFuzzyDate(end);

  const allMedia: AniListMedia[] = [];
  let hasNextPage = true;

  for (let page = 1; page <= MAX_PAGES && hasNextPage; page += 1) {
    const payload = await fetchPage(page, from, to);
    const pageData = payload.data!.Page!;
    allMedia.push(...pageData.media!);
    hasNextPage = Boolean(pageData.pageInfo?.hasNextPage);
  }

  const seen = new Set<number>();
  const items = allMedia
    .filter((media) => !media.isAdult && media.format && SUPPORTED_FORMATS.includes(media.format))
    .map((media): UpcomingRelease | null => {
      const date = toIsoDate(media.startDate);
      if (!date) return null;
      const format = media.format === "MOVIE" ? "MOVIE" : "SERIES";
      return {
        id: media.id,
        title: media.title.romaji || media.title.english || "Untitled",
        poster: media.coverImage.extraLarge || media.coverImage.large || null,
        date,
        format,
      };
    })
    .filter((item): item is UpcomingRelease => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  cached = { items, expiresAt: Date.now() + CACHE_MS };
  return items;
}

export const GET: APIRoute = async () => {
  try {
    const items = await getUpcomingReleases();
    return Response.json({ success: true, items }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("[upcoming-releases] AniList request failed:", error);
    return Response.json(
      { success: false, error: "UPCOMING_RELEASES_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
};
