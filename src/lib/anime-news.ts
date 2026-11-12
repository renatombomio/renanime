export type AnimeNewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: string;
};

type FeedSource = { name: string; url: string };
const FEEDS: FeedSource[] = [
  { name: "Crunchyroll News", url: "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss" },
  { name: "Anime News Network", url: "https://www.animenewsnetwork.com/news/rss.xml?ann-edition=us" },
];
const CACHE_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const EXCLUDED = /\\b(manga|manhwa|webtoon|graphic novel|comic book)\\b/i;
let cache: { expiresAt: number; items: AnimeNewsItem[] } | null = null;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function readTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
  const match = xml.match(new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, "i"));
  return decodeEntities((match?.[1] ?? "").replace(/^<!\\[CDATA\\[([\\s\\S]*)\\]\\]>$/, "$1").trim());
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<script[\\s\\S]*?<\\/script>/gi, " ").replace(/<style[\\s\\S]*?<\\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ")).trim();
}

function extractImage(xml: string): string | null {
  const candidates = [
    xml.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1],
    xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1],
    xml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(decodeEntities(candidate));
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch { /* Ignore malformed feed image URLs. */ }
  }
  return null;
}

function parseFeed(xml: string, source: FeedSource, now: number): AnimeNewsItem[] {
  return [...xml.matchAll(/<item\\b[^>]*>([\\s\\S]*?)<\\/item>/gi)].flatMap((match) => {
    const raw = match[1];
    const title = cleanText(readTag(raw, "title"));
    const link = readTag(raw, "link");
    const description = cleanText(readTag(raw, "description") || readTag(raw, "content:encoded"));
    const dateValue = readTag(raw, "pubDate") || readTag(raw, "published") || readTag(raw, "updated");
    const timestamp = Date.parse(dateValue);
    if (!title || !/^https?:\\/\\//i.test(link) || EXCLUDED.test(`${title} ${description}`) || !Number.isFinite(timestamp) || now - timestamp > MAX_AGE_MS || timestamp > now + 60 * 60 * 1000) return [];
    return [{
      id: `${source.name}:${link}`,
      title,
      summary: description.slice(0, 190),
      url: link,
      image: extractImage(raw),
      publishedAt: new Date(timestamp).toISOString(),
      source: source.name,
    }];
  });
}

export async function getAnimeNews(now = Date.now()): Promise<AnimeNewsItem[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.items;
  const responses = await Promise.allSettled(FEEDS.map(async (source) => {
    const response = await fetch(source.url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`${source.name} RSS returned HTTP ${response.status}`);
    return { source, xml: await response.text() };
  }));
  const available = responses.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!available.length) throw new Error("All anime news feeds are unavailable.");
  const items = available.flatMap(({ source, xml }) => parseFeed(xml, source, now))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const unique = [...new Map(items.map((item) => [item.url, item])).values()].slice(0, 4);
  cache = { items: unique, expiresAt: Date.now() + CACHE_MS };
  return unique;
}
