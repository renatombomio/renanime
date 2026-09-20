import type { AnimeEntry } from "../types/anime";

const animeCollection: AnimeEntry[] = [];

export function getAnimeCollection(): AnimeEntry[] {
  return [...animeCollection];
}

export function getAnimeById(id: string): AnimeEntry | null {
  return animeCollection.find((anime) => anime.id === id) ?? null;
}

export function getAnimeByExternalId(
  provider: "anilist" | "mal",
  externalId: number
): AnimeEntry | null {
  return animeCollection.find((anime) => anime.external[provider] === externalId) ?? null;
}

export function setAnimeCollection(entries: AnimeEntry[]): void {
  animeCollection.length = 0;
  animeCollection.push(...entries);
}
