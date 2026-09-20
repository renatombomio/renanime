import type { PersonalAnimeEntry } from "../types/personal";

const pendingAnime: PersonalAnimeEntry[] = [];

export function getPendingAnime(): PersonalAnimeEntry[] {
  return [...pendingAnime];
}

export function isPending(animeId: string): boolean {
  return pendingAnime.some((entry) => entry.animeId === animeId && entry.state.pending);
}

export function setPendingAnime(entries: PersonalAnimeEntry[]): void {
  pendingAnime.length = 0;
  pendingAnime.push(...entries);
}
