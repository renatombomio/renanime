import type { LibraryEntry } from "../types/personal";

const FRANCHISE_ROOTS: Record<string, string> = {
  "boku-no-hero-academia": "Boku no Hero Academia",
  "dragon-ball": "Dragon Ball Z",
  "naruto": "Naruto",
  "one-piece": "One Piece",
  "bleach": "Bleach",
  "shingeki-no-kyojin": "Shingeki no Kyojin",
  "fullmetal-alchemist": "Fullmetal Alchemist",
  "kimetsu-no-yaiba": "Kimetsu no Yaiba",
  "black-clover": "Black Clover",
  "danmachi": "DanMachi",
  "trinity-seven": "Trinity Seven",
  "afro-samurai": "Afro Samurai",
  "ao-no-exorcist": "Ao no Exorcist",
  "fairy-tail": "Fairy Tail",
  "k-project": "K Project",
  "bungou-stray-dogs": "Bungou Stray Dogs",
  "nanatsu-no-taizai": "Nanatsu no Taizai",
  "kuroko-no-basket": "Kuroko no Basket",
  "no-game-no-life": "No Game No Life",
  "konosuba": "Kono Subarashii Sekai ni Shukufuku wo!",
  "goblin-slayer": "Goblin Slayer",
  "sword-art-online": "Sword Art Online",
  "jujutsu-kaisen": "Jujutsu Kaisen",
  "berserk": "Berserk",
};

const TITLE_TO_FRANCHISE: Record<string, string> = Object.fromEntries(
  Object.entries(FRANCHISE_ROOTS).map(([id, title]) => [title.toLowerCase(), id]),
);

export function getFranchiseId(entry: LibraryEntry): string | undefined {
  return entry.franchiseId ?? TITLE_TO_FRANCHISE[entry.title.toLowerCase()];
}

export function getFranchiseRootTitle(franchiseId: string): string | undefined {
  return FRANCHISE_ROOTS[franchiseId];
}

export function getPersonalFranchiseEntries(
  entry: LibraryEntry,
  library: LibraryEntry[],
): LibraryEntry[] {
  const franchiseId = getFranchiseId(entry);
  if (!franchiseId) return [];

  const rootTitle = getFranchiseRootTitle(franchiseId);
  const entries = library.filter((candidate) => getFranchiseId(candidate) === franchiseId);

  if (rootTitle && !entries.some((candidate) => candidate.title === rootTitle)) {
    const root = library.find((candidate) => candidate.title === rootTitle);
    if (root) entries.unshift(root);
  }

  if (!entries.some((candidate) => candidate.animeId === entry.animeId)) {
    entries.unshift(entry);
  }

  return entries.filter((candidate, index, all) =>
    all.findIndex((item) => item.animeId === candidate.animeId) === index,
  );
}
