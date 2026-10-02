const JIKAN_BASE = "https://api.jikan.moe/v4";
const MIN_REQUEST_INTERVAL = 700;

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let lastRequestAt = 0;
let queue = Promise.resolve();

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestPoster(query: string): Promise<string | null> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL) await wait(MIN_REQUEST_INTERVAL - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(JIKAN_BASE + "/anime");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = query.toLocaleLowerCase("en");

    const exact = items.find((item: any) =>
      [item?.title, item?.title_english, ...(item?.title_synonyms ?? [])]
        .filter(Boolean)
        .some((value: string) => value.toLocaleLowerCase("en") === normalized)
    );

    const item = exact ?? items[0];
    return (
      item?.images?.webp?.large_image_url ||
      item?.images?.jpg?.large_image_url ||
      item?.images?.webp?.image_url ||
      item?.images?.jpg?.image_url ||
      null
    );
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function fetchFallbackPoster(title: string): Promise<string | null> {
  const query = title.trim();
  if (!query) return Promise.resolve(null);

  const key = query.toLocaleLowerCase("en");
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const existing = pending.get(key);
  if (existing) return existing;

  const task = queue
    .then(() => requestPoster(query))
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
