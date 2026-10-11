import es from "./es.json";
import en from "./en.json";

export const dictionaries = {
  es,
  en: en satisfies typeof es,
} as const;

export type Lang = keyof typeof dictionaries;
export type TranslationKey = keyof typeof es;

export function useT(lang: Lang) {
  return (key: TranslationKey): string => dictionaries[lang][key] ?? dictionaries.es[key];
}

export function localizedPath(lang: Lang, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const cleanPath = normalized === "/" ? "" : normalized;
  return lang === "en" ? `/en${cleanPath || "/"}` : (cleanPath || "/");
}
