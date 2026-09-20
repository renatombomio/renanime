import type { AnimeFormat } from "./anime";

export interface AnimeFranchise {
  id: string;
  name: string;
  animeIds: string[];
}

export interface FranchiseRelation {
  franchiseId: string;
  animeId: string;
  order?: number;
  format?: AnimeFormat;
  label?: string;
}
