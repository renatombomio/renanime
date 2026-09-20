import type { AnimeEntry } from "../../types/anime";
import type { AnimeFranchise } from "../../types/franchise";

export function createFranchise(
  id: string,
  name: string,
  animeIds: AnimeEntry["id"][]
): AnimeFranchise {
  return { id, name, animeIds };
}
