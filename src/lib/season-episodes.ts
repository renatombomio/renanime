export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface CurrentAnimeSeason {
  season: AnimeSeason;
  year: number;
}

export function getCurrentAnimeSeason(date: Date = new Date()): CurrentAnimeSeason {
  const month = date.getUTCMonth();

  if (month <= 2) return { season: "WINTER", year: date.getUTCFullYear() };
  if (month <= 5) return { season: "SPRING", year: date.getUTCFullYear() };
  if (month <= 8) return { season: "SUMMER", year: date.getUTCFullYear() };
  return { season: "FALL", year: date.getUTCFullYear() };
}

export function getSeasonDateRange(season: AnimeSeason, year: number) {
  const startMonth: Record<AnimeSeason, number> = {
    WINTER: 0,
    SPRING: 3,
    SUMMER: 6,
    FALL: 9,
  };
  const start = new Date(Date.UTC(year, startMonth[season], 1));
  const end = new Date(Date.UTC(year, startMonth[season] + 3, 1) - 1);
  return { from: start, to: end };
}

export function normalizeEpisodeScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score) || score <= 0 || score > 5) return null;
  return Math.round(score * 20) / 10;
}
