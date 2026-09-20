import type { PersonalAnimeEntry } from "../types/personal";

const favoriteAnime: PersonalAnimeEntry[] = [];

export function getFavorites(): PersonalAnimeEntry[] {
  return [...favoriteAnime];
}

export function isFavorite(animeId: string): boolean {
  return favoriteAnime.some((entry) => entry.animeId === animeId && entry.state.favorite);
}

export function setFavorites(entries: PersonalAnimeEntry[]): void {
  favoriteAnime.length = 0;
  favoriteAnime.push(...entries);
}
