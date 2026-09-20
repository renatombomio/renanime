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

function mergeAnimeEntries(primary: AnimeEntry, secondary: AnimeEntry): AnimeEntry {
  return {
    ...primary,
    external: {
      anilist: primary.external.anilist ?? secondary.external.anilist,
      mal: primary.external.mal ?? secondary.external.mal,
    },
    metadata: {
      ...primary.metadata,
      synopsis: primary.metadata.synopsis ?? secondary.metadata.synopsis,
      year: primary.metadata.year ?? secondary.metadata.year,
      episodes: primary.metadata.episodes ?? secondary.metadata.episodes,
      duration: primary.metadata.duration ?? secondary.metadata.duration,
      studios: primary.metadata.studios.length > 0
        ? primary.metadata.studios
        : secondary.metadata.studios,
      genres: primary.metadata.genres.length > 0
        ? primary.metadata.genres
        : secondary.metadata.genres,
      images: {
        cover: primary.metadata.images.cover || secondary.metadata.images.cover,
        banner: primary.metadata.images.banner ?? secondary.metadata.images.banner,
      },
    },
  };
}

export function normalizeAnimeList(entries: AnimeEntry[]): AnimeEntry[] {
  const unique: AnimeEntry[] = [];
  const byAnilist = new Map<number, number>();
  const byMal = new Map<number, number>();

  for (const entry of entries) {
    const normalized = normalizeAnime(entry);
    const anilistId = normalized.external.anilist;
    const malId = normalized.external.mal;

    const existingIndex =
      (anilistId !== undefined ? byAnilist.get(anilistId) : undefined) ??
      (malId !== undefined ? byMal.get(malId) : undefined);

    if (existingIndex === undefined) {
      unique.push(normalized);
      const index = unique.length - 1;
      if (anilistId !== undefined) byAnilist.set(anilistId, index);
      if (malId !== undefined) byMal.set(malId, index);
      continue;
    }

    const merged = mergeAnimeEntries(unique[existingIndex], normalized);
    unique[existingIndex] = merged;

    if (merged.external.anilist !== undefined) {
      byAnilist.set(merged.external.anilist, existingIndex);
    }
    if (merged.external.mal !== undefined) {
      byMal.set(merged.external.mal, existingIndex);
    }
  }

  return unique;
}
