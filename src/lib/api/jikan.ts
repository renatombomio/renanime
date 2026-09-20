import type { AnimeEntry, AnimeFormat, AnimeStatus } from "../../types/anime";
import type { AnimeProvider, AnimeSearchOptions } from "../../types/api";

const BASE_URL = "https://api.jikan.moe/v4";

interface JikanAnime {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  synopsis?: string | null;
  genres?: { name: string }[];
  year?: number | null;
  type?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: string | null;
  studios?: { name: string }[];
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
}

interface JikanResponse<T> { data: T; }

function format(value?: string | null): AnimeFormat {
  return value === "TV" || value === "Movie" || value === "OVA" || value === "ONA" || value === "Special" || value === "Music"
    ? value.toUpperCase() as AnimeFormat
    : "UNKNOWN";
}

function status(value?: string | null): AnimeStatus {
  if (value === "Finished Airing") return "FINISHED";
  if (value === "Currently Airing") return "RELEASING";
  if (value === "Not yet aired") return "NOT_YET_RELEASED";
  return "UNKNOWN";
}

function durationMinutes(value?: string | null): number | undefined {
  const match = value?.match(/(\d+) min/);
  return match ? Number(match[1]) : undefined;
}

function normalize(anime: JikanAnime): AnimeEntry {
  const title = anime.title_english || anime.title || "Untitled";

  return {
    id: `mal-${anime.mal_id}`,
    external: { mal: anime.mal_id },
    metadata: {
      title,
      synopsis: anime.synopsis?.trim() || undefined,
      genres: anime.genres?.map((genre) => genre.name) ?? [],
      year: anime.year ?? undefined,
      format: format(anime.type),
      status: status(anime.status),
      episodes: anime.episodes ?? undefined,
      duration: durationMinutes(anime.duration),
      studios: anime.studios?.map((studio) => studio.name) ?? [],
      images: {
        cover: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
      },
    },
  };
}

export const jikanProvider: AnimeProvider = {
  async search({ query, page = 1, perPage = 12 }: AnimeSearchOptions) {
    const url = new URL(`${BASE_URL}/anime`);
    url.searchParams.set("q", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(Math.min(perPage, 25)));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Jikan request failed: ${response.status}`);
    const payload = await response.json() as JikanResponse<JikanAnime[]>;
    return payload.data.map(normalize);
  },

  async getById(id: number) {
    const response = await fetch(`${BASE_URL}/anime/${id}/full`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Jikan request failed: ${response.status}`);
    }
    const payload = await response.json() as JikanResponse<JikanAnime>;
    return normalize(payload.data);
  },
};
