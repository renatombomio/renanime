import type { AnimeEntry } from "../types/anime";
import type { PersonalAnimeEntry } from "../types/personal";

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

export function getPersonalCollection(
  states: PersonalAnimeEntry[],
): Array<{ anime: AnimeEntry; state: PersonalAnimeEntry["state"] }> {
  return states
    .map((entry) => {
      const anime = getAnimeById(entry.animeId);
      return anime ? { anime, state: entry.state } : null;
    })
    .filter((entry): entry is { anime: AnimeEntry; state: PersonalAnimeEntry["state"] } => entry !== null);
}
