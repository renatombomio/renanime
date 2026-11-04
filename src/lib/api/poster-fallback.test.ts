import { describe, expect, it } from "vitest";
import { selectBestAnimeCandidate } from "./poster-fallback";

describe("selectBestAnimeCandidate", () => {
  it("selects an exact title match over a looser title match", () => {
    const candidates = [
      { title: { romaji: "Boku no Hero Academia: Two Heroes" }, format: "MOVIE" },
      { title: { romaji: "Boku no Hero Academia" }, format: "TV" },
    ];

    expect(selectBestAnimeCandidate(candidates, "Boku no Hero Academia", "SERIES"))
      .toBe(candidates[1]);
  });

  it("does not confuse a movie with its parent series", () => {
    const candidates = [
      { title: { english: "Boku no Hero Academia" }, format: "TV" },
      { title: { english: "My Hero Academia: Two Heroes" }, format: "MOVIE" },
    ];

    expect(selectBestAnimeCandidate(candidates, "Boku no Hero Academia: Two Heroes", "MOVIE"))
      .toBeNull();
  });

  it("matches alternate titles when the requested format is compatible", () => {
    const candidate = {
      title: { romaji: "Nanatsu no Taizai: Ensa no Edinburgh" },
      synonyms: ["The Seven Deadly Sins: Grudge of Edinburgh"],
      format: "MOVIE",
    };

    expect(selectBestAnimeCandidate(
      [candidate],
      "The Seven Deadly Sins: Grudge of Edinburgh",
      "MOVIE",
    )).toBe(candidate);
  });

  it("rejects unrelated titles instead of returning the first search result", () => {
    const candidates = [
      { title: { english: "Boku no Hero Academia" }, format: "TV" },
      { title: { english: "My Hero Academia: Heroes Rising" }, format: "MOVIE" },
    ];

    expect(selectBestAnimeCandidate(candidates, "The Seven Deadly Sins", "MOVIE"))
      .toBeNull();
  });

  it("supports OVA and ONA formats as series entries", () => {
    const ova = { title: { romaji: "Example OVA" }, format: "OVA" };
    const ona = { title: { romaji: "Example ONA" }, format: "ONA" };

    expect(selectBestAnimeCandidate([ova], "Example OVA", "SERIES")).toBe(ova);
    expect(selectBestAnimeCandidate([ona], "Example ONA", "SERIES")).toBe(ona);
  });

  it("does not impose a format when the collection entry has no declared format", () => {
    const movie = { title: { english: "A Silent Voice" }, format: "MOVIE" };

    expect(selectBestAnimeCandidate([movie], "A Silent Voice")).toBe(movie);
  });
});
