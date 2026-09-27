export interface TmdbLogo {
  logo?: string;
}

const CACHE_PREFIX = "renanime:tmdb-logo:";

export async function getTmdbLogo(
  title: string,
  format: "SERIES" | "MOVIE" = "SERIES",
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const cacheKey = `${CACHE_PREFIX}${format}:${title.toLowerCase()}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached !== null) {
    return cached || null;
  }

  try {
    const type = format === "MOVIE" ? "movie" : "tv";
    const response = await fetch(
      `/api/tmdb/logo?title=${encodeURIComponent(title)}&type=${type}`,
    );

    if (!response.ok) return null;

    const data = (await response.json()) as TmdbLogo;
    const logo = data.logo ?? null;

    sessionStorage.setItem(cacheKey, logo ?? "");
    return logo;
  } catch {
    return null;
  }
}

export async function getTmdbLogoBatch(
  entries: { title: string; format?: "SERIES" | "MOVIE" }[],
) {
  const results: Record<string, string | null> = {};

  await Promise.all(
    entries.map(async (entry) => {
      results[entry.title] = await getTmdbLogo(
        entry.title,
        entry.format ?? "SERIES",
      );
    }),
  );

  return results;
}
