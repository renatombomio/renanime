import { describe, expect, it } from "vitest";
import {
  createFranchise,
  createFranchiseRelations,
  getFranchiseEntries,
} from "../franchise";
import type { AnimeEntry } from "../../../types/anime";

function makeAnime(id: string, format: AnimeEntry["metadata"]["format"]): AnimeEntry {
  return {
    id,
    external: { anilist: Number(id.replace("anilist-", "")) },
    metadata: {
      title: id,
      genres: [],
      format,
      status: "FINISHED",
      studios: [],
      images: { cover: "cover.jpg" },
    },
  };
}

describe("createFranchise", () => {
  it("removes duplicate anime IDs while preserving declared order", () => {
    const franchise = createFranchise(
      "naruto",
      "Naruto",
      ["anilist-3", "anilist-1", "anilist-3"],
    );

    expect(franchise.animeIds).toEqual(["anilist-3", "anilist-1"]);
  });
});

describe("getFranchiseEntries", () => {
  it("returns collection entries in franchise order", () => {
    const collection = [
      makeAnime("anilist-1", "TV"),
      makeAnime("anilist-2", "MOVIE"),
      makeAnime("anilist-3", "OVA"),
    ];

    const franchise = createFranchise(
      "test",
      "Test",
      ["anilist-3", "anilist-1", "anilist-2"],
    );

    expect(getFranchiseEntries(franchise, collection).map((anime) => anime.id))
      .toEqual(["anilist-3", "anilist-1", "anilist-2"]);
  });

  it("ignores franchise IDs that are not in the collection", () => {
    const collection = [makeAnime("anilist-1", "TV")];
    const franchise = createFranchise("test", "Test", ["anilist-999", "anilist-1"]);

    expect(getFranchiseEntries(franchise, collection).map((anime) => anime.id))
      .toEqual(["anilist-1"]);
  });
});

describe("createFranchiseRelations", () => {
  it("creates ordered relations with the anime format", () => {
    const collection = [
      makeAnime("anilist-1", "TV"),
      makeAnime("anilist-2", "MOVIE"),
    ];
    const franchise = createFranchise("test", "Test", ["anilist-2", "anilist-1"]);

    expect(createFranchiseRelations(franchise, collection)).toEqual([
      { franchiseId: "test", animeId: "anilist-2", order: 1, format: "MOVIE" },
      { franchiseId: "test", animeId: "anilist-1", order: 2, format: "TV" },
    ]);
  });
});
