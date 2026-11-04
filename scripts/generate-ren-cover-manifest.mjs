#!/usr/bin/env node
/**
 * Builds the static poster manifest for Ren's fixed collection.
 * Run from the repository root: node scripts/generate-ren-cover-manifest.mjs
 *
 * The script is resumable: resolved entries are kept and only missing entries
 * are queried again. Provider requests are sequential and rate-limited.
 */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "src/data/ren-cover-manifest.json");
const INPUTS = ["src/data/library.ts", "src/data/franchise-movies.ts"];
const ANILIST_INTERVAL = 2_200; // <= 27 requests/minute
const JIKAN_INTERVAL = 1_100;   // conservative public API pacing
const REQUEST_TIMEOUT = 12_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = "") => value.toLocaleLowerCase("en")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (value) => normalize(value).split(/\s+/).filter((token) => token.length > 2);

function similarity(query, candidate) {
  const wanted = new Set(tokens(query));
  const found = new Set(tokens(candidate));
  if (!wanted.size || !found.size) return 0;
  let overlap = 0;
  for (const token of wanted) if (found.has(token)) overlap++;
  return overlap / wanted.size;
}

function chooseCandidate(items, requestedTitle, requestedFormat, getTitles, getFormat, getPoster) {
  const candidates = items.map((item) => {
    const titles = getTitles(item).filter(Boolean);
    const exact = titles.some((title) => normalize(title) === normalize(requestedTitle));
    const score = exact ? 1 : Math.max(0, ...titles.map((title) => similarity(requestedTitle, title)));
    return { item, exact, score, format: getFormat(item), poster: getPoster(item) };
  }).filter((candidate) => {
    if (requestedFormat === "MOVIE" && String(candidate.format).toUpperCase() !== "MOVIE") return false;
    if (requestedFormat !== "MOVIE" && ["MOVIE", "SPECIAL", "MUSIC", "CM", "PV"].includes(String(candidate.format).toUpperCase())) return false;
    return (candidate.exact || candidate.score >= 0.72) && candidate.poster;
  }).sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score);
  return candidates[0] ?? null;
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      if (response.status === 429 && retryAfter > 0) await sleep(retryAfter * 1000);
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

let lastAniListAt = 0;
let lastJikanAt = 0;
async function rateLimit(provider) {
  const now = Date.now();
  const interval = provider === "anilist" ? ANILIST_INTERVAL : JIKAN_INTERVAL;
  const last = provider === "anilist" ? lastAniListAt : lastJikanAt;
  if (now - last < interval) await sleep(interval - (now - last));
  if (provider === "anilist") lastAniListAt = Date.now();
  else lastJikanAt = Date.now();
}

