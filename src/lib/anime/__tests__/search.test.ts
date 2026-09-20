import { describe, expect, it } from "vitest";
import {
  filterAnimeCollection,
  getCollectionStatus,
  mergeProviderResults,
} from "../search";
import type { AnimeEntry } from "../../../types/anime";
import type { PersonalAnimeEntry } from "../../../types/personal";

function makeAnime(id: string, title: string, genres: string[] = ["Action"]): AnimeEntry {
  return {
    id,
    external: { anilist: Number(id.replace("anilist-", "")) || undefined },
    metadata: {
      title,
      genres,
      format: "TV",
      status: "FINISHED",
      studios: ["Studio"],
      images: { cover: "cover.jpg" },
    },
  };
}

describe("filterAnimeCollection", () => {
  const collection = [
    makeAnime("anilist-1", "Naruto", ["Action", "Adventure"]),
    makeAnime("anilist-2", "Spirited Away", ["Drama", "Fantasy"]),
    makeAnime("anilist-3", "Bleach", ["Action"]),
  ];

  it("returns the complete collection for an empty query", () => {
    expect(filterAnimeCollection(collection, "   ")).toEqual(collection);
  });

  it("searches titles case-insensitively", () => {
    expect(filterAnimeCollection(collection, "naruto").map((anime) => anime.metadata.title))
      .toEqual(["Naruto"]);
  });

  it("searches genres as well as titles", () => {
    expect(filterAnimeCollection(collection, "fantasy").map((anime) => anime.metadata.title))
      .toEqual(["Spirited Away"]);
  });
});

describe("getCollectionStatus", () => {
  const states: PersonalAnimeEntry[] = [
    {
      animeId: "anilist-1",
      state: { watched: true, pending: false, favorite: true, recommended: false },
    },
    {
      animeId: "anilist-2",
      state: { watched: false, pending: true, favorite: false, recommended: false },
    },
  ];

  it("returns WATCHED before PENDING when both flags are present", () => {
    expect(getCollectionStatus("anilist-1", states)).toBe("WATCHED");
  });

  it("returns PENDING for pending entries", () => {
    expect(getCollectionStatus("anilist-2", states)).toBe("PENDING");
  });

  it("returns NOT_IN_COLLECTION for unknown entries", () => {
    expect(getCollectionStatus("anilist-999", states)).toBe("NOT_IN_COLLECTION");
  });
});

describe("mergeProviderResults", () => {
  it("removes duplicates shared by the same provider ID", () => {
    const primary = [makeAnime("anilist-1", "Naruto")];
    const secondary = [makeAnime("anilist-1", "Naruto")];

    expect(mergeProviderResults(primary, secondary)).toHaveLength(1);
  });
});
