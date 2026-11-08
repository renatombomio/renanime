import { describe, expect, it } from "vitest";
import { getNextAnimeRank, normalizeSeenAnimeCount, resolveAnimeRank } from "./ranks";

describe("anime rank thresholds", () => {
  it.each([
    [0, null],
    [19, null],
    [20, "beginner"],
    [49, "beginner"],
    [50, "anime-fan"],
    [99, "anime-fan"],
    [100, "anime-master"],
    [199, "anime-master"],
    [200, "anime-pro"],
    [499, "anime-pro"],
    [500, "anime-legend"],
    [1200, "anime-legend"],
  ] as const)("resolves %i seen anime to %s", (count, expected) => {
    expect(resolveAnimeRank(count)?.key ?? null).toBe(expected);
  });

  it("normalizes invalid, negative and fractional counts", () => {
    expect(normalizeSeenAnimeCount(-4)).toBe(0);
    expect(normalizeSeenAnimeCount(19.9)).toBe(19);
    expect(normalizeSeenAnimeCount(Number.NaN)).toBe(0);
    expect(normalizeSeenAnimeCount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("returns the next rank before the first threshold", () => {
    expect(getNextAnimeRank(19)?.key).toBe("beginner");
    expect(getNextAnimeRank(20)?.key).toBe("anime-fan");
  });

  it("returns no next rank after Anime Legend", () => {
    expect(getNextAnimeRank(500)).toBeNull();
  });

  it("supports localized labels", () => {
    expect(resolveAnimeRank(100, "es")?.label).toBe("Anime Master");
    expect(resolveAnimeRank(100, "en")?.label).toBe("Anime Master");
  });
});
