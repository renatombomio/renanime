import type { LibraryEntry } from "../../types/personal";

export interface GenreCatalogEntry {
  name: string;
  entries: LibraryEntry[];
}

export function buildGenreCatalog(
  entries: LibraryEntry[],
  genresByAnimeId: Record<string, string[]>,
): GenreCatalogEntry[] {
  const grouped = new Map<string, LibraryEntry[]>();

  for (const entry of entries) {
    for (const genre of genresByAnimeId[entry.animeId] ?? []) {
      const normalized = genre.trim();
      if (!normalized) continue;

      const current = grouped.get(normalized) ?? [];
      current.push(entry);
      grouped.set(normalized, current);
    }
  }

  return [...grouped.entries()]
    .map(([name, genreEntries]) => ({
      name,
      entries: genreEntries,
    }))
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length ||
        a.name.localeCompare(b.name),
    );
}
