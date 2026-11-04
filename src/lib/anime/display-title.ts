export interface AnimeTitleFields {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

/**
 * Anime names are presentation metadata, not localized UI copy.
 * Prefer readable Japanese romanization in every interface language.
 */
export function getDisplayTitle(
  title?: AnimeTitleFields | null,
  fallback = "",
): string {
  return title?.romaji?.trim()
    || title?.english?.trim()
    || title?.native?.trim()
    || fallback;
}

export function getNativeTitle(title?: AnimeTitleFields | null): string {
  return title?.native?.trim() || "";
}
