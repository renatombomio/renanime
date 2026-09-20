import type { AnimeEntry, AnimeFormat, AnimeStatus } from "../../types/anime";

export function createAnimeId(source: "anilist" | "mal", id: number): string {
  return `${source}-${id}`;
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/[：]/g, ":")
    .trim();
}

export function normalizeGenres(genres: string[]): string[] {
  return [...new Set(genres.map((genre) => genre.trim()).filter(Boolean))];
}

export function normalizeFormat(format: AnimeFormat): AnimeFormat {
  return format || "UNKNOWN";
}

export function normalizeStatus(status: AnimeStatus): AnimeStatus {
  return status || "UNKNOWN";
}

export function normalizeAnime(entry: AnimeEntry): AnimeEntry {
  return {
    ...entry,
    id: entry.id || createAnimeId(
      entry.external.anilist ? "anilist" : "mal",
      entry.external.anilist ?? entry.external.mal ?? 0
    ),
    external: {
      anilist: entry.external.anilist,
      mal: entry.external.mal,
    },
    metadata: {
      ...entry.metadata,
      title: normalizeTitle(entry.metadata.title),
      synopsis: entry.metadata.synopsis?.trim() || undefined,
      genres: normalizeGenres(entry.metadata.genres),
      format: normalizeFormat(entry.metadata.format),
      status: normalizeStatus(entry.metadata.status),
      studios: [...new Set(entry.metadata.studios.map((studio) => studio.trim()).filter(Boolean))],
      images: {
        cover: entry.metadata.images.cover,
        banner: entry.metadata.images.banner || undefined,
      },
    },
  };
}

export function normalizeAnimeList(entries: AnimeEntry[]): AnimeEntry[] {
  const unique = new Map<string, AnimeEntry>();

  for (const entry of entries) {
    const normalized = normalizeAnime(entry);
    const key = normalized.external.anilist
      ? `anilist:${normalized.external.anilist}`
      : normalized.external.mal
        ? `mal:${normalized.external.mal}`
        : normalized.id;

    unique.set(key, normalized);
  }

  return [...unique.values()];
}
