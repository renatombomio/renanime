import { createClient } from "@supabase/supabase-js";

type CacheStatus = "HIT" | "MISS" | "BYPASS";
type CacheEnvelope<T> = { value: T };
const pending = new Map<string, Promise<{ value: unknown; cache: CacheStatus }>>();

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const cacheToken = import.meta.env.ANIME_SEARCH_CACHE_TOKEN;
const client = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-cache-token": cacheToken ?? "", "X-Client-Info": "renanime-discovery-cache" } },
    })
  : null;

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function read(key: string): Promise<unknown | null> {
  if (!client || !cacheToken) return null;
  const { data, error } = await client.rpc("anime_search_cache_get", { p_cache_key: key });
  if (error) {
    console.warn("[discovery-cache] read failed:", error.message);
    return null;
  }
  if (!data || typeof data !== "object" || !("value" in data)) return null;
  return (data as CacheEnvelope<unknown>).value;
}

async function write(key: string, namespace: string, dimensions: Record<string, unknown>, value: unknown, ttl: number) {
  if (!client || !cacheToken) return;
  const { error } = await client.rpc("anime_search_cache_put", {
    p_cache_key: key,
    p_query_type: "discovery",
    p_filters: { namespace, ...dimensions },
    p_payload: { value },
    p_ttl_seconds: ttl,
  });
  if (error) console.warn("[discovery-cache] write failed:", error.message);
}

async function claim(key: string, owner: string): Promise<boolean> {
  if (!client || !cacheToken) return false;
  const { data, error } = await client.rpc("anime_search_cache_claim", { p_cache_key: key, p_owner: owner });
  if (error) {
    console.warn("[discovery-cache] lock claim failed:", error.message);
    return false;
  }
  return data === true;
}

async function release(key: string, owner: string) {
  if (!client || !cacheToken) return;
  const { error } = await client.rpc("anime_search_cache_release", { p_cache_key: key, p_owner: owner });
  if (error) console.warn("[discovery-cache] lock release failed:", error.message);
}

export async function getPersistentCache<T>(
  namespace: string,
  dimensions: Record<string, unknown>,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; cache: CacheStatus }> {
  if (!client || !cacheToken) return { value: await loader(), cache: "BYPASS" };

  const key = await digest("discovery:" + JSON.stringify({ namespace, dimensions }));
  let job = pending.get(key) as Promise<{ value: T; cache: CacheStatus }> | undefined;
  if (!job) {
    job = (async () => {
      const cached = await read(key);
      if (cached !== null) return { value: cached as T, cache: "HIT" as const };

      const owner = crypto.randomUUID();
      let ownsLock = await claim(key, owner);
      if (!ownsLock) {
        for (let attempt = 0; attempt < 24; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const shared = await read(key);
          if (shared !== null) return { value: shared as T, cache: "HIT" as const };
          if (attempt === 12) ownsLock = await claim(key, owner);
          if (ownsLock) break;
        }
      }

      try {
        const secondHit = await read(key);
        if (secondHit !== null) return { value: secondHit as T, cache: "HIT" as const };
        const value = await loader();
        await write(key, namespace, dimensions, value, ttlSeconds);
        return { value, cache: "MISS" as const };
      } finally {
        if (ownsLock) await release(key, owner);
      }
    })();
    pending.set(key, job);
  }

  try {
    return await job;
  } finally {
    if (pending.get(key) === job) pending.delete(key);
  }
}
