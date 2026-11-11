type AniListManga = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  description: string | null;
  volumes: number | null;
  status: string | null;
  siteUrl: string;
  staff: { edges: Array<{ role: string; node: { name: { full: string | null } } }> };
};
type AniListResponse = { data?: { Page?: { media?: AniListManga[] } }; errors?: Array<{ message?: string }> };
export type RecommendedManga = {
  id: number; title: string; author: string | null; cover: string | null;
  volumes: number | null; status: string | null; synopsis: string | null; siteUrl: string;
};
const ENDPOINT = "https://graphql.anilist.co";
let cache: { expiresAt: number; manga: RecommendedManga | null; rawSynopsis: string | null } | null = null;
const CACHE_MS = 60 * 60 * 1000;
function cleanDescription(value: string): string {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
async function translateToSpanish(value: string): Promise<string | null> {
  const clean = cleanDescription(value);
  if (!clean) return null;
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length) {
    if (rest.length <= 450) { chunks.push(rest); break; }
    let cut = rest.lastIndexOf(" ", 450);
    if (cut < 150) cut = 450;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  const translated: string[] = [];
  for (const chunk of chunks) {
    try {
      const requestUrl = "https://api.mymemory.translated.net/get?" + new URLSearchParams({ q: chunk, langpair: "en|es", mt: "1" });
      const response = await fetch(requestUrl, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const payload = await response.json();
      const result = payload.responseData?.translatedText;
      if (typeof result !== "string" || !result.trim()) return null;
      translated.push(result.trim());
    } catch { return null; }
  }
  return translated.join(" ");
}
export async function getRecommendedManga(lang: "es" | "en" = "es"): Promise<RecommendedManga | null> {
  if (cache && cache.expiresAt > Date.now()) {
    if (!cache.manga) return null;
    return { ...cache.manga, synopsis: lang === "es" && cache.rawSynopsis ? await translateToSpanish(cache.rawSynopsis) : cache.rawSynopsis };
  }
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: "query RecommendedManga { Page(page: 1, perPage: 1) { media(type: MANGA, format: MANGA, isAdult: false, sort: POPULARITY_DESC) { id title { romaji english native } coverImage { extraLarge large } description(asHtml: false) volumes status siteUrl staff(perPage: 10, sort: RELEVANCE) { edges { role node { name { full } } } } } } }",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("AniList returned HTTP " + response.status);
  const payload = await response.json() as AniListResponse;
  if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message).filter(Boolean).join("; "));
  const item = payload.data?.Page?.media?.[0] ?? null;
  if (!item) { cache = { manga: null, rawSynopsis: null, expiresAt: Date.now() + CACHE_MS }; return null; }
  const authorEdge = item.staff.edges.find((edge) => /story|art|author|original creator/i.test(edge.role));
  const rawSynopsis = item.description ? cleanDescription(item.description) : null;
  const manga: RecommendedManga = {
    id: item.id, title: item.title.romaji || item.title.english || item.title.native || "Untitled",
    author: authorEdge?.node.name.full || null,
    cover: item.coverImage.extraLarge || item.coverImage.large || null,
    volumes: item.volumes, status: item.status, synopsis: null, siteUrl: item.siteUrl,
  };
  cache = { manga, rawSynopsis, expiresAt: Date.now() + CACHE_MS };
  return { ...manga, synopsis: lang === "es" && rawSynopsis ? await translateToSpanish(rawSynopsis) : rawSynopsis };
}
