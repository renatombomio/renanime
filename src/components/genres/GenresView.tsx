import { useEffect, useMemo, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { buildGenreCatalog } from "../../lib/anime/genre-catalog";
import { fetchFallbackPoster, selectBestAnimeCandidate } from "../../lib/api/poster-fallback";

interface Props {
  entries: LibraryEntry[];
}

interface GenreMedia {
  genres?: string[];
  coverImage?: { large?: string; extraLarge?: string };
  title?: { romaji?: string; english?: string };
  format?: string;
  seasonYear?: number;
  startDate?: { year?: number; month?: number; day?: number };
}

const BATCH_SIZE = 25;
const CACHE_PREFIX = "renanime:collection:v3:";

function getCacheKey(entry: LibraryEntry) {
  return CACHE_PREFIX + entry.title.toLowerCase();
}

async function fetchMediaMetadata(entries: LibraryEntry[], includeImages = false): Promise<Record<string, GenreMedia>> {
  const result: Record<string, GenreMedia> = {};
  const unresolved: LibraryEntry[] = [];

  for (const entry of entries) {
    try {
      const cached = sessionStorage.getItem(getCacheKey(entry));
      if (cached) {
        const media = JSON.parse(cached) as GenreMedia;
        if (Array.isArray(media.genres) && (!includeImages || media.coverImage?.large || media.coverImage?.extraLarge)) {
          result[entry.animeId] = media;
          continue;
        }
      }
    } catch {}
    unresolved.push(entry);
  }

  for (let start = 0; start < unresolved.length; start += BATCH_SIZE) {
    const batch = unresolved.slice(start, start + BATCH_SIZE);
    const variables: Record<string, string> = {};

    const fields = batch.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;
      return alias + ': Page(page: 1, perPage: 1) { media(search: $' + key + ', type: ANIME, sort: SEARCH_MATCH) { genres coverImage { large extraLarge } title { romaji english } format seasonYear startDate { year month day } } }';
    }).join("\n");

    const definitions = batch.map((_, index) => "$s" + index + ": String!").join(", ");

    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: "query GenreMediaBatch(" + definitions + ") { " + fields + " }",
          variables,
        }),
      });

      if (!response.ok) continue;
      const payload = await response.json();

      batch.forEach((entry, index) => {
        const candidates = payload.data?.["a" + index]?.media ?? [];
        const media = selectBestAnimeCandidate(candidates, entry.title, entry.format) as GenreMedia | null;
        result[entry.animeId] = media ?? { genres: [] };
        if (includeImages && !media?.coverImage?.large && !media?.coverImage?.extraLarge) {
          const poster = await fetchFallbackPoster(entry.title, entry.format);
          if (poster) result[entry.animeId] = { ...(media ?? { genres: [] }), title: media?.title ?? { romaji: entry.title }, format: media?.format ?? entry.format, coverImage: { large: poster, extraLarge: poster } };
        }
        if (media) {
          try { sessionStorage.setItem(getCacheKey(entry), JSON.stringify(media)); } catch {}
        }
      });
    } catch {}
  }

  return result;
}

