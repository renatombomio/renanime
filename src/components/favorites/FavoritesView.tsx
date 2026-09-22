import { useEffect, useRef, useState } from "react";

import { getTmdbArtworkBatch, type TmdbArtwork } from "../../lib/api/tmdb";

interface FavoriteEntry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state: {
    favorite: boolean;
    recommended: boolean;
  };
}

interface Media {
  title: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface Props {
  entries: FavoriteEntry[];
}

export default function FavoritesView({ entries }: Props) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [artwork, setArtwork] = useState<Record<string, TmdbArtwork | null>>({});
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const variables: Record<string, string> = {};
      const fields = entries.map((entry, index) => {
        variables[`s${index}`] = entry.title;
        return `a${index}: Page(page: 1, perPage: 1) { media(search: $s${index}, type: ANIME, sort: SEARCH_MATCH) { title { romaji english } startDate { year } coverImage { extraLarge large } } }`;
      }).join("\n");
      const definitions = entries.map((_, index) => `$s${index}: String!`).join(", ");
      const query = `query Favorites(${definitions}) { ${fields} }`;

      try {
        const [aniListResponse, tmdbResult] = await Promise.all([
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables }),
          }),
          getTmdbArtworkBatch(entries),
        ]);

        if (aniListResponse.ok) {
          const payload = await aniListResponse.json();
          const result: Record<string, Media | null> = {};
          entries.forEach((entry, index) => {
            result[entry.animeId] = payload.data?.[`a${index}`]?.media?.[0] ?? null;
          });
          if (!cancelled) setMedia(result);
        }

        if (!cancelled) setArtwork(tmdbResult);
      } catch {
        // Personal titles remain visible if metadata is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entries]);

  const scroll = (direction: "prev" | "next") => {
    trackRef.current?.scrollBy({
      left: direction === "next" ? trackRef.current.clientWidth * 0.72 : -trackRef.current.clientWidth * 0.72,
      behavior: "smooth",
    });
  };

  return (
    <div className="favorites-view">
      <div className="favorites-intro">
        <span className="favorites-note">Una selección personal</span>

        <div className="favorites-controls" aria-label="Navegar favoritos">
          <button type="button" onClick={() => scroll("prev")} aria-label="Favoritos anteriores">←</button>
          <button type="button" onClick={() => scroll("next")} aria-label="Siguientes favoritos">→</button>
        </div>
      </div>

      <div className="favorites-track" ref={trackRef}>
        {entries.map((entry, index) => {
          const item = media[entry.animeId];
          const title = item?.title.romaji || item?.title.english || entry.title;
          const year = item?.startDate?.year;
          const visual = artwork[entry.title];
          const image = visual?.backdrop || item?.coverImage?.extraLarge || item?.coverImage?.large;

          return (
            <article className="favorite-card" key={entry.animeId}>
              <a href={`/anime/${entry.animeId}`} aria-label={`Ver ${title}`}>
                <div className="favorite-media">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading={index < 2 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="favorite-placeholder">
                      <strong>{entry.title}</strong>
                    </div>
                  )}

                  {visual?.logo && (
                    <div className="favorite-logo-wrap">
                      <img className="favorite-logo" src={visual.logo} alt={title} loading="lazy" />
                    </div>
                  )}

                  <div className="favorite-scrim" aria-hidden="true" />
                </div>

                <div className="favorite-caption">
                  {!visual?.logo && <h3>{title}</h3>}
                  {year && <span>{year}</span>}
                </div>
              </a>
            </article>
          );
        })}
      </div>

      {loading && <span className="favorites-loading">Cargando archivo…</span>}
    </div>
  );
}
