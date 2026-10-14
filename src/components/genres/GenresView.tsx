import { useEffect, useMemo, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { buildGenreCatalog } from "../../lib/anime/genre-catalog";
import { fetchFallbackPoster, selectBestAnimeCandidate } from "../../lib/api/poster-fallback";
import { useT, type Lang } from "../../i18n";

interface Props {
  entries: LibraryEntry[];
  lang?: Lang;
}

interface GenreMedia {
  genres?: string[];
  coverImage?: { large?: string; extraLarge?: string };
  title?: { romaji?: string; english?: string };
  format?: string;
  seasonYear?: number;
  startDate?: { year?: number; month?: number; day?: number };
}

const GENRE_DESCRIPTIONS: Record<string, { es: string; en: string }> = {
  Action: { es: "Combates, decisiones al límite y personajes que se ponen a prueba.", en: "High-stakes fights, hard choices, and characters pushed to their limits." },
  Adventure: { es: "Viajes a mundos desconocidos, grandes descubrimientos y nuevas alianzas.", en: "Journeys into the unknown, unexpected discoveries, and new alliances." },
  Comedy: { es: "Historias que encuentran el humor en sus personajes y situaciones.", en: "Stories that find humor in their characters and situations." },
  Drama: { es: "Relaciones, pérdidas y decisiones que dejan huella.", en: "Relationships, loss, and decisions that leave a mark." },
  Fantasy: { es: "Mundos extraordinarios, magia y reglas distintas a las nuestras.", en: "Extraordinary worlds, magic, and rules unlike our own." },
  Horror: { es: "Atmósferas inquietantes, miedo y encuentros con lo desconocido.", en: "Uneasy atmospheres, fear, and encounters with the unknown." },
  Mystery: { es: "Secretos, pistas y preguntas que piden ser resueltas.", en: "Secrets, clues, and questions waiting to be answered." },
  Romance: { es: "Vínculos que nacen, cambian y ponen los sentimientos a prueba.", en: "Connections that grow, change, and put feelings to the test." },
  "Sci-Fi": { es: "Tecnología, futuros posibles y preguntas sobre lo que nos hace humanos.", en: "Technology, possible futures, and questions about what makes us human." },
  "Science Fiction": { es: "Tecnología, futuros posibles y preguntas sobre lo que nos hace humanos.", en: "Technology, possible futures, and questions about what makes us human." },
  "Slice of Life": { es: "Momentos cotidianos, pequeños cambios y la belleza de lo cercano.", en: "Everyday moments, small changes, and the beauty of ordinary life." },
  Sports: { es: "Entrenamiento, rivalidad y el esfuerzo por superar los propios límites.", en: "Training, rivalry, and the effort to push beyond your limits." },
  Supernatural: { es: "Fenómenos inexplicables y fuerzas que van más allá de lo cotidiano.", en: "Unexplained phenomena and forces beyond everyday life." },
  Thriller: { es: "Tensión creciente, riesgos y giros que cambian lo que creías saber.", en: "Rising tension, real stakes, and twists that change what you know." },
  Psychological: { es: "Juegos mentales y conflictos que exploran los rincones de la mente.", en: "Mind games and conflicts that explore the corners of the human mind." },
  Mecha: { es: "Máquinas gigantes, pilotos y conflictos de escala monumental.", en: "Giant machines, pilots, and conflicts on a monumental scale." },
  Music: { es: "La música como lenguaje, pasión y punto de encuentro.", en: "Music as a language, a passion, and a point of connection." },
  Ecchi: { es: "Comedia y situaciones sugerentes para un público adulto.", en: "Suggestive situations and comedy for a mature audience." },
  "Mahou Shoujo": { es: "Transformaciones, poderes mágicos y heroínas que descubren su fuerza.", en: "Transformations, magical powers, and heroines discovering their strength." },
};

function getGenreDescription(name: string, lang: Lang) {
  const description = GENRE_DESCRIPTIONS[name];
  return description ? description[lang === "en" ? "en" : "es"] : undefined;
}

const BATCH_SIZE = 25;
const CACHE_PREFIX = "renanime:collection:v4:";

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
      return alias + ": Page(page: 1, perPage: 10) { media(search: $" + key + ", type: ANIME, sort: SEARCH_MATCH) { genres coverImage { large extraLarge } title { romaji english native } synonyms format seasonYear startDate { year month day } } }";
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

      for (const [index, entry] of batch.entries()) {
        const candidates = payload.data?.["a" + index]?.media ?? [];
        const media = selectBestAnimeCandidate(candidates, entry.title, entry.format) as GenreMedia | null;
        result[entry.animeId] = media ?? { genres: [] };
        if (includeImages && !media?.coverImage?.large && !media?.coverImage?.extraLarge) {
          const poster = await fetchFallbackPoster(entry.title, entry.format);
          if (poster) {
            result[entry.animeId] = {
              ...(media ?? { genres: [] }),
              title: media?.title ?? { romaji: entry.title },
              format: media?.format ?? entry.format,
              coverImage: { large: poster, extraLarge: poster },
            };
          }
        }
        if (media) {
          try { sessionStorage.setItem(getCacheKey(entry), JSON.stringify(media)); } catch {}
        }
      }
    } catch {}
  }

  return result;
}

