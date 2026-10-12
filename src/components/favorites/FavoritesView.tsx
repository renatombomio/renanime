import { useEffect, useRef, useState } from "react";
import { fetchFallbackPoster, selectBestAnimeCandidate } from "../../lib/api/poster-fallback";
import { useT, type Lang } from "../../i18n";

interface FavoriteEntry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state: { favorite: boolean; recommended: boolean };
}

interface Media {
  title: { romaji?: string | null; english?: string | null };
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  format?: string | null;
}

interface Props {
  entries: FavoriteEntry[];
  recommendations: FavoriteEntry[];
  lang?: Lang;
}

const ANILIST_BATCH_SIZE = 20;

export default function FavoritesView({ entries, recommendations, lang = "es" }: Props) {
  const t = useT(lang);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const [visibleFavorites, setVisibleFavorites] = useState(10);
  const [visibleRecommendations, setVisibleRecommendations] = useState(10);
  const favoriteTrackRef = useRef<HTMLDivElement>(null);
  const recommendationTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBatch(batch: FavoriteEntry[], offset: number) {
      const variables: Record<string, string> = {};
      const fields = batch.map((entry, index) => {
        const key = "a" + index;
        const variable = "s" + index;
        variables[variable] = entry.title;

        return key + ": Page(page: 1, perPage: 10) { media(search: $" + variable + ", type: ANIME, sort: SEARCH_MATCH) { title { romaji english native } synonyms startDate { year month day } coverImage { extraLarge large } format } }";
      }).join("\n");

      const definitions = batch.map((_, index) => "$s" + index + ": String!").join(", ");
      const query = "query Favorites(" + definitions + ") { " + fields + " }";

      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error("AniList request failed with " + response.status);
      }

      const payload = await response.json();
      const result: Record<string, Media | null> = {};
      const missingPosters: Array<{ entry: FavoriteEntry; selected: Media | null }> = [];

      for (const [index, entry] of batch.entries()) {
        const candidates = payload.data?.["a" + index]?.media ?? [];
        const selected = selectBestAnimeCandidate(candidates, entry.title, entry.format);
        result[entry.animeId] = selected ?? null;
        if (!selected?.coverImage?.extraLarge && !selected?.coverImage?.large) {
          missingPosters.push({ entry, selected: selected ?? null });
        }
      }

      if (!cancelled) {
        setMedia((current) => ({ ...current, ...result }));
        setLoading(false);
      }

      // Resolve fallback posters in the background so the next AniList batch
      // can render without waiting for the slow, rate-limited poster queue.
      void Promise.all(missingPosters.map(async ({ entry, selected }) => {
        const poster = await fetchFallbackPoster(entry.title, entry.format);
        if (poster && !cancelled) {
          setMedia((current) => ({
            ...current,
            [entry.animeId]: {
              ...(current[entry.animeId] ?? selected ?? {}),
              title: current[entry.animeId]?.title ?? selected?.title ?? { romaji: entry.title },
              format: current[entry.animeId]?.format ?? selected?.format ?? entry.format,
              coverImage: { extraLarge: poster, large: poster },
            },
          }));
        }
      }));

      return offset + batch.length;
    }

    async function load() {
      const allEntries = [...entries, ...recommendations];

      if (!allEntries.length) {
        setLoading(false);
        return;
      }

      try {
        for (let offset = 0; offset < allEntries.length; offset += ANILIST_BATCH_SIZE) {
          if (cancelled) break;

          const batch = allEntries.slice(offset, offset + ANILIST_BATCH_SIZE);
          await loadBatch(batch, offset);
        }
      } catch {
        // Personal titles remain visible if metadata is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entries, recommendations]);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: "prev" | "next") => {
    ref.current?.scrollBy({
      left: direction === "next" ? ref.current.clientWidth * 0.72 : -ref.current.clientWidth * 0.72,
      behavior: "smooth",
    });
  };

  const renderCard = (entry: FavoriteEntry, index: number, compact = false) => {
    const item = media[entry.animeId];
    const title = lang === "en" ? (item?.title.english || item?.title.romaji || entry.title) : (item?.title.romaji || item?.title.english || entry.title);
    const year = item?.startDate?.year;

    return (
      <article className={"favorite-card" + (compact ? " favorite-card--recommendation" : "")} key={entry.animeId}>
        <a href={`${lang === "en" ? "/en" : ""}/anime/${entry.animeId}`} aria-label={t("favorites.view").replace("{title}", title)}>
          <div className="favorite-media">
            {item?.coverImage?.extraLarge || item?.coverImage?.large ? (
              <img
                src={item.coverImage.extraLarge || item.coverImage.large || ""}
                alt={title}
                loading={index < 2 ? "eager" : "lazy"}
              />
            ) : (
              <div className="favorite-placeholder">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{entry.title}</strong>
              </div>
            )}
          </div>

          <div className="favorite-caption">
            <h3>{title}</h3>
            {year && <span>{year}</span>}
          </div>
        </a>
      </article>
    );
  };

  return (
    <div className="favorites-view">
      <section className="favorites-section" aria-labelledby="absolute-favorites-title">
        <div className="favorites-intro">
          <div>
            <span className="favorites-note">{t("favorites.absolute")}</span>
            <h2 id="absolute-favorites-title">{t("favorites.returning")}</h2>
          </div>
          <div className="favorites-controls" role="group" aria-label={t("favorites.navigate")}>
            <button type="button" onClick={() => scroll(favoriteTrackRef, "prev")} aria-label={t("favorites.previous")}>←</button>
            <button type="button" onClick={() => scroll(favoriteTrackRef, "next")} aria-label={t("favorites.next")}>→</button>
          </div>
        </div>

        {entries.length ? (
          <div className="favorites-track" ref={favoriteTrackRef}>
            {entries.slice(0, visibleFavorites).map((entry, index) => renderCard(entry, index))}
          </div>
        ) : (
          <div className="favorites-empty" role="status">{t("favorites.empty")}</div>
        )}

        {visibleFavorites < entries.length && (
          <button
            type="button"
            className="favorites-load-more"
            onClick={() => setVisibleFavorites((count) => count + 10)}
          >
            {t("favorites.loadMoreCount").replace("{shown}", String(Math.min(visibleFavorites + 10, entries.length))).replace("{total}", String(entries.length))}
          </button>
        )}
      </section>

      <section className="favorites-section favorites-section--recommendations" aria-labelledby="recommended-title">
        <div className="favorites-intro">
          <div>
            <span className="favorites-note">{t("favorites.forYou")}</span>
            <h2 id="recommended-title">{t("favorites.recommended")}</h2>
          </div>
          <div className="favorites-controls" role="group" aria-label={t("favorites.navigateRecommendations")}>
            <button type="button" onClick={() => scroll(recommendationTrackRef, "prev")} aria-label={t("favorites.previousRecommendations")}>←</button>
            <button type="button" onClick={() => scroll(recommendationTrackRef, "next")} aria-label={t("favorites.nextRecommendations")}>→</button>
          </div>
        </div>

        <p className="favorites-recommendation-copy">
          {t("favorites.copy")}
        </p>

        {recommendations.length ? (
          <div className="favorites-track favorites-track--recommendations" ref={recommendationTrackRef}>
            {recommendations.slice(0, visibleRecommendations).map((entry, index) => renderCard(entry, index, true))}
          </div>
        ) : (
          <div className="favorites-empty" role="status">{t("favorites.emptyRecommendations")}</div>
        )}

        {visibleRecommendations < recommendations.length && (
          <button
            type="button"
            className="favorites-load-more"
            onClick={() => setVisibleRecommendations((count) => count + 10)}
          >
            {t("favorites.loadMoreCount").replace("{shown}", String(Math.min(visibleRecommendations + 10, recommendations.length))).replace("{total}", String(recommendations.length))}
          </button>
        )}
      </section>

      {loading && <span className="favorites-loading">{t("favorites.loading")}</span>}

      <style>{`
        .favorites-empty {
          display: grid;
          min-height: 8rem;
          place-items: center;
          margin-top: 1rem;
          padding: 1.5rem;
          border: 1px solid var(--color-border);
          color: var(--color-muted-400);
          font: 500 .62rem/1.5 var(--font-meta);
          letter-spacing: .06em;
          text-align: center;
          text-transform: uppercase;
        }

        .favorites-load-more {
          display: inline-flex;
          align-items: center;
          gap: .75rem;
          margin-top: 2rem;
          padding: .8rem 1.1rem;
          border: 1px solid var(--line);
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
          transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
        }
        .favorites-load-more:hover {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }
        .favorites-load-more span {
          font-family: var(--font-meta);
          font-size: .58rem;
          opacity: .55;
          letter-spacing: .05em;
        }
        @media (max-width: 700px) {
          .favorites-load-more {
            width: 100%;
            justify-content: center;
            margin-top: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
