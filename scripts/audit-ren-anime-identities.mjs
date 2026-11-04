#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUTS = [
  { path: "src/data/library.ts", exportName: "animeLibrary", defaultFormat: "SERIES" },
  { path: "src/data/franchise-movies.ts", exportName: "franchiseMovies", defaultFormat: "MOVIE" },
];
const ACCEPTED_PATH = path.join(ROOT, "src/data/ren-anime-identities.json");
const REVIEW_PATH = path.join(ROOT, "src/data/ren-anime-review.json");
const AUDIT_PATH = path.join(ROOT, "reports/ren-anime-audit.json");
const INTERVAL = 2200;
const HISTORICAL_COUNT = 221;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = "") => String(value).toLocaleLowerCase("en").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function extractObjects(source, exportName) {
  const declaration = new RegExp("export\\s+const\\s+" + exportName + "\\s*:\\s*[^=]+=\\s*\\[");
  const match = declaration.exec(source);
  if (!match) throw new Error("Export array not found: " + exportName);
  const start = match.index + match[0].length - 1;
  let depth = 0, quote = "", escaped = false, lineComment = false, blockComment = false, end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = ""; continue; }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "\`") { quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) { end = i; break; }
  }
  if (end < 0) throw new Error("Unclosed export array: " + exportName);
  const objects = [];
  depth = 0; quote = ""; escaped = false; lineComment = false; blockComment = false;
  let objectStart = -1;
  for (let i = start + 1; i < end; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = ""; continue; }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "\`") { quote = ch; continue; }
    if (ch === "{") { if (depth === 0) objectStart = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && objectStart >= 0) { objects.push(source.slice(objectStart, i + 1)); objectStart = -1; } }
  }
  return objects;
}
function property(source, key) {
  const match = new RegExp("\\b" + key + "\\s*:\\s*([\\"'])(.*?)\\1", "s").exec(source);
  return match ? match[2].replace(/\\(["'\\])/g, "$1").replace(/\\n/g, "\n") : null;
}
function parseEntries(source, input) {
  return extractObjects(source, input.exportName).map((object) => ({
    animeId: property(object, "animeId"),
    title: property(object, "title"),
    format: property(object, "format") || input.defaultFormat,
    source: input.path,
  })).filter((entry) => entry.animeId && entry.title);
}
function matchesFormat(requested, candidate) {
  const format = String(candidate || "").toUpperCase();
  return requested === "MOVIE" ? format === "MOVIE"
    : ["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL"].includes(format);
}
function titlesOf(item) {
  return [item.title?.romaji, item.title?.english, item.title?.native, ...(item.synonyms || [])].filter(Boolean);
}
function classify(entry, items) {
  const exact = items.filter((item) => titlesOf(item).some((title) => normalize(title) === normalize(entry.title)));
  const compatible = exact.filter((item) => matchesFormat(entry.format, item.format));
  if (compatible.length === 1) {
    const item = compatible[0];
    return { accepted: {
      animeId: entry.animeId, displayTitle: entry.title, format: entry.format,
      anilistId: item.id, matchedTitle: titlesOf(item).find((title) => normalize(title) === normalize(entry.title)),
      providerTitles: item.title, synonyms: item.synonyms || [], anilistFormat: item.format,
      coverImage: item.coverImage || null, decision: "unique-exact-title-and-format", reviewed: false,
    }};
  }
  return { review: {
    ...entry,
    reason: exact.length === 0 ? (items.length ? "NO_EXACT_TITLE_MATCH" : "NO_RESULTS")
      : compatible.length > 1 ? "MULTIPLE_EXACT_FORMAT_MATCHES" : "EXACT_TITLE_BUT_FORMAT_MISMATCH",
    exactCandidates: exact.map((item) => ({ anilistId: item.id, format: item.format, title: item.title, synonyms: item.synonyms || [], coverImage: item.coverImage || null })),
    suggestions: items.slice(0, 5).map((item) => ({ anilistId: item.id, format: item.format, title: item.title, synonyms: item.synonyms || [], coverImage: item.coverImage || null })),
  }};
}
let lastRequest = 0;
async function searchAniList(title) {
  const delay = INTERVAL - (Date.now() - lastRequest);
  if (delay > 0) await sleep(delay);
  lastRequest = Date.now();
  const query = "query($search:String!){Page(page:1,perPage:20){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id idMal format title{romaji english native} synonyms coverImage{extraLarge large}}}}";
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables: { search: title } }), signal: controller.signal,
      });
      if (response.ok) return (await response.json())?.data?.Page?.media || [];
      if (response.status !== 429 && response.status < 500) return [];
      const retry = Number(response.headers.get("retry-after") || 0);
      await sleep(retry ? retry * 1000 : 2000 * (attempt + 1));
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(1000 * (attempt + 1));
    } finally { clearTimeout(timeout); }
  }
  return [];
}
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}
async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + ".tmp";
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, file);
}

