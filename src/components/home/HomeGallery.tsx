import { useEffect, useRef, useState } from "react";

interface Entry {
  animeId: string;
  title: string;
}

interface Media {
  title?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: Entry[];
}

const PAGE_SIZE = 9;
const CACHE_PREFIX = "renanime:collection:v3:";

async function fetchMedia(entries: Entry[]): Promise<Record<string, Media | null>> {
  const result: Record<string, Media | null> = {};
  const unresolved: Entry[] = [];

  for (const entry of entries) {
    const key = CACHE_PREFIX + entry.title.toLowerCase();
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const media = JSON.parse(cached) as Media | null;
        if (media?.coverImage?.extraLarge || media?.coverImage?.large) {
          result[entry.animeId] = media;
          continue;
        }
        sessionStorage.removeItem(key);
      }
    } catch {}
    unresolved.push(entry);
  }

  for (let offset = 0; offset < unresolved.length; offset += 15) {
    const chunk = unresolved.slice(offset, offset + 15);
    const variables: Record<string, string> = {};
    const fields = chunk.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;
      return `${alias}: Page(page: 1, perPage: 1) { media(search: $${key}, type: ANIME, sort: SEARCH_MATCH) { title { romaji english } coverImage { extraLarge large } } }`;
    }).join("\n");
    const definitions = chunk.map((_, index) => `$s${index}: String!`).join(", ");

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: `query HomeGallery(${definitions}) { ${fields} }`, variables }),
      });
      if (!response.ok) continue;
      const payload = await response.json();

      chunk.forEach((entry, index) => {
        const media = payload.data?.["a" + index]?.media?.[0] ?? null;
        result[entry.animeId] = media;
        try {
          sessionStorage.setItem(CACHE_PREFIX + entry.title.toLowerCase(), JSON.stringify(media));
        } catch {}
      });
    } catch {}
  }

  return result;
}

export default function HomeGallery({ entries }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(false);

  const page = entries.slice(0, visible);
  const hasMore = visible < entries.length;

  useEffect(() => {
    const missing = page.filter((entry) => !(entry.animeId in media));
    if (!missing.length) return;

    let cancelled = false;
    setLoading(true);
    fetchMedia(missing).then((result) => {
      if (!cancelled) setMedia((current) => ({ ...current, ...result }));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [visible]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    setVisible((current) => Math.min(current + PAGE_SIZE, entries.length));
  };

  return (
    <div className="home-gallery">
      <div className="home-gallery-grid">
        {page.map((entry, index) => {
          const item = media[entry.animeId];
          const image = item?.coverImage?.extraLarge ?? item?.coverImage?.large;
          return (
            <a
              className="home-gallery-card"
              href={`/anime/${entry.animeId}`}
              aria-label={`Ver ${item?.title?.romaji || item?.title?.english || entry.title}`}
              key={entry.animeId}
            >
              {image ? (
                <img src={image} alt="" loading="eager" />
              ) : (
                <div className="home-gallery-placeholder" aria-hidden="true" />
              )}
            </a>
          );
        })}
      </div>
      {loading && <div className="home-gallery-loading" aria-hidden="true" />}
      {hasMore && (
        <button
          type="button"
          className="home-gallery-load-more"
          onClick={loadMore}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </div>
  );
}
