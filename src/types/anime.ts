export type AnimeFormat = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL" | "MUSIC" | "UNKNOWN";
export type AnimeStatus = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS" | "UNKNOWN";

export interface AnimeExternalIds {
  anilist?: number;
  mal?: number;
}

export interface AnimeImageSet {
  cover: string;
  banner?: string;
}

export interface AnimeMetadata {
  title: string;
  synopsis?: string;
  genres: string[];
  year?: number;
  format: AnimeFormat;
  status: AnimeStatus;
  episodes?: number;
  duration?: number;
  studios: string[];
  images: AnimeImageSet;
}

export interface AnimeEntry {
  id: string;
  external: AnimeExternalIds;
  metadata: AnimeMetadata;
}
