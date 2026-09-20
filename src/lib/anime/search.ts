import type { AnimeEntry } from "../../types/anime";
import type { AnimeSearchOptions } from "../../types/api";
import { anilistProvider } from "../api/anilist";
import { jikanProvider } from "../api/jikan";

export interface SearchResult extends AnimeEntry {
  collectionStatus: "WATCHED" | "PENDING" | "NOT_IN_COLLECTION";
}

export function filterAnimeCollection(collection: AnimeEntry[], query: string): AnimeEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return collection;

  return collection.filter((anime) =>
    [anime.metadata.title, ...anime.metadata.genres]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

function dedupe(entries: AnimeEntry[]): AnimeEntry[] {
  const byExternalId = new Map<string, AnimeEntry>();

  for (const entry of entries) {
    const key = entry.external.anilist
      ? `anilist:${entry.external.anilist}`
      : entry.external.mal
        ? `mal:${entry.external.mal}`
        : entry.id;

    if (!byExternalId.has(key)) byExternalId.set(key, entry);
  }

  return [...byExternalId.values()];
}

export async function searchAnime(options: AnimeSearchOptions): Promise<AnimeEntry[]> {
  const results = await anilistProvider.search(options);

  if (results.length > 0) return results;

  return jikanProvider.search(options);
}

export function mergeProviderResults(
  primary: AnimeEntry[],
  secondary: AnimeEntry[]
): AnimeEntry[] {
  return dedupe([...primary, ...secondary]);
}
