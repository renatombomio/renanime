import type { AnimeEntry, AnimeFormat, AnimeStatus } from "../../types/anime";
import type { AnimeProvider, AnimeSearchOptions } from "../../types/api";

const ENDPOINT = "https://graphql.anilist.co";

const QUERY = `
query SearchAnime($search: String!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english }
      description(asHtml: false)
      genres
      startDate { year }
      format
      status
      episodes
      duration
      studios(isMain: true) { nodes { name } }
      coverImage { extraLarge large }
      bannerImage
    }
  }
}
`;

const BY_ID_QUERY = `
query AnimeById($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english }
    description(asHtml: false)
    genres
    startDate { year }
    format
    status
    episodes
    duration
    studios(isMain: true) { nodes { name } }
    coverImage { extraLarge large }
    bannerImage
  }
}
`;

interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: { romaji?: string | null; english?: string | null };
  description?: string | null;
  genres?: string[];
  startDate?: { year?: number | null } | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  studios?: { nodes?: { name: string }[] };
  coverImage?: { extraLarge?: string | null; large?: string | null };
  bannerImage?: string | null;
}

function format(value?: string | null): AnimeFormat {
  return value === "TV" || value === "MOVIE" || value === "OVA" || value === "ONA" || value === "SPECIAL" || value === "MUSIC"
    ? value
    : "UNKNOWN";
}

function status(value?: string | null): AnimeStatus {
  return value === "FINISHED" || value === "RELEASING" || value === "NOT_YET_RELEASED" || value === "CANCELLED" || value === "HIATUS"
    ? value
    : "UNKNOWN";
}

function normalize(media: AniListMedia): AnimeEntry {
  const title = media.title.romaji || media.title.english || "Untitled";

  return {
    id: `anilist-${media.id}`,
    external: { anilist: media.id, ...(media.idMal ? { mal: media.idMal } : {}) },
    metadata: {
      title,
      synopsis: media.description?.replace(/<[^>]*>/g, "").trim() || undefined,
      genres: media.genres ?? [],
      year: media.startDate?.year ?? undefined,
      format: format(media.format),
      status: status(media.status),
      episodes: media.episodes ?? undefined,
      duration: media.duration ?? undefined,
      studios: media.studios?.nodes?.map((studio) => studio.name) ?? [],
      images: {
        cover: media.coverImage?.extraLarge || media.coverImage?.large || "",
        banner: media.bannerImage || undefined,
      },
    },
  };
}

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error(`AniList request failed: ${response.status}`);
  const payload = await response.json() as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join(", "));
  if (!payload.data) throw new Error("AniList returned no data.");
  return payload.data;
}

export const anilistProvider: AnimeProvider = {
  async search({ query, page = 1, perPage = 12 }: AnimeSearchOptions) {
    const data = await request<{ Page: { media: AniListMedia[] } }>(QUERY, { search: query, page, perPage });
    return data.Page.media.map(normalize);
  },

  async getById(id: number) {
    const data = await request<{ Media: AniListMedia | null }>(BY_ID_QUERY, { id });
    return data.Media ? normalize(data.Media) : null;
  },
};