export default function GenresView({ entries }: Props) {
  const [metadata, setMetadata] = useState<Record<string, GenreMedia>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const media = await fetchMediaMetadata(entries);
      if (!cancelled) {
        setMetadata(media);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [entries]);

  const genresByAnimeId = useMemo(
    () => Object.fromEntries(Object.entries(metadata).map(([animeId, media]) => [animeId, media.genres ?? []])),
    [metadata],
  );

  const catalog = useMemo(() => buildGenreCatalog(entries, genresByAnimeId), [entries, genresByAnimeId]);
  const selectedGenre = catalog.find((genre) => genre.name === selected);

  const selectedEntryIds = selectedGenre?.entries.map((entry) => entry.animeId).join("|") ?? "";

  useEffect(() => {
    if (!selected || !selectedEntryIds) return;
    const genre = catalog.find((item) => item.name === selected);
    if (!genre) return;

    let cancelled = false;

    async function loadImages() {
      setResultsLoading(true);
      const media = await fetchMediaMetadata(genre.entries, true);
      if (!cancelled) {
        setMetadata((current) => ({ ...current, ...media }));
        setResultsLoading(false);
      }
    }

    loadImages();
    return () => { cancelled = true; };
  }, [selected, selectedEntryIds]);

  useEffect(() => {
    if (selected && !selectedGenre) setSelected(null);
  }, [selected, selectedGenre]);

  return (
    <div className="genres-view">
      {!selectedGenre ? (
        <>
          <div className="genres-meta">
            <span>{loading ? "Construyendo mapa…" : catalog.length + " géneros"}</span>
            <span>{entries.length} títulos vistos</span>
          </div>

          <div className="genres-grid">
            {catalog.map((genre) => (
              <button
                type="button"
                className="genre-card"
                key={genre.name}
                aria-pressed={selected === genre.name}
                onClick={() => setSelected(genre.name)}
              >
                <span className="genre-name">{genre.name}</span>
                <span className="genre-count">{genre.entries.length} títulos</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <section className="genre-results" aria-label={"Animes de género " + selectedGenre.name}>
          <div className="genre-results-head">
            <button type="button" className="genre-back" onClick={() => setSelected(null)}>
              ← Géneros
            </button>
            <div>
              <span className="genre-results-kicker">Archivo de Ren</span>
              <span className="genre-results-title">{selectedGenre.name}</span>
            </div>
            <span>{selectedGenre.entries.length} títulos</span>
          </div>

          {resultsLoading ? (
            <div className="genre-results-loading" role="status" aria-live="polite">Cargando títulos…</div>
          ) : (
            <div className="genre-results-grid">
              {selectedGenre.entries.map((entry, index) => {
                const media = metadata[entry.animeId];
                const image = media?.coverImage?.extraLarge ?? media?.coverImage?.large;

                return (
                  <a className="genre-anime-card" href={"/anime/" + entry.animeId} key={entry.animeId}>
                    <div className="genre-anime-poster">
                      {image ? (
                        <img src={image} alt="" loading={index < 6 ? "eager" : "lazy"} />
                      ) : (
                        <div className="genre-anime-placeholder">
                          <strong>{entry.title}</strong>
                        </div>
                      )}
                    </div>
                    <div className="genre-anime-info">
                      <strong>{media?.title?.romaji || media?.title?.english || entry.title}</strong>
                      <span>{media?.startDate?.year ? media.startDate.month && media.startDate.day ? new Date(media.startDate.year, media.startDate.month - 1, media.startDate.day).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : String(media.startDate.year) : "Fecha desconocida"} · {entry.format === "MOVIE" || media?.format === "MOVIE" ? "Film" : "Series"}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && catalog.length === 0 && (
        <p className="genres-empty">No hemos podido recuperar los géneros de tu colección.</p>
      )}

      <style>{`
        .genres-view {
          width: 100%;
        }

        .genres-meta {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: .9rem;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-muted-400);
          font: 500 .58rem/1 var(--font-meta);
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .genres-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          margin-top: clamp(2rem, 4vw, 3.5rem);
          background: var(--color-border);
          border: 1px solid var(--color-border);
        }

        .genres-view .genre-card {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          width: auto;
          min-width: 0;
          min-height: 0;
          height: 9rem;
          padding: .9rem 1rem;
          margin: 0;
          border: 0;
          background: var(--color-ink-950);
          color: var(--color-paper-50);
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          box-sizing: border-box;
          appearance: none;
          -webkit-appearance: none;
          transition: background 220ms ease;
        }

        .genres-view .genre-card:hover,
        .genres-view .genre-card:focus-visible {
          background: var(--color-ink-900);
        }

        .genres-view .genre-card::after {
          position: absolute;
          left: .9rem;
          bottom: .8rem;
          width: 1.6rem;
          height: 1px;
          background: var(--color-accent-soft);
          content: "";
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 260ms cubic-bezier(.22,1,.36,1);
        }

        .genres-view .genre-card:hover::after,
        .genres-view .genre-card:focus-visible::after {
          transform: scaleX(1);
        }

        .genres-view .genre-name {
          display: block;
          max-width: 100%;
          min-width: 0;
          color: var(--color-paper-50);
          font-family: var(--font-heading);
          font-size: clamp(1.1rem, 2vw, 1.8rem) !important;
          font-weight: 400;
          letter-spacing: -.035em;
          line-height: 1.05;
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
          text-wrap: balance;
        }

        .genres-view .genre-count {
          display: block;
          color: var(--color-muted-400);
          font: 500 .6rem/1 var(--font-meta);
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .genre-results {
          margin-top: clamp(2.5rem, 5vw, 4rem);
        }

        .genre-results-head {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: end;
          gap: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .genre-results-head > span:last-child {
          justify-self: end;
          color: var(--color-muted-400);
          font: 500 .58rem/1 var(--font-meta);
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .genre-back {
          justify-self: start;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--color-muted-400);
          font: 500 .58rem/1 var(--font-meta);
          letter-spacing: .1em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .genre-back:hover { color: var(--color-paper-50); }

        .genre-results-head > div {
          display: grid;
          gap: .35rem;
          text-align: center;
        }

        .genre-results-kicker {
          color: var(--color-accent-soft);
          font: 500 .52rem/1 var(--font-meta);
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .genre-results-title {
          color: var(--color-paper-50);
          font-family: var(--font-heading);
          font-size: clamp(1.8rem, 4vw, 3.6rem);
          font-weight: 400;
          letter-spacing: -.05em;
          line-height: .9;
        }

        .genre-results-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(1.2rem, 2.5vw, 2.5rem) 1rem;
          margin-top: clamp(2rem, 4vw, 3.5rem);
        }

        .genre-anime-card {
          min-width: 0;
          color: inherit;
          text-decoration: none;
        }

        .genre-anime-poster {
          position: relative;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          background: var(--color-ink-900);
        }

        .genre-anime-poster img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 650ms cubic-bezier(.22,1,.36,1);
        }

        .genre-anime-card:hover .genre-anime-poster img {
          transform: scale(1.025);
        }

        .genre-anime-info {
          display: grid;
          gap: .35rem;
          padding-top: .75rem;
        }

        .genre-anime-info strong {
          color: var(--color-paper-50);
          font: 500 .75rem/1.2 var(--font-body);
        }

        .genre-anime-info span {
          color: var(--color-muted-400);
          font: 500 .48rem/1.2 var(--font-meta);
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .genre-results-loading,
        .genres-empty {
          padding: 4rem 1rem;
          color: var(--color-muted-400);
          font: 500 .65rem/1 var(--font-meta);
          letter-spacing: .08em;
          text-align: center;
          text-transform: uppercase;
        }

        @media (max-width: 900px) {
          .genres-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .genres-view .genre-card {
            height: 7.5rem;
          }

          .genre-results-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .genres-meta {
            display: grid;
            gap: .5rem;
          }

          .genres-view .genre-card {
            height: 7rem;
            padding: .75rem;
          }

          .genres-view .genre-name {
            font-size: clamp(1.15rem, 5.5vw, 1.5rem) !important;
          }

          .genre-results-head {
            grid-template-columns: 1fr auto;
          }

          .genre-results-head > div {
            grid-column: 1 / -1;
            grid-row: 1;
            order: -1;
            text-align: left;
          }

          .genre-results-head > span:last-child {
            grid-column: 2;
            grid-row: 2;
          }

          .genre-results-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem .7rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .genre-card,
          .genre-card::after,
          .genre-anime-poster img { transition-duration: .01ms !important; }
        }
      `}</style>

    </div>
  );
}
