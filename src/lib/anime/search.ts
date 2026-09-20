import type { AnimeEntry } from "../../types/anime";

export function filterAnimeCollection(
  collection: AnimeEntry[],
  query: string
): AnimeEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return collection;

  return collection.filter((anime) =>
    anime.metadata.title.toLowerCase().includes(normalizedQuery)
  );
}
