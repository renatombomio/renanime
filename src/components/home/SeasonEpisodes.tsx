import { useEffect, useState } from "react";
import es from "../../i18n/es.json";
import en from "../../i18n/en.json";

type SeasonEpisode = {
  id: string;
  animeTitle: string;
  poster: string;
  episodeNumber: string;
  episodeTitle: string;
  score: number;
  votes: number;
  url: string;
};

type ResponsePayload = {
  episodes?: SeasonEpisode[];
  status?: "ok" | "partial" | "degraded";
  failedCandidates?: number;
};

type Props = { lang?: string };

export default function SeasonEpisodes({ lang = "es" }: Props) {
  const t = lang === "en" ? en : es;
  const [episodes, setEpisodes] = useState<SeasonEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/home-season-episodes")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Season episodes API returned ${response.status}`);
        return await response.json() as ResponsePayload;
      })
      .then((payload) => {
        if (!active) return;
        if (payload.status === "degraded") {
          console.error("[Renanime] Seasonal episode ratings are degraded.");
          setUnavailable(true);
          return;
        }
        if (payload.status === "partial") {
          console.error("[Renanime] Some seasonal episode sources failed:", payload.failedCandidates);
        }
        setEpisodes(Array.isArray(payload.episodes) ? payload.episodes : []);
      })
      .catch((error: unknown) => {
        console.error("[Renanime] Could not load seasonal episode ratings:", error);
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (unavailable) return null;

  return (
    <section className="season-episodes" aria-labelledby="season-episodes-title">
      <div className="season-episodes-inner">
        <h2 id="season-episodes-title">{t["seasonEpisodes.heading"]}</h2>
        {loading ? (
          <div className="season-episodes-status" aria-live="polite">{t["seasonEpisodes.loading"]}</div>
        ) : episodes.length ? (
          <div className="season-episodes-track" aria-label={t["seasonEpisodes.ariaLabel"]}>
            {episodes.map((episode) => (
              <a className="season-episode-card" href={episode.url} key={episode.id}>
                <div className="season-episode-poster">
                  {episode.poster ? <img src={episode.poster} alt="" loading="lazy" /> : <div className="season-episode-placeholder">RENANIME</div>}
                </div>
                <div className="season-episode-info">
                  <span className="season-episode-anime">{episode.animeTitle}</span>
                  <span className="season-episode-number">{t["seasonEpisodes.episode"]} {episode.episodeNumber}</span>
                  {episode.episodeTitle && <span className="season-episode-title">{episode.episodeTitle}</span>}
                  <span className="season-episode-score">★ {episode.score.toFixed(1)} <small>· {episode.votes.toLocaleString(isEnglish ? "en" : "es")} {t["seasonEpisodes.votes"]}</small></span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="season-episodes-status">{t["seasonEpisodes.empty"]}</p>
        )}
      </div>
      <style>{`
        .season-episodes{padding:clamp(2rem,4vw,3.5rem) 0 3rem;color:#f5f2ec;background:transparent}
        .season-episodes-inner{width:min(calc(100% - (var(--gutter)*2)),var(--container-max));margin:0 auto}
        .season-episodes h2{margin:0 0 1.2rem;font-size:clamp(1.55rem,2.8vw,2.25rem);font-weight:650;letter-spacing:-.045em}
        .season-episodes-track{display:flex;gap:1rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;padding:0 0 .8rem;scrollbar-width:thin;scrollbar-color:#444 transparent}
        .season-episode-card{flex:0 0 clamp(132px,17vw,174px);min-width:0;color:inherit;text-decoration:none;scroll-snap-align:start}
        .season-episode-poster{width:100%;aspect-ratio:3/4;overflow:hidden;border-radius:7px;background:#111}
        .season-episode-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
        .season-episode-card:hover img{transform:scale(1.035)}
        .season-episode-placeholder{height:100%;display:grid;place-items:center;color:#ec4899;font-weight:800}
        .season-episode-info{display:flex;flex-direction:column;gap:.28rem;padding:.65rem .05rem 0}
        .season-episode-anime{font-size:.78rem;color:#f2f0ed;font-weight:650;line-height:1.3}
        .season-episode-number{font-size:.72rem;color:#f9a8d4}
        .season-episode-title{font-size:.72rem;line-height:1.35;color:#aaa;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:1.9em}
        .season-episode-score{font-size:.78rem;color:#f9a8d4;margin-top:.2rem}
        .season-episode-score small{font-size:.68rem;color:#858585}
        .season-episodes-status{margin:0;color:#858585;font-size:.82rem}
        @media(max-width:650px){.season-episodes{padding:1.75rem 0 2.5rem}.season-episodes h2{margin-bottom:1rem}.season-episodes-track{gap:.8rem;margin-right:-.625rem;padding-right:.625rem}.season-episode-card{flex-basis:138px}.season-episode-info{padding-top:.55rem}}
        @media(prefers-reduced-motion:reduce){.season-episode-poster img{transition:none}}
      `}</style>
    </section>
  );
}
