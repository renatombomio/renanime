import identityCatalogue from "../../data/ren-anime-identities.json";

interface IdentityEntry {
  animeId: string;
  displayTitle: string;
  format: "SERIES" | "MOVIE";
  anilistId: number;
  providerTitles?: { romaji?: string | null; english?: string | null; native?: string | null };
  anilistFormat?: string;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  reviewed?: boolean;
}
interface EntryRef { animeId: string; title: string; format?: "SERIES" | "MOVIE"; }
interface AniListMedia {
  id: number;
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

const catalogueEntries = (identityCatalogue as { entries?: IdentityEntry[] }).entries ?? [];
const identities = new Map<string, IdentityEntry>(
  catalogueEntries
    .filter((entry) => Number.isInteger(entry.anilistId) && entry.anilistId > 0)
    .map((entry) => [entry.animeId, entry]),
);

export function getRenAniListId(animeId: string): number | undefined {
  return identities.get(animeId)?.anilistId;
}

/**
 * Returns the build-time verified poster metadata. Gallery cards do not call
 * AniList per visitor; only detail pages request live metadata by stable ID.
 */
export async function fetchRenMediaByIdentity<T extends EntryRef>(entries: T[]): Promise<Record<string, AniListMedia | null>> {
  const result: Record<string, AniListMedia | null> = {};
  for (const entry of entries) {
    const identity = identities.get(entry.animeId);
    if (!identity) continue;
    result[entry.animeId] = {
      id: identity.anilistId,
      title: identity.providerTitles ?? {},
      format: identity.anilistFormat ?? (identity.format === "MOVIE" ? "MOVIE" : "TV"),
      coverImage: identity.coverImage ?? undefined,
    };
  }
  return result;
}
