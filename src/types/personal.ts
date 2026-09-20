export interface PersonalAnimeState {
  watched: boolean;
  pending: boolean;
  favorite: boolean;
  recommended: boolean;
  personalScore?: number;
  review?: string;
}

export interface PersonalAnimeEntry {
  animeId: string;
  state: PersonalAnimeState;
}
