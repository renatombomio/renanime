import { fetchRenMediaByIdentity, hasRenAnimeIdentity } from "../../lib/api/ren-anime-identities";
import { getDisplayTitle } from "../../lib/anime/display-title";
import AnimePosterDisplay from "../anime/AnimePosterDisplay";
import { useMemo } from "react";

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

const HOME_ANIME_COUNT = 50;
const HOME_SELECTION_SEED = "renanime-home-gallery-v1";

function stableRandomKey(value: string): number {
  let hash = 2166136261;
  for (const character of `${HOME_SELECTION_SEED}:${value}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}


export default function HomeGallery({ entries, lang = "es" }: Props) {
  const verifiedEntries = useMemo(() => entries.filter((entry) => hasRenAnimeIdentity(entry.animeId)), [entries]);
  const page = useMemo(
    () => [...verifiedEntries]
      .sort((a, b) => stableRandomKey(a.animeId) - stableRandomKey(b.animeId))
      .slice(0, HOME_ANIME_COUNT),
    [verifiedEntries],
  );
  const media = useMemo(() => fetchRenMediaByIdentity(page), [page]);

  const columns = [page.filter((_, index) => index % 3 === 0), page.filter((_, index) => index % 3 === 1), page.filter((_, index) => index % 3 === 2)];

  return (
    <div className="home-anime-marquee" aria-label={lang === "en" ? "Ren’s anime collection" : "Colección de anime de Ren"}>
      <div className="home-anime-marquee-window">
        {columns.map((column, columnIndex) => (
          <div className={`home-anime-marquee-track track-${columnIndex + 1}`} key={columnIndex}>
            {[...column, ...column].map((entry, index) => {
              const item = media[entry.animeId];
              const image = item?.coverImage?.extraLarge ?? item?.coverImage?.large;
              return (
                <div className="home-anime-marquee-card" key={`${entry.animeId}-${index}`} aria-hidden={index >= column.length}>
                  <AnimePosterDisplay src={image} title={getDisplayTitle(item?.title, entry.title)} loading="lazy" />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <style>{`
        .home-anime-marquee{width:100%;overflow:hidden}
        .home-anime-marquee-window{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(.55rem,1.5vw,1.25rem);height:clamp(390px,62vw,720px);overflow:hidden;mask-image:linear-gradient(to bottom,transparent,#000 8%,#000 92%,transparent)}
        .home-anime-marquee-track{--marquee-gap:clamp(.55rem,1.5vw,1.25rem);display:flex;flex-direction:column;gap:var(--marquee-gap);will-change:transform;animation:home-anime-rise 44s linear infinite}
        .home-anime-marquee-track.track-2{animation-duration:56s;animation-delay:-18s}
        .home-anime-marquee-track.track-3{animation-duration:49s;animation-delay:-31s}
        .home-anime-marquee-card{display:block;flex:0 0 auto;overflow:hidden;border-radius:8px;background:#111;aspect-ratio:3/4;pointer-events:none;user-select:none}
        .home-anime-marquee-card :global(img){display:block;width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
        .home-anime-marquee:hover .home-anime-marquee-track{animation-play-state:paused}
        @keyframes home-anime-rise{from{transform:translateY(0)}to{transform:translateY(calc(-50% - var(--marquee-gap) / 2))}}
        @media(max-width:520px){.home-anime-marquee-window{height:440px;gap:.45rem}.home-anime-marquee-track{--marquee-gap:.45rem}}
        @media(prefers-reduced-motion:reduce){.home-anime-marquee-window{height:auto;mask-image:none;overflow:visible}.home-anime-marquee-track{display:contents;animation:none}.home-anime-marquee-card{width:100%}}
      `}</style>
    </div>
  );
}