const entries = [];
for (const input of INPUTS) {
  entries.push(...parseEntries(await readFile(path.join(ROOT, input.path), "utf8"), input));
}
const idCounts = new Map();
const titleGroups = new Map();
for (const entry of entries) {
  idCounts.set(entry.animeId, (idCounts.get(entry.animeId) || 0) + 1);
  const key = normalize(entry.title);
  if (!titleGroups.has(key)) titleGroups.set(key, []);
  titleGroups.get(key).push({ animeId: entry.animeId, title: entry.title, format: entry.format });
}
const old = await readJson(ACCEPTED_PATH, { entries: [] });
const manual = new Map((old.entries || []).filter((item) => item.reviewed && item.decision === "manual").map((item) => [item.animeId, item]));
const accepted = [], review = [];
console.log("Entries: " + entries.length + ". AniList pacing: 2.2 seconds per title.");
for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];
  if (manual.has(entry.animeId)) { accepted.push(manual.get(entry.animeId)); continue; }
  try {
    const result = classify(entry, await searchAniList(entry.title));
    if (result.accepted) accepted.push(result.accepted);
    else review.push(result.review);
    console.log("[" + (i + 1) + "/" + entries.length + "] " + entry.animeId + " " + entry.title + ": " + (result.accepted ? "ACCEPTED" : result.review.reason));
  } catch (error) {
    review.push({ ...entry, reason: "REQUEST_FAILED", error: String(error), exactCandidates: [], suggestions: [] });
    console.error("[" + (i + 1) + "/" + entries.length + "] request failed: " + entry.animeId);
  }
  if ((i + 1) % 10 === 0) {
    const generatedAt = new Date().toISOString();
    await save(ACCEPTED_PATH, { version: 1, generatedAt, entries: accepted });
    await save(REVIEW_PATH, { version: 1, generatedAt, entries: review });
  }
}
const duplicates = [...idCounts].filter(([, count]) => count > 1).map(([animeId, count]) => ({ animeId, count }));
const duplicateTitles = [...titleGroups].filter(([, group]) => group.length > 1).map(([normalizedTitle, group]) => ({ normalizedTitle, entries: group }));
const audit = {
  generatedAt: new Date().toISOString(),
  historicalExpectedCount: HISTORICAL_COUNT,
  currentSourceCount: entries.length,
  differenceFromHistoricalCount: entries.length - HISTORICAL_COUNT,
  sourceBreakdown: Object.fromEntries(INPUTS.map((input) => [input.path, entries.filter((entry) => entry.source === input.path).length])),
  uniqueAnimeIds: idCounts.size,
  duplicateIds: duplicates,
  duplicateTitles,
  formats: { series: entries.filter((entry) => entry.format === "SERIES").length, movies: entries.filter((entry) => entry.format === "MOVIE").length },
  acceptedExactMatches: accepted.length,
  requiringReview: review.length,
  note: "221 is a historical reference. Inspect source history to explain the difference; do not assume the extra entries are new titles.",
};
await save(ACCEPTED_PATH, { version: 1, generatedAt: audit.generatedAt, entries: accepted });
await save(REVIEW_PATH, { version: 1, generatedAt: audit.generatedAt, entries: review });
await save(AUDIT_PATH, audit);
console.log("Finished: " + accepted.length + " accepted; " + review.length + " require review.");
console.log("Source total: " + entries.length + "; historical reference: " + HISTORICAL_COUNT + "; delta: " + audit.differenceFromHistoricalCount + ".");