async function fromAniList(entry) {
  await rateLimit("anilist");
  const query = \`query($search:String!,$perPage:Int!){Page(page:1,perPage:$perPage){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id idMal format title{romaji english native} synonyms coverImage{extraLarge large}}}}\`;
  const payload = await fetchJson("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables: { search: entry.title, perPage: 10 } }),
  });
  const items = payload?.data?.Page?.media ?? [];
  const match = chooseCandidate(items, entry.title, entry.format,
    (item) => [item.title?.romaji, item.title?.english, item.title?.native, ...(item.synonyms ?? [])],
    (item) => item.format,
    (item) => item.coverImage?.extraLarge || item.coverImage?.large);
  return match ? { provider: "anilist", externalId: String(match.item.id), posterUrl: match.poster } : null;
}

async function fromJikan(entry) {
  await rateLimit("jikan");
  const url = new URL("https://api.jikan.moe/v4/anime");
  url.searchParams.set("q", entry.title);
  url.searchParams.set("limit", "10");
  if (entry.format === "MOVIE") url.searchParams.set("type", "movie");
  const payload = await fetchJson(url);
  const items = payload?.data ?? [];
  const match = chooseCandidate(items, entry.title, entry.format,
    (item) => [item.title, item.title_english, item.title_japanese, ...(item.title_synonyms ?? [])],
    (item) => item.type,
    (item) => item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.webp?.image_url || item.images?.jpg?.image_url);
  return match ? { provider: "jikan", externalId: String(match.item.mal_id), posterUrl: match.poster } : null;
}

async function fromKitsu(entry) {
  const url = new URL("https://kitsu.io/api/edge/anime");
  url.searchParams.set("filter[text]", entry.title);
  url.searchParams.set("page[limit]", "10");
  const payload = await fetchJson(url, { headers: { accept: "application/vnd.api+json" } });
  const items = payload?.data ?? [];
  const match = chooseCandidate(items, entry.title, entry.format,
    (item) => [item.attributes?.canonicalTitle, ...Object.values(item.attributes?.titles ?? {}), ...(item.attributes?.abbreviatedTitles ?? [])],
    (item) => String(item.attributes?.subtype || "").toUpperCase(),
    (item) => item.attributes?.posterImage?.original || item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium);
  return match ? { provider: "kitsu", externalId: String(match.item.id), posterUrl: match.poster } : null;
}

function parseEntries(source) {
  const entries = [];
  const pattern = /\{\s*animeId:\s*"([^"]+)",\s*title:\s*"((?:\\.|[^"])*)"(?:,\s*franchiseId:\s*"[^"]*")?(?:,\s*format:\s*"(MOVIE|SERIES)")?/g;
  for (const match of source.matchAll(pattern)) {
    entries.push({
      animeId: match[1],
      title: match[2].replace(/\\"/g, '"').replace(/\\'/g, "'"),
      format: match[3] || "SERIES",
    });
  }
  return entries;
}

async function saveManifest(manifest) {
  const temp = MANIFEST_PATH + ".tmp";
  await writeFile(temp, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await rename(temp, MANIFEST_PATH);
}

const sources = await Promise.all(INPUTS.map((file) => readFile(path.join(ROOT, file), "utf8")));
const sourceEntries = new Map();
for (const source of sources) for (const entry of parseEntries(source)) sourceEntries.set(entry.animeId, entry);

let manifest;
try {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
} catch {
  manifest = { version: 1, entries: [] };
}
const previous = new Map((manifest.entries ?? []).map((entry) => [entry.animeId, entry]));
manifest.entries = [...sourceEntries.values()].map((entry) => {
  const old = previous.get(entry.animeId);
  return old?.posterUrl ? { ...entry, ...old } : { ...entry, ...old, status: "pending", provider: null, externalId: null, posterUrl: null };
});
manifest.total = manifest.entries.length;
manifest.source = INPUTS.join(" + ");
await saveManifest(manifest);

let resolved = manifest.entries.filter((entry) => Boolean(entry.posterUrl)).length;
console.log(\`Resolving \${manifest.total} collection covers. \${resolved} already resolved; requests are rate-limited.\`);

for (const entry of manifest.entries) {
  if (entry.posterUrl) continue;
  let result = await fromAniList(entry);
  if (!result) result = await fromJikan(entry);
  if (!result) result = await fromKitsu(entry);

  if (result) {
    Object.assign(entry, result, { status: "resolved" });
    resolved++;
  } else {
    Object.assign(entry, { provider: null, externalId: null, posterUrl: null, status: "unresolved" });
  }
  manifest.generatedAt = new Date().toISOString();
  await saveManifest(manifest);
  console.log(\`[\${resolved}/\${manifest.total}] \${entry.animeId} — \${entry.title}: \${entry.status}\`);
}

const unresolved = manifest.entries.filter((entry) => !entry.posterUrl);
await writeFile(path.join(ROOT, "reports/ren-cover-manifest-unresolved.json"), JSON.stringify(unresolved, null, 2) + "\n", "utf8").catch(async () => {
  await mkdir(path.join(ROOT, "reports"), { recursive: true });
  await writeFile(path.join(ROOT, "reports/ren-cover-manifest-unresolved.json"), JSON.stringify(unresolved, null, 2) + "\n", "utf8");
});
console.log(\`Finished: \${resolved}/\${manifest.total} resolved; \${unresolved.length} need manual review.\`);
