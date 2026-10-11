const ENDPOINT = "https://graphql.anilist.co";
const CACHE_PREFIX = "renanime:anilist:ghibli:";
const CACHE_TTL = 86400000;
const MIN_INTERVAL = 2200;
type Payload = Record<string, any>;
const memoryCache = new Map<string, Payload>();
const pending = new Map<string, Promise<Payload>>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function readSessionCache(key: string): Payload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at: number; payload: Payload };
    if (Date.now() - saved.at > CACHE_TTL) { sessionStorage.removeItem(CACHE_PREFIX + key); return null; }
    return saved.payload;
  } catch { return null; }
}

export function fetchGhibliAniList(cacheKey: string, query: string, variables: Record<string, string>) {
  const cached = memoryCache.get(cacheKey) ?? (typeof sessionStorage !== "undefined" ? readSessionCache(cacheKey) : null);
  if (cached) { memoryCache.set(cacheKey, cached); return Promise.resolve(cached); }
  const existing = pending.get(cacheKey);
  if (existing) return existing;
  const request = queue.then(async () => {
    const delay = MIN_INTERVAL - (Date.now() - lastRequestAt);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestAt = Date.now();
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`AniList request failed: ${response.status}`);
    const result = await response.json() as { data?: Payload; errors?: { message: string }[] };
    if (result.errors?.length || !result.data) throw new Error(result.errors?.map((item) => item.message).join(", ") || "AniList returned no data");
    memoryCache.set(cacheKey, result.data);
    try { sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ at: Date.now(), payload: result.data })); } catch { /* cache remains in memory */ }
    return result.data;
  }).finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  queue = request.then(() => undefined, () => undefined);
  return request;
}
