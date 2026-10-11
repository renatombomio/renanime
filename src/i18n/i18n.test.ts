import { describe, expect, it } from "vitest";
import es from "./es.json";
import en from "./en.json";
import { dictionaries, localizedPath, useT } from "./index";

describe("i18n dictionaries", () => {
  it("keeps Spanish and English translation keys in sync", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it("provides a translation for each shared key in both languages", () => {
    for (const key of Object.keys(es) as Array<keyof typeof es>) {
      expect(es[key], `Missing Spanish translation: ${key}`).toBeTruthy();
      expect(en[key], `Missing English translation: ${key}`).toBeTruthy();
    }
  });

  it("returns the requested language dictionary", () => {
    expect(useT("es")("nav.home")).toBe("Inicio");
    expect(useT("en")("nav.home")).toBe("Home");
    expect(Object.keys(dictionaries.en)).toHaveLength(Object.keys(dictionaries.es).length);
  });
});

describe("localizedPath", () => {
  it.each([
    ["es", "/", "/"],
    ["es", "/search/", "/search/"],
    ["es", "login/", "/login/"],
    ["en", "/", "/en/"],
    ["en", "/search/", "/en/search/"],
    ["en", "login/", "/en/login/"],
  ] as const)("maps %s + %s to %s", (lang, path, expected) => {
    expect(localizedPath(lang, path)).toBe(expected);
  });
});
