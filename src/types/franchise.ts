import type { AnimeFormat } from "./anime";

export interface AnimeFranchise {
  id: string;
  name: string;
  animeIds: string[];
  /**
   * Only released/known titles belong here.
   * New franchise releases must be added explicitly instead of inheriting WATCHED.
   */
}

export interface FranchiseRelation {
  franchiseId: string;
  animeId: string;
  order?: number;
  format?: AnimeFormat;
  label?: string;
}
