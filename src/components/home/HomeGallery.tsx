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

const PAGE_SIZE = 18;

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

  const columns = [page.filter((_, index) => index % 3 === 0), page.filter((_, index) => index % 3 === 1), page.filter((_, index) => index % 3 === 2)];

  return (
    <div className="home-anime-marquee" aria-label={lang === "en" ? "Anime gallery" : "Galería de anime"}>
      <div className="home-anime-marquee-heading">
        <span>{lang === "en" ? "A world of stories" : "Un mundo de historias"}</span>
        <span>{lang === "en" ? "Discover anime" : "Descubre anime"}</span>
      </div>
      <div className="home-anime-marquee-window">
        {columns.map((column, columnIndex) => (
          <div className={`home-anime-marquee-track track-${columnIndex + 1}`} key={columnIndex}>
            {[...column, ...column].map((entry, index) => {
              const item = media[entry.animeId];
              const image = item?.coverImage?.extraLarge ?? item?.coverImage?.large;
              return (
                <a className="home-anime-marquee-card" href={`${lang === "en" ? "/en" : ""}/anime/${entry.animeId}`}
                  aria-label={`${lang === "en" ? "View" : "Ver"} ${getDisplayTitle(item?.title, entry.title)}`}
                  key={`${entry.animeId}-${index}`} tabIndex={index >= column.length ? -1 : 0}>
                  <AnimePosterDisplay src={image} title={getDisplayTitle(item?.title, entry.title)} loading="lazy" />
                </a>
              );
            })}
          </div>
        ))}
      </div>
      <style>{`
        .home-anime-marquee{width:100%;overflow:hidden}
        .home-anime-marquee-heading{display:flex;justify-content:space-between;align-items:center;margin:0 0 1rem;color:var(--color-text-muted);font-family:var(--font-meta);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}
        .home-anime-marquee-heading span:first-child{color:var(--color-accent)}
        .home-anime-marquee-window{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(.55rem,1.5vw,1.25rem);height:clamp(390px,62vw,720px);overflow:hidden;mask-image:linear-gradient(to bottom,transparent,#000 8%,#000 92%,transparent)}
        .home-anime-marquee-track{display:flex;flex-direction:column;gap:clamp(.55rem,1.5vw,1.25rem);will-change:transform;animation:home-anime-rise 44s linear infinite}
        .home-anime-marquee-track.track-2{animation-duration:56s;animation-delay:-18s}
        .home-anime-marquee-track.track-3{animation-duration:49s;animation-delay:-31s}
        .home-anime-marquee-card{display:block;flex:0 0 auto;overflow:hidden;border-radius:8px;background:#111;aspect-ratio:3/4}
        .home-anime-marquee-card :global(img){display:block;width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
        .home-anime-marquee-card:hover :global(img){transform:scale(1.045)}
        .home-anime-marquee:hover .home-anime-marquee-track{animation-play-state:paused}
        @keyframes home-anime-rise{from{transform:translateY(0)}to{transform:translateY(calc(-50% - .4rem))}}
        @media(max-width:520px){.home-anime-marquee-window{height:440px;gap:.45rem}.home-anime-marquee-track{gap:.45rem}.home-anime-marquee-heading{font-size:.58rem}}
        @media(prefers-reduced-motion:reduce){.home-anime-marquee-window{height:auto;mask-image:none;overflow-x:auto}.home-anime-marquee-track{animation:none}.home-anime-marquee-track:not(:first-child){display:none}.home-anime-marquee-track:first-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));flex-direction:row}.home-anime-marquee-card{width:100%}}
      `}</style>
    </div>
  );
}
