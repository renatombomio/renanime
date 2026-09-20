import type { AnimeEntry } from "../../types/anime";
import type { AnimeFranchise, FranchiseRelation } from "../../types/franchise";

export function createFranchise(
  id: string,
  name: string,
  animeIds: AnimeEntry["id"][]
): AnimeFranchise {
  return { id, name, animeIds: [...new Set(animeIds)] };
}

export function getFranchiseEntries(
  franchise: AnimeFranchise,
  collection: AnimeEntry[]
): AnimeEntry[] {
  const order = new Map(franchise.animeIds.map((id, index) => [id, index]));
  return collection
    .filter((anime) => order.has(anime.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export function createFranchiseRelations(
  franchise: AnimeFranchise,
  collection: AnimeEntry[]
): FranchiseRelation[] {
  return getFranchiseEntries(franchise, collection).map((anime, index) => ({
    franchiseId: franchise.id,
    animeId: anime.id,
    order: index + 1,
    format: anime.metadata.format,
  }));
}
