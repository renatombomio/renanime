import type { AnimeEntry } from "../../types/anime";
import type { AnimeSearchOptions } from "../../types/api";
import type { PersonalAnimeEntry } from "../../types/personal";
import { anilistProvider } from "../api/anilist";
import { jikanProvider } from "../api/jikan";
import { normalizeAnimeList } from "./normalize";

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
  return normalizeAnimeList(entries);
}

export async function searchAnime(options: AnimeSearchOptions): Promise<AnimeEntry[]> {
  try {
    const results = await anilistProvider.search(options);
    if (results.length > 0) return normalizeAnimeList(results);
  } catch {
    // Fall through to Jikan when AniList is unavailable.
  }

  return normalizeAnimeList(await jikanProvider.search(options));
}

export function mergeProviderResults(
  primary: AnimeEntry[],
  secondary: AnimeEntry[]
): AnimeEntry[] {
  return dedupe([...primary, ...secondary]);
}

export function getCollectionStatus(
  animeId: string,
  states: PersonalAnimeEntry[],
): SearchResult["collectionStatus"] {
  const state = states.find((entry) => entry.animeId === animeId)?.state;

  if (state?.watched) return "WATCHED";
  if (state?.pending) return "PENDING";
  return "NOT_IN_COLLECTION";
}
