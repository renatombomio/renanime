import AnimePosterDisplay from "../anime/AnimePosterDisplay";
import { fetchRenMediaByIdentity, hasRenAnimeIdentity } from "../../lib/api/ren-anime-identities";
import { getDisplayTitle } from "../../lib/anime/display-title";
import { useEffect, useRef, useState } from "react";

import { useT, type Lang } from "../../i18n";

interface FavoriteEntry {
  animeId: string;
  title: string;
  format?: "SERIES" | "MOVIE";
  state: { favorite: boolean; recommended: boolean };
}

interface Media {
  title: { romaji?: string | null; english?: string | null; native?: string | null };
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
  const verifiedEntries = entries.filter((entry) => hasRenAnimeIdentity(entry.animeId));
  const verifiedRecommendations = recommendations.filter((entry) => hasRenAnimeIdentity(entry.animeId));
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const [visibleFavorites, setVisibleFavorites] = useState(10);
  const [visibleRecommendations, setVisibleRecommendations] = useState(10);
  const favoriteTrackRef = useRef<HTMLDivElement>(null);
  const recommendationTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const allEntries = [...verifiedEntries, ...verifiedRecommendations];
      if (!allEntries.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const identityMedia = await fetchRenMediaByIdentity(allEntries);
        if (!cancelled) setMedia(identityMedia);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [verifiedEntries, verifiedRecommendations]);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: "prev" | "next") => {
    ref.current?.scrollBy({
      left: direction === "next" ? ref.current.clientWidth * 0.72 : -ref.current.clientWidth * 0.72,
      behavior: "smooth",
    });
  };

  const renderCard = (entry: FavoriteEntry, index: number, compact = false) => {
    const item = media[entry.animeId];
    const title = getDisplayTitle(item?.title, entry.title);
    const year = item?.startDate?.year;

    return (
      <article className={"favorite-card" + (compact ? " favorite-card--recommendation" : "")} key={entry.animeId}>
        <a href={`${lang === "en" ? "/en" : ""}/anime/${entry.animeId}`} aria-label={t("favorites.view").replace("{title}", title)}>
          <div className="favorite-media">
            <AnimePosterDisplay src={item?.coverImage?.extraLarge || item?.coverImage?.large} title={entry.title} loading={index < 2 ? "eager" : "lazy"} />
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

        {verifiedEntries.length ? (
          <div className="favorites-track" ref={favoriteTrackRef}>
            {verifiedEntries.slice(0, visibleFavorites).map((entry, index) => renderCard(entry, index))}
          </div>
        ) : (
          <div className="favorites-empty" role="status">{t("favorites.empty")}</div>
        )}

        {visibleFavorites < verifiedEntries.length && (
          <button
            type="button"
            className="favorites-load-more"
            onClick={() => setVisibleFavorites((count) => count + 10)}
          >
            {t("favorites.loadMoreCount").replace("{shown}", String(Math.min(visibleFavorites + 10, verifiedEntries.length))).replace("{total}", String(verifiedEntries.length))}
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

        {verifiedRecommendations.length ? (
          <div className="favorites-track favorites-track--recommendations" ref={recommendationTrackRef}>
            {verifiedRecommendations.slice(0, visibleRecommendations).map((entry, index) => renderCard(entry, index, true))}
          </div>
        ) : (
          <div className="favorites-empty" role="status">{t("favorites.emptyRecommendations")}</div>
        )}

        {visibleRecommendations < verifiedRecommendations.length && (
          <button
            type="button"
            className="favorites-load-more"
            onClick={() => setVisibleRecommendations((count) => count + 10)}
          >
            {t("favorites.loadMoreCount").replace("{shown}", String(Math.min(visibleRecommendations + 10, verifiedRecommendations.length))).replace("{total}", String(verifiedRecommendations.length))}
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
