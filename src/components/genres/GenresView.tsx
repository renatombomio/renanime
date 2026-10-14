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
          <div className="genres-meta">
            <span>{loading ? t("genres.loadingMap") : t("genres.count").replace("{count}", String(catalog.length))}</span>
            <span>{t("genres.titlesSeen").replace("{count}", String(entries.length))}</span>
          </div>

          <div className="genres-rows">
            {catalog.map((genre, genreIndex) => {
              const color = "var(--color-accent-soft)";
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
                      <span className="genre-row-count">{t("genres.titleCount").replace("{count}", String(genre.entries.length))}</span>
                    </div>
                    <button className="genre-view-all" type="button" onClick={openGenre} aria-label={t("genres.viewAll").replace("{genre}", genre.name)}>
                      {t("genres.viewAllLabel")} <span aria-hidden="true">↗</span>
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

        .genres-rows {
          display: grid;
          gap: clamp(2rem, 5vw, 3.8rem);
        }

        .genre-row {
          min-width: 0;
          padding-top: 1rem;
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
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .genre-row-title-wrap {
          gap: .7rem;
          flex-wrap: wrap;
        }

        .genre-row-title {
          margin: 0;
          color: var(--color-paper-50);
          font-family: var(--font-heading);
          font-size: clamp(1.45rem, 2.7vw, 2.2rem);
          font-weight: 400;
          letter-spacing: -.045em;
          line-height: 1;
        }

        .genre-row-count {
          color: var(--color-muted-400);
          font: 500 .58rem/1 var(--font-meta);
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .genre-view-all {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .45rem;
          min-height: 44px;
          padding: .5rem 0 .5rem .5rem;
          border: 0;
          background: transparent;
          color: var(--color-paper-50);
          font: 500 .58rem/1 var(--font-meta);
          letter-spacing: .07em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .genre-view-all:hover { color: var(--color-paper-50); }

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
          margin-top: clamp(2.5rem, 5vw, 4rem);
        }

        .genre-results-head {
          padding-bottom: 1rem;
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
          .genres-meta {
            display: grid;
            gap: .5rem;
          }

          .genre-row {
            padding-top: .85rem;
          }

          .genre-row-heading {
            align-items: flex-start;
          }

          .genre-row-title {
            font-size: 1.55rem;
          }

          .genre-view-all {
            font-size: .52rem;
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
