export type MangaDemographic = "SHOUNEN" | "SEINEN" | "SHOUJO" | "JOSEI";
export type MangaItem = {
  id: number; title: string; nativeTitle: string | null; cover: string | null; author: string | null;
  volumes: number | null; chapters: number | null; status: string | null; year: number | null;
  synopsis: string | null; genres: string[]; tags: { name: string; rank: number | null }[];
  demographic: MangaDemographic | null; siteUrl: string;
};
type AniListMedia = {
  id: number; title?: { romaji?: string | null; english?: string | null; native?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null }; description?: string | null;
  volumes?: number | null; chapters?: number | null; status?: string | null; startDate?: { year?: number | null } | null;
  genres?: string[]; tags?: { name: string; rank?: number | null }[];
  staff?: { edges: { role: string; node: { name: { full: string | null } } }[] }; siteUrl?: string;
};
const ENDPOINT = "https://graphql.anilist.co";
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const FIELDS = `id title { romaji english native } coverImage { extraLarge large } description(asHtml:false) volumes chapters status startDate { year } genres tags { name rank } staff(perPage:10, sort:RELEVANCE) { edges { role node { name { full } } } } siteUrl`;
const DEMOGRAPHICS: Record<MangaDemographic, string> = { SHOUNEN: "Shounen", SEINEN: "Seinen", SHOUJO: "Shoujo", JOSEI: "Josei" };
function cleanDescription(value?: string | null): string | null {
  if (!value) return null;
  return value.replace(/<br\\s*\\/?\\s*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\s+/g, " ").trim() || null;
}
function normalize(item: AniListMedia): MangaItem {
  const tags = item.tags ?? [];
  const demographicTag = tags.find((tag) => Object.values(DEMOGRAPHICS).some((label) => label.toLowerCase() === tag.name.toLowerCase()));
  const demographic = (Object.entries(DEMOGRAPHICS).find(([, label]) => label.toLowerCase() === demographicTag?.name.toLowerCase())?.[0] ?? null) as MangaDemographic | null;
  const author = item.staff?.edges.find((edge) => /story|art|author|original creator/i.test(edge.role))?.node.name.full ?? null;
  return {
    id: item.id, title: item.title?.romaji || item.title?.english || item.title?.native || "Untitled",
    nativeTitle: item.title?.native ?? null, cover: item.coverImage?.extraLarge || item.coverImage?.large || null,
    author, volumes: item.volumes ?? null, chapters: item.chapters ?? null, status: item.status ?? null,
    year: item.startDate?.year ?? null, synopsis: cleanDescription(item.description), genres: item.genres ?? [],
    tags, demographic, siteUrl: item.siteUrl ?? `https://anilist.co/manga/${item.id}`,
  };
}
async function queryAniList<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
  const payload = await response.json() as { data?: T; errors?: { message?: string }[] };
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join("; "));
  if (!payload.data) throw new Error("AniList returned an empty response");
  return payload.data;
}
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as T;
  const value = await load(); cache.set(key, { value, expiresAt: Date.now() + CACHE_MS }); return value;
}
export async function getMangaHome(options: { search?: string; demographic?: MangaDemographic | null; unclassified?: boolean } = {}) {
  const search = options.search?.trim() || "";
  const demographic = options.demographic ?? null;
  const unclassified = Boolean(options.unclassified);
  const key = `home:${search}:${demographic ?? "ALL"}:${unclassified}`;
  return cached(key, async () => {
    const variables = { search: search || null, tag: demographic ? DEMOGRAPHICS[demographic] : null };
    const query = `query MangaHome($search:String,$tag:String) {
      featured: Page(page:1,perPage:1) { media(type:MANGA,format:MANGA,isAdult:false,search:$search,tag:$tag,tag_not_in:${unclassified ? '["Shounen","Seinen","Shoujo","Josei"]' : "null"},sort:TRENDING_DESC) { ${FIELDS} } }
      arrivals: Page(page:1,perPage:4) { media(type:MANGA,format:MANGA,isAdult:false,search:$search,tag:$tag,tag_not_in:${unclassified ? '["Shounen","Seinen","Shoujo","Josei"]' : "null"},sort:ID_DESC) { ${FIELDS} } }
      popular: Page(page:1,perPage:5) { media(type:MANGA,format:MANGA,isAdult:false,search:$search,tag:$tag,tag_not_in:${unclassified ? '["Shounen","Seinen","Shoujo","Josei"]' : "null"},sort:POPULARITY_DESC) { ${FIELDS} } }
      shounen: Page(page:1,perPage:1) { pageInfo { total } media(type:MANGA,isAdult:false,tag:"Shounen") { id } }
      seinen: Page(page:1,perPage:1) { pageInfo { total } media(type:MANGA,isAdult:false,tag:"Seinen") { id } }
      shoujo: Page(page:1,perPage:1) { pageInfo { total } media(type:MANGA,isAdult:false,tag:"Shoujo") { id } }
      josei: Page(page:1,perPage:1) { pageInfo { total } media(type:MANGA,isAdult:false,tag:"Josei") { id } }
      unknown: Page(page:1,perPage:1) { pageInfo { total } media(type:MANGA,isAdult:false,tag_not_in:["Shounen","Seinen","Shoujo","Josei"]) { id } }
    }`;
    const data = await queryAniList<Record<string, { media?: AniListMedia[]; pageInfo?: { total?: number } }>>(query, variables);
    const list = (name: string) => (data[name]?.media ?? []).map(normalize);
    return {
      featured: list("featured")[0] ?? null, arrivals: list("arrivals"), popular: list("popular"),
      counts: { SHOUNEN: data.shounen?.pageInfo?.total ?? 0, SEINEN: data.seinen?.pageInfo?.total ?? 0,
        SHOUJO: data.shoujo?.pageInfo?.total ?? 0, JOSEI: data.josei?.pageInfo?.total ?? 0, UNKNOWN: data.unknown?.pageInfo?.total ?? 0 },
      search, demographic, unclassified,
    };
  });
}
export async function getMangaById(id: number): Promise<MangaItem | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return cached(`manga:${id}`, async () => {
    const data = await queryAniList<{ Media?: AniListMedia | null }>(`query MangaDetail($id:Int!) { Media(id:$id,type:MANGA) { ${FIELDS} } }`, { id });
    return data.Media ? normalize(data.Media) : null;
  });
}
export function demographicLabel(value: MangaDemographic | null, lang: "es" | "en") {
  const labels: Record<MangaDemographic, { es: string; en: string }> = {
    SHOUNEN: { es: "Shonen", en: "Shonen" }, SEINEN: { es: "Seinen", en: "Seinen" },
    SHOUJO: { es: "Shojo", en: "Shojo" }, JOSEI: { es: "Josei", en: "Josei" },
  };
  return value ? labels[value][lang] : lang === "en" ? "Unclassified" : "Sin demografía";
}
