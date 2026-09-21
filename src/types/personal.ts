export type PersonalAnimeStatus = "WATCHED" | "PENDING" | "NOT_IN_COLLECTION";

export interface PersonalAnimeState {
  status: PersonalAnimeStatus;
  favorite: boolean;
  recommended: boolean;
  personalScore?: number;
  personalRanking?: number;
  review?: string;
}

export interface PersonalAnimeEntry {
  animeId: string;
  state: PersonalAnimeState;
  franchiseId?: string;
}

export interface LibraryEntry extends PersonalAnimeEntry {
  title: string;
}

export function getPersonalStatus(state: PersonalAnimeState): PersonalAnimeStatus {
  return state.status;
}

export function isWatched(state: PersonalAnimeState): boolean {
  return state.status === "WATCHED";
}

export function isPending(state: PersonalAnimeState): boolean {
  return state.status === "PENDING";
}
