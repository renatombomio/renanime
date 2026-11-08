export type AnimeRankKey = "beginner" | "anime-fan" | "anime-master" | "anime-pro" | "anime-legend";
export type RankLocale = "es" | "en";

export interface AnimeRank {
  key: AnimeRankKey;
  label: string;
  minSeen: number;
  nextMinSeen: number | null;
}

/**
 * Rank is derived only from the number of unique anime with status "seen".
 * Callers must exclude pending entries and deduplicate by anime_id.
 */
const RANK_THRESHOLDS: ReadonlyArray<{ key: AnimeRankKey; minSeen: number; es: string; en: string }> = [
  { key: "beginner", minSeen: 20, es: "Beginner", en: "Beginner" },
  { key: "anime-fan", minSeen: 50, es: "Anime Fan", en: "Anime Fan" },
  { key: "anime-master", minSeen: 100, es: "Anime Master", en: "Anime Master" },
  { key: "anime-pro", minSeen: 200, es: "Anime Pro", en: "Anime Pro" },
  { key: "anime-legend", minSeen: 500, es: "Anime Legend", en: "Anime Legend" },
];

export function normalizeSeenAnimeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function resolveAnimeRank(value: number, locale: RankLocale = "es"): AnimeRank | null {
  const seenCount = normalizeSeenAnimeCount(value);
  let currentIndex = -1;

  for (let index = 0; index < RANK_THRESHOLDS.length; index += 1) {
    if (seenCount >= RANK_THRESHOLDS[index].minSeen) currentIndex = index;
    else break;
  }

  if (currentIndex < 0) return null;

  const current = RANK_THRESHOLDS[currentIndex];
  const next = RANK_THRESHOLDS[currentIndex + 1];

  return {
    key: current.key,
    label: current[locale],
    minSeen: current.minSeen,
    nextMinSeen: next?.minSeen ?? null,
  };
}

export function getNextAnimeRank(value: number, locale: RankLocale = "es"): AnimeRank | null {
  const seenCount = normalizeSeenAnimeCount(value);
  const next = RANK_THRESHOLDS.find((rank) => seenCount < rank.minSeen);
  if (!next) return null;

  return {
    key: next.key,
    label: next[locale],
    minSeen: next.minSeen,
    nextMinSeen: next.minSeen,
  };
}
