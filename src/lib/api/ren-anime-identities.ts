import identityCatalogue from "../../data/ren-anime-identities.json";

interface IdentityEntry {
  animeId: string;
  anilistId: number;
  reviewed?: boolean;
}
interface EntryRef { animeId: string; title: string; format?: "SERIES" | "MOVIE"; }
interface AniListMedia {
  id: number;
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  format?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}
const identities = new Map<string, number>(
  ((identityCatalogue as { entries?: IdentityEntry[] }).entries ?? [])
    .filter((entry) => Number.isInteger(entry.anilistId) && entry.anilistId > 0)
    .map((entry) => [entry.animeId, entry.anilistId]),
);

export function getRenAniListId(animeId: string): number | undefined {
  return identities.get(animeId);
}

/** Fetches canonical catalogue entries by AniList identity in batches of at most 50. */
export async function fetchRenMediaByIdentity<T extends EntryRef>(entries: T[]): Promise<Record<string, AniListMedia | null>> {
  const result: Record<string, AniListMedia | null> = {};
  const resolvable = entries
    .map((entry) => ({ entry, id: getRenAniListId(entry.animeId) }))
    .filter((item): item is { entry: T; id: number } => Boolean(item.id));
  for (let offset = 0; offset < resolvable.length; offset += 50) {
    const chunk = resolvable.slice(offset, offset + 50);
    const ids = [...new Set(chunk.map((item) => item.id))];
    const query = "query RenMediaByIds($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id title{romaji english native} format coverImage{extraLarge large}}}}";
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { ids } }),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const byId = new Map<number, AniListMedia>(
        (payload.data?.Page?.media ?? []).map((media: AniListMedia) => [media.id, media]),
      );
      for (const { entry, id } of chunk) {
        const media = byId.get(id);
        if (media) result[entry.animeId] = media;
      }
    } catch {
      // Keep entries unresolved so the caller can use its existing fallback path.
    }
  }
  return result;
}
