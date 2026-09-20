import type { AnimeEntry } from "../../types/anime";

export function createAnimeId(source: "anilist" | "mal", id: number): string {
  return `${source}-${id}`;
}

export function normalizeAnime(entry: AnimeEntry): AnimeEntry {
  return entry;
}
