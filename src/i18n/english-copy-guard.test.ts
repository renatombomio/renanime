import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoots = ["components", "layouts", "pages"];
const sourceExtensions = new Set([".astro", ".tsx"]);
const spanishMarkers = /[¿¡áéíóúÁÉÍÓÚñÑ]/g;
const knownProperNames = ["Cécile"];

function listUiSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api" || entry.name === "data" || entry.name === "__tests__") return [];
      return listUiSources(path);
    }
    if (!sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) return [];
    if (entry.name.includes(".test.")) return [];
    return [path];
  });
}

function englishBranchLiterals(source: string): string[] {
  const literals: string[] = [];
  const englishFirstTernary = /(?:isEnglish|(?:Astro\.locals\.)?lang\s*===\s*["']en["'])\s*\?\s*"([^"\n]*)"\s*:/g;
  for (const match of source.matchAll(englishFirstTernary)) literals.push(match[1]);
  return literals;
}

function hasSpanishMarker(text: string): boolean {
  const withoutKnownProperNames = knownProperNames.reduce((value, name) => value.replaceAll(name, ""), text);
  return spanishMarkers.test(withoutKnownProperNames);
}

describe("English UI copy guard", () => {
  it("keeps the login language switch labels in the translation dictionary", () => {
    const loginPath = join(sourceRoot, "pages", "login", "index.astro");
    const source = readFileSync(loginPath, "utf8");
    expect(source).toContain('t(Astro.locals.lang === "es" ? "language.switchToEnglish" : "language.switchToSpanish")');
    expect(source).not.toContain('aria-label={Astro.locals.lang === "es" ? "Switch language to English" : "Cambiar idioma a español"}');
  });

  it("flags Spanish-specific punctuation or accents in English-first UI copy", () => {
    const files = uiRoots.flatMap((root) => listUiSources(join(sourceRoot, root)));
    const findings = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return englishBranchLiterals(source)
        .filter(hasSpanishMarker)
        .map((literal) => `${relative(sourceRoot, path)}: ${literal}`);
    });

    expect(findings).toEqual([]);
  });
});