export default function GenresView({ entries, lang = "es" }: Props) {
  const t = useT(lang);
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

  useEffect(() => {
    const page = document.querySelector(".genres-page");
    page?.classList.toggle("is-genre-selected", Boolean(selectedGenre));
    return () => page?.classList.remove("is-genre-selected");
  }, [selectedGenre]);

  useEffect(() => {
    if (catalog.length === 0) return;

    const syncSelectedGenre = () => {
      const genreFromUrl = new URLSearchParams(window.location.search).get("genre");
      const matchedGenre = genreFromUrl
        ? catalog.find((genre) => genre.name.toLocaleLowerCase() === genreFromUrl.toLocaleLowerCase())
        : undefined;
      setSelected(matchedGenre?.name ?? null);
    };

    syncSelectedGenre();
    window.addEventListener("popstate", syncSelectedGenre);
    return () => window.removeEventListener("popstate", syncSelectedGenre);
  }, [catalog]);

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
          <div className="genres-rows">
            {catalog.map((genre, genreIndex) => {
              const description = getGenreDescription(genre.name, lang);
              const openGenre = () => {
                setSelected(genre.name);
                const url = new URL(window.location.href);
                url.searchParams.set("genre", genre.name);
                window.history.pushState({ genre: genre.name }, "", url.pathname + url.search);
              };

              // Make the visual selection varied across genres rather than repeating the
              // same first few collection entries in every horizontal row.
              const genreEntryIds = new Set(genre.entries.map((entry) => entry.animeId));
              const orderedEntries = [
                ...entries.filter((entry) => genreEntryIds.has(entry.animeId) && metadata[entry.animeId]?.coverImage?.extraLarge),
                ...entries.filter((entry) => genreEntryIds.has(entry.animeId) && !metadata[entry.animeId]?.coverImage?.extraLarge && !metadata[entry.animeId]?.coverImage?.large),
                ...entries.filter((entry) => genreEntryIds.has(entry.animeId) && metadata[entry.animeId]?.coverImage?.large),
              ].filter((entry, index, all) => all.findIndex((item) => item.animeId === entry.animeId) === index);
              const featuredEntries = orderedEntries
                .filter((entry) => metadata[entry.animeId]?.genres?.includes(genre.name))
                .sort((a, b) => {
                  const aMedia = metadata[a.animeId];
                  const bMedia = metadata[b.animeId];
                  const aYear = aMedia?.startDate?.year ?? aMedia?.seasonYear ?? 0;
                  const bYear = bMedia?.startDate?.year ?? bMedia?.seasonYear ?? 0;
                  return bYear - aYear || a.title.localeCompare(b.title);
                });
              const displayedEntries = featuredEntries.length ? featuredEntries : orderedEntries;

              return (
                <section className="genre-row" key={genre.name} aria-label={t("genres.resultsLabel").replace("{genre}", genre.name)} >
                  <div className="genre-row-heading">
                    <div className="genre-row-title-wrap">
                      <h2 className="genre-row-title">{genre.name}</h2>
                      {description && <p className="genre-row-description">{description}</p>}
                    </div>
                    <button className="genre-view-all" type="button" onClick={openGenre} aria-label={t("genres.viewAll").replace("{genre}", genre.name)}>
                      {t("genres.viewAllLabel")}
                    </button>
                  </div>
                  <div className="genre-row-track" aria-label={genre.name}>
                    {displayedEntries.slice(0, 8).map((entry, index) => {
                      const media = metadata[entry.animeId];
                      const image = media?.coverImage?.extraLarge ?? media?.coverImage?.large;
                      const title = lang === "en" ? (media?.title?.english || media?.title?.romaji || entry.title) : (media?.title?.romaji || media?.title?.english || entry.title);
                      return (
                        <button className="genre-poster-card" type="button" key={entry.animeId} onClick={openGenre} aria-label={title}>
                          <span className="genre-poster-art">
                            {image ? <img src={image} alt="" loading={genreIndex === 0 && index < 4 ? "eager" : "lazy"} /> : <span className="genre-poster-placeholder">{title}</span>}
                          </span>
                          <span className="genre-poster-title">{title}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <section className="genre-results" aria-label={t("genres.resultsLabel").replace("{genre}", selectedGenre.name)}>
          <header className="genre-results-head">
            <h2 className="genre-results-title">{selectedGenre.name}</h2>
            {getGenreDescription(selectedGenre.name, lang) && (
              <p className="genre-results-description">{getGenreDescription(selectedGenre.name, lang)}</p>
            )}
          </header>

          {resultsLoading ? (
            <div className="genre-results-loading" role="status" aria-live="polite">{t("genres.loadingTitles")}</div>
          ) : (
            <div className="genre-results-grid">
              {selectedGenre.entries.map((entry, index) => {
                const media = metadata[entry.animeId];
                const image = media?.coverImage?.extraLarge ?? media?.coverImage?.large;

                return (
                  <a className="genre-anime-card" href={`${lang === "en" ? "/en" : ""}/anime/${entry.animeId}`} key={entry.animeId}>
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
                      <strong>{lang === "en" ? (media?.title?.english || media?.title?.romaji || entry.title) : (media?.title?.romaji || media?.title?.english || entry.title)}</strong>
                      <span>{media?.startDate?.year ? media.startDate.month && media.startDate.day ? new Date(media.startDate.year, media.startDate.month - 1, media.startDate.day).toLocaleDateString(lang === "en" ? "en-GB" : "es-ES", { day: "numeric", month: "long", year: "numeric" }) : String(media.startDate.year) : t("genres.unknownDate")} · {entry.format === "MOVIE" || media?.format === "MOVIE" ? t("detail.film") : t("detail.series")}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && catalog.length === 0 && (
        <p className="genres-empty">{t("genres.error")}</p>
      )}

      <style>{`
        .genres-view {
          width: 100%;
        }

        .genres-rows {
          display: grid;
          gap: clamp(2rem, 5vw, 3.8rem);
        }

        .genre-row {
          min-width: 0;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border);
        }

        .genre-row-heading,
        .genre-row-title-wrap {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .genre-row-heading {
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 1.25rem;
        }

        .genre-row-title-wrap {
          display: grid;
          gap: .55rem;
          flex: 1;
        }

        .genre-row-title {
          margin: 0;
          color: var(--color-paper-50);
          font-family: var(--font-heading);
          font-size: clamp(2rem, 3.5vw, 2.75rem);
          font-weight: 400;
          letter-spacing: -.05em;
          line-height: .98;
        }

        .genre-view-all {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .45rem;
          min-height: 44px;
          padding: .6rem 0 .6rem .75rem;
          border: 0;
          background: transparent;
          color: var(--color-muted-300);
          font: 500 .82rem/1 var(--font-body);
          letter-spacing: 0;
          text-transform: none;
          white-space: nowrap;
          cursor: pointer;
        }

        .genre-view-all:hover { color: var(--color-paper-50); }

        .genre-row-description,
        .genre-results-description {
          max-width: 34rem;
          margin: 0;
          color: var(--color-muted-400);
          font: 400 .88rem/1.55 var(--font-body);
        }

        .genre-row-track {
          display: flex;
          gap: .85rem;
          overflow-x: auto;
          overscroll-behavior-inline: contain;
          scroll-snap-type: x mandatory;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border-strong) transparent;
          padding: .15rem .1rem .8rem;
          margin: 0 -.1rem;
        }

        .genre-poster-card {
          display: grid;
          flex: 0 0 clamp(112px, 14vw, 172px);
          min-width: 0;
          gap: .6rem;
          align-content: start;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--color-paper-50);
          text-align: left;
          cursor: pointer;
          scroll-snap-align: start;
        }

        .genre-poster-art {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(245,242,236,.12);
          background: var(--color-ink-900);
          isolation: isolate;
        }

        .genre-poster-art img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 550ms cubic-bezier(.22,1,.36,1), filter 350ms ease;
        }

        .genre-poster-placeholder {
          display: flex;
          align-items: end;
          width: 100%;
          height: 100%;
          padding: .65rem;
          color: var(--color-paper-50);
          font: 500 .7rem/1.2 var(--font-body);
          overflow-wrap: anywhere;
          background: linear-gradient(145deg, #222, #090909 70%);
        }

        .genre-poster-title {
          display: -webkit-box;
          min-height: 2.25em;
          overflow: hidden;
          color: var(--color-paper-50);
          font: 500 .7rem/1.25 var(--font-body);
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .genre-poster-card:hover .genre-poster-art img {
          transform: scale(1.045);
          filter: saturate(1.12);
        }

        .genre-results {
          margin-top: 0;
        }

        .genre-results-head {
          display: grid;
          gap: .8rem;
          padding-bottom: 1.75rem;
          border-bottom: 1px solid var(--color-border);
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
          .genre-poster-card {
            flex-basis: 142px;
          }

          .genre-results-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .genre-row {
            padding-top: 1.2rem;
          }

          .genre-row-heading {
            align-items: flex-start;
          }

          .genre-row-heading {
            gap: .5rem;
          }

          .genre-row-title {
            font-size: 1.85rem;
          }

          .genre-row-description,
          .genre-results-description {
            font-size: .82rem;
          }

          .genre-view-all {
            font-size: .78rem;
          }

          .genre-results-title {
            font-size: clamp(2.35rem, 11vw, 3.25rem);
          }

          .genre-poster-card {
            flex-basis: 118px;
          }

          .genre-row-track {
            gap: .7rem;
          }

          .genre-results-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem .7rem;
          }
        }

      `}</style>

    </div>
  );
}
