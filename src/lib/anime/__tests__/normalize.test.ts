import { describe, expect, it } from "vitest";
import {
  createAnimeId,
  normalizeAnime,
  normalizeAnimeList,
  normalizeGenres,
  normalizeTitle,
} from "../normalize";
import type { AnimeEntry } from "../../../types/anime";

function makeAnime(overrides: Partial<AnimeEntry> = {}): AnimeEntry {
  return {
    id: "anilist-1",
    external: { anilist: 1, mal: 10 },
    metadata: {
      title: "  My   Anime：Test  ",
      synopsis: "  A synopsis.  ",
      genres: ["Action", " Action ", "", "Drama"],
      year: 2026,
      format: "TV",
      status: "FINISHED",
      episodes: 12,
      duration: 24,
      studios: ["Studio A", " Studio A ", ""],
      images: {
        cover: "cover.jpg",
        banner: "",
      },
    },
    ...overrides,
  };
}

describe("normalizeTitle", () => {
  it("collapses whitespace, normalizes the full-width colon and trims", () => {
    expect(normalizeTitle("  My   Anime：Test  ")).toBe("My Anime:Test");
  });
});

describe("normalizeGenres", () => {
  it("trims, removes empty values and deduplicates genres", () => {
    expect(normalizeGenres(["Action", " Action ", "", "Drama", "Action"])).toEqual([
      "Action",
      "Drama",
    ]);
  });
});

describe("createAnimeId", () => {
  it("creates stable provider IDs", () => {
    expect(createAnimeId("anilist", 123)).toBe("anilist-123");
    expect(createAnimeId("mal", 456)).toBe("mal-456");
  });
});

describe("normalizeAnime", () => {
  it("normalizes the metadata without mutating the source object", () => {
    const source = makeAnime();
    const normalized = normalizeAnime(source);

    expect(normalized.metadata.title).toBe("My Anime:Test");
    expect(normalized.metadata.synopsis).toBe("A synopsis.");
    expect(normalized.metadata.genres).toEqual(["Action", "Drama"]);
    expect(normalized.metadata.studios).toEqual(["Studio A"]);
    expect(normalized.metadata.images.banner).toBeUndefined();
    expect(source.metadata.title).toBe("  My   Anime：Test  ");
  });

  it("falls back to an external ID when the internal ID is missing", () => {
    const normalized = normalizeAnime(makeAnime({
      id: "",
      external: { anilist: 99 },
    }));

    expect(normalized.id).toBe("anilist-99");
  });
});

describe("normalizeAnimeList", () => {
  it("deduplicates entries by AniList ID", () => {
    const first = makeAnime();
    const second = makeAnime({
      id: "anilist-1-copy",
      metadata: { ...first.metadata, title: "Updated title" },
    });

    const result = normalizeAnimeList([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0].metadata.title).toBe("My Anime:Test");
  });


  it("deduplicates the same anime across AniList and MAL IDs", () => {
    const anilistEntry = makeAnime({
      id: "anilist-1",
      external: { anilist: 1, mal: 10 },
    });
    const malEntry = makeAnime({
      id: "mal-10",
      external: { mal: 10 },
      metadata: { ...anilistEntry.metadata, title: "Same anime from MAL" },
    });

    const result = normalizeAnimeList([anilistEntry, malEntry]);

    expect(result).toHaveLength(1);
    expect(result[0].external).toEqual({ anilist: 1, mal: 10 });
    expect(result[0].metadata.title).toBe("My Anime:Test");
  });

  it("fills a missing provider ID when two entries refer to the same anime", () => {
    const anilistEntry = makeAnime({
      id: "anilist-1",
      external: { anilist: 1 },
    });
    const malEntry = makeAnime({
      id: "mal-10",
      external: { mal: 10 },
    });

    const result = normalizeAnimeList([anilistEntry, malEntry]);

    expect(result).toHaveLength(2);
  });

  it("deduplicates entries by MAL ID when AniList is unavailable", () => {
    const first = makeAnime({
      id: "mal-10",
      external: { mal: 10 },
    });
    const second = makeAnime({
      id: "mal-10-copy",
      external: { mal: 10 },
    });

    expect(normalizeAnimeList([first, second])).toHaveLength(1);
  });
});
