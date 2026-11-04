import { fetchRenMediaByIdentity, hasRenAnimeIdentity } from "../../lib/api/ren-anime-identities";
import { getDisplayTitle } from "../../lib/anime/display-title";
import AnimePosterDisplay from "../anime/AnimePosterDisplay";
import { useEffect, useMemo, useState } from "react";

interface Entry {
  animeId: string;
  title: string;
}

interface Media {
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: Entry[];
  lang?: "es" | "en";
}

const PAGE_SIZE = 9;

async function fetchMedia(entries: Entry[]): Promise<Record<string, Media | null>> {
  return fetchRenMediaByIdentity(entries);
}

export default function HomeGallery({ entries, lang = "es" }: Props) {
  const verifiedEntries = useMemo(() => entries.filter((entry) => hasRenAnimeIdentity(entry.animeId)), [entries]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(false);

  const page = verifiedEntries.slice(0, visible);
  const hasMore = visible < verifiedEntries.length;

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
  }, [visible, verifiedEntries, media]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    setVisible((current) => Math.min(current + PAGE_SIZE, verifiedEntries.length));
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
              href={`${lang === "en" ? "/en" : ""}/anime/${entry.animeId}`}
              aria-label={`${lang === "en" ? "View" : "Ver"} ${getDisplayTitle(item?.title, entry.title)}`}
              key={entry.animeId}
            >
              <AnimePosterDisplay src={image} title={entry.title} loading={index < 6 ? "eager" : "lazy"} />
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
          {loading ? (lang === "en" ? "Loading…" : "Cargando…") : (lang === "en" ? "Load more" : "Cargar más")}
        </button>
      )}
    </div>
  );
}
