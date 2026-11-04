import { useEffect, useState } from "react";

interface RankedEpisode {
  rank: number;
  animeId: number;
  malId: number;
  animeTitle: string;
  episodeId: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airedAt: string;
  score: number;
  cover: string | null;
}

interface RankingResponse {
  success: boolean;
  season?: string;
  seasonYear?: number;
  generatedAt?: string;
  episodes?: RankedEpisode[];
}

interface Props {
  lang?: "es" | "en";
}

const SEASON_LABELS: Record<string, { es: string; en: string }> = {
  WINTER: { es: "Invierno", en: "Winter" },
  SPRING: { es: "Primavera", en: "Spring" },
  SUMMER: { es: "Verano", en: "Summer" },
  FALL: { es: "Otoño", en: "Autumn" },
};

export default function SeasonEpisodes({ lang = "es" }: Props) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isEnglish = lang === "en";

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/season-episodes", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Season ranking unavailable");
        return response.json();
      })
      .then((payload: RankingResponse) => {
        if (!payload.success) throw new Error("Season ranking unavailable");
        setData(payload);
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const seasonLabel = data?.season
    ? SEASON_LABELS[data.season]?.[isEnglish ? "en" : "es"]
    : null;

  return (
    <section className="season-episodes" aria-labelledby="season-episodes-title">
      <div className="season-episodes-heading">
        <div>
          <p className="season-episodes-eyebrow">{isEnglish ? "THE CURRENT SEASON" : "TEMPORADA ACTUAL"}</p>
          <h2 id="season-episodes-title">{isEnglish ? "Top episodes" : "Episodios destacados"}</h2>
          <p className="season-episodes-description">
            {isEnglish
              ? "The five highest-rated episodes from the current anime season."
              : "Los cinco episodios mejor valorados de la temporada de anime actual."}
          </p>
        </div>
        {seasonLabel && data?.seasonYear && (
          <span className="season-episodes-season">{seasonLabel} {data.seasonYear}</span>
        )}
      </div>

      {loading ? (
        <p className="season-episodes-state">{isEnglish ? "Loading verified episode ratings…" : "Cargando puntuaciones verificadas…"}</p>
      ) : error ? (
        <p className="season-episodes-state">{isEnglish ? "The ranking is temporarily unavailable." : "El ranking no está disponible temporalmente."}</p>
      ) : data?.episodes?.length ? (
        <ol className="season-episodes-list">
          {data.episodes.map((episode) => (
            <li className="season-episodes-row" key={`${episode.malId}-${episode.episodeId}`}>
              <span className="season-episodes-rank">{String(episode.rank).padStart(2, "0")}</span>
              <a className="season-episodes-cover" href={`/${isEnglish ? "en/" : ""}anime/${episode.animeId}`}>
                {episode.cover && <img src={episode.cover} alt="" loading="lazy" />}
              </a>
              <div className="season-episodes-info">
                <a className="season-episodes-anime" href={`/${isEnglish ? "en/" : ""}anime/${episode.animeId}`}>{episode.animeTitle}</a>
                <p className="season-episodes-title">
                  {isEnglish ? "Episode" : "Episodio"} {episode.episodeNumber}
                  {episode.episodeTitle ? ` · ${episode.episodeTitle}` : ""}
                </p>
                <time dateTime={episode.airedAt}>{new Date(episode.airedAt).toLocaleDateString(isEnglish ? "en-GB" : "es-ES", { day: "numeric", month: "short" })}</time>
              </div>
              <span className="season-episodes-score" aria-label={`${episode.score.toFixed(1)} out of 10`}>
                <span aria-hidden="true">★</span> {episode.score.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="season-episodes-state">
          {isEnglish ? "There are not enough verified episode ratings yet." : "Todavía no hay suficientes puntuaciones verificadas de episodios."}
        </p>
      )}
      <p className="season-episodes-source">
        {isEnglish ? "Episode ratings: MyAnimeList via Jikan · Refreshed every 14 days." : "Puntuaciones: MyAnimeList mediante Jikan · Actualización cada 14 días."}
      </p>

      <style>{`
        .season-episodes { width: min(calc(100% - (var(--gutter) * 2)), var(--container-max)); margin: 0 auto; padding: clamp(3rem, 6vw, 5.5rem) 0; color: var(--color-paper-50); }
        .season-episodes-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; }
        .season-episodes-eyebrow { margin: 0 0 .55rem; color: #ec4899; font: 600 .62rem/1.2 var(--font-meta); letter-spacing: .16em; }
        .season-episodes-heading h2 { margin: 0; font: 400 clamp(2rem, 4vw, 3.25rem)/1 var(--font-heading); letter-spacing: -.04em; }
        .season-episodes-description { margin: .65rem 0 0; color: var(--color-paper-300); font-size: .9rem; }
        .season-episodes-season { flex: 0 0 auto; padding: .5rem .75rem; border: 1px solid rgba(245,242,236,.2); border-radius: 999px; color: var(--color-paper-200); font: .65rem/1 var(--font-meta); letter-spacing: .08em; text-transform: uppercase; }
        .season-episodes-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid rgba(245,242,236,.16); }
        .season-episodes-row { display: grid; grid-template-columns: 3rem 3.5rem minmax(0,1fr) auto; align-items: center; gap: 1rem; min-height: 6rem; padding: .8rem 0; border-bottom: 1px solid rgba(245,242,236,.12); }
        .season-episodes-rank { color: rgba(245,242,236,.55); font: 500 1.2rem/1 var(--font-meta); font-variant-numeric: tabular-nums; }
        .season-episodes-cover { display: block; width: 3.5rem; aspect-ratio: 2/3; overflow: hidden; background: #171717; }
        .season-episodes-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .season-episodes-info { min-width: 0; }
        .season-episodes-anime { color: var(--color-paper-50); font-weight: 650; text-decoration: none; }
        .season-episodes-anime:hover { color: #f9a8d4; }
        .season-episodes-title { overflow: hidden; margin: .25rem 0; color: var(--color-paper-200); font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
        .season-episodes-info time { color: var(--color-paper-400); font: .62rem/1 var(--font-meta); text-transform: uppercase; }
        .season-episodes-score { display: flex; align-items: center; gap: .35rem; color: var(--color-paper-50); font: 600 .9rem/1 var(--font-meta); font-variant-numeric: tabular-nums; }
        .season-episodes-score span { color: #fbbf24; }
        .season-episodes-state { padding: 1.5rem 0; color: var(--color-paper-300); }
        .season-episodes-source { margin: 1rem 0 0; color: var(--color-paper-400); font: .62rem/1.5 var(--font-meta); }
        @media (max-width: 600px) {
          .season-episodes { width: calc(100% - 2rem); }
          .season-episodes-heading { align-items: start; flex-direction: column; }
          .season-episodes-row { grid-template-columns: 2rem 3rem minmax(0,1fr) auto; gap: .7rem; min-height: 5.4rem; }
          .season-episodes-cover { width: 3rem; }
          .season-episodes-rank { font-size: 1rem; }
          .season-episodes-anime { font-size: .82rem; }
          .season-episodes-title { font-size: .72rem; }
          .season-episodes-score { font-size: .78rem; }
        }
      `}</style>
    </section>
  );
}
