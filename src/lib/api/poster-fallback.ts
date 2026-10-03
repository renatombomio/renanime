const JIKAN_BASE = "https://api.jikan.moe/v4";
const KITSU_BASE = "https://kitsu.io/api/edge";
const MIN_REQUEST_INTERVAL = 700;

function titleSimilarity(query: string, candidate: string): number {
  const wanted = new Set(query.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2));
  const found = new Set(candidate.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2));
  if (!wanted.size || !found.size) return 0;
  let overlap = 0;
  wanted.forEach((token) => { if (found.has(token)) overlap += 1; });
  return overlap / wanted.size;
}

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let lastRequestAt = 0;
let queue = Promise.resolve();

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestWithTimeout(url: URL, headers?: HeadersInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestJikan(query: string): Promise<string | null> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL) await wait(MIN_REQUEST_INTERVAL - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(JIKAN_BASE + "/anime");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");

  const response = await requestWithTimeout(url);
  if (!response?.ok) return null;

  try {
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = query.toLocaleLowerCase("en");
    const exact = items.find((item: any) =>
      [item?.title, item?.title_english, ...(item?.title_synonyms ?? [])]
        .filter(Boolean)
        .some((value: string) => value.toLocaleLowerCase("en") === normalized)
    );
    const item = exact ?? items.find((candidate: any) => {\n      const candidateTitle = [candidate?.title, candidate?.title_english, ...(candidate?.title_synonyms ?? [])].filter(Boolean).join(" ");\n      return titleSimilarity(query, candidateTitle) >= 0.5;\n    });
    return item?.images?.webp?.large_image_url
      || item?.images?.jpg?.large_image_url
      || item?.images?.webp?.image_url
      || item?.images?.jpg?.image_url
      || null;
  } catch {
    return null;
  }
}

async function requestKitsu(query: string): Promise<string | null> {
  const url = new URL(KITSU_BASE + "/anime");
  url.searchParams.set("filter[text]", query);
  url.searchParams.set("page[limit]", "5");

  const response = await requestWithTimeout(url, {
    Accept: "application/vnd.api+json",
  });
  if (!response?.ok) return null;

  try {
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = query.toLocaleLowerCase("en");

    const exact = items.find((item: any) => {
      const attributes = item?.attributes;
      return [
        attributes?.canonicalTitle,
        attributes?.titles?.en,
        attributes?.titles?.en_jp,
        attributes?.titles?.ja_jp,
      ]
        .filter(Boolean)
        .some((value: string) => value.toLocaleLowerCase("en") === normalized);
    });

    const item = exact ?? items.find((candidate: any) => {\n      const attributes = candidate?.attributes;\n      const candidateTitle = [attributes?.canonicalTitle, attributes?.titles?.en, attributes?.titles?.en_jp, attributes?.titles?.ja_jp].filter(Boolean).join(" ");\n      return titleSimilarity(query, candidateTitle) >= 0.5;\n    });
    const image = item?.attributes?.posterImage;
    return image?.large || image?.medium || image?.small || image?.original || null;
  } catch {
    return null;
  }
}

async function resolvePoster(query: string): Promise<string | null> {
  const jikan = await requestJikan(query);
  if (jikan) return jikan;

  return requestKitsu(query);
}

export function fetchFallbackPoster(title: string): Promise<string | null> {
  const query = title.trim();
  if (!query) return Promise.resolve(null);

  const key = query.toLocaleLowerCase("en");
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const existing = pending.get(key);
  if (existing) return existing;

  const task = queue
    .then(() => resolvePoster(query))
    .then((poster) => {
      cache.set(key, poster);
      return poster;
    })
    .catch(() => {
      cache.set(key, null);
      return null;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, task);
  queue = task.then(() => undefined, () => undefined);
  return task;
}
