import { describe, expect, it } from "vitest";
import { getCurrentAnimeSeason, getSeasonDateRange, normalizeEpisodeScore } from "./season-episodes";

describe("anime season helpers", () => {
  it("maps calendar months to the correct anime season", () => {
    expect(getCurrentAnimeSeason(new Date("2026-01-15T12:00:00Z"))).toEqual({ season: "WINTER", year: 2026 });
    expect(getCurrentAnimeSeason(new Date("2026-04-15T12:00:00Z"))).toEqual({ season: "SPRING", year: 2026 });
    expect(getCurrentAnimeSeason(new Date("2026-07-15T12:00:00Z"))).toEqual({ season: "SUMMER", year: 2026 });
    expect(getCurrentAnimeSeason(new Date("2026-11-05T12:00:00Z"))).toEqual({ season: "FALL", year: 2026 });
  });

  it("uses the full three-month season window", () => {
    const range = getSeasonDateRange("FALL", 2026);
    expect(range.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("normalizes MAL episode scores from 5 to 10 without inventing missing scores", () => {
    expect(normalizeEpisodeScore(4.75)).toBe(9.5);
    expect(normalizeEpisodeScore(0)).toBeNull();
    expect(normalizeEpisodeScore(null)).toBeNull();
    expect(normalizeEpisodeScore(5.1)).toBeNull();
  });
});
