import { useEffect, useState } from "react";

type WeeklyEpisode = {
  id: string;
  animeId: number;
  animeTitle: string;
  animeUrl: string;
  poster: string;
  episodeNumber: string;
  episodeTitle: string;
  score: number;
  votes: number;
  aired: string;
  url: string;
};

type WeeklyEpisodesResponse = {
  episodes?: WeeklyEpisode[];
};

type Props = { lang?: string };

export default function WeeklyEpisodes({ lang = "es" }: Props) {
  const isEnglish = lang === "en";
  const [episodes, setEpisodes] = useState<WeeklyEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/home-weekly-episodes")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: WeeklyEpisodesResponse | null) => {
        if (active) setEpisodes(Array.isArray(payload?.episodes) ? payload.episodes : []);
      })
      .catch(() => {
        if (active) setEpisodes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="weekly-episodes" aria-labelledby="weekly-episodes-title">
      <div className="weekly-episodes-inner">
        <h2 id="weekly-episodes-title">{isEnglish ? "Episodes of the week" : "Episodios de la semana"}</h2>
        {loading ? (
          <div className="weekly-episodes-status" aria-live="polite">{isEnglish ? "Loading episodes…" : "Cargando episodios…"}</div>
        ) : episodes.length ? (
          <div className="weekly-episodes-track" aria-label={isEnglish ? "Weekly episode carousel" : "Carrusel de episodios semanales"}>
            {episodes.map((episode) => (
              <a className="weekly-episode-card" href={episode.url} target="_blank" rel="noreferrer" key={episode.id}>
                <div className="weekly-episode-poster">
                  {episode.poster ? <img src={episode.poster} alt="" loading="lazy" /> : <div className="weekly-episode-placeholder">RENANIME</div>}
                </div>
                <div className="weekly-episode-info">
                  <span className="weekly-episode-anime">{episode.animeTitle}</span>
                  <span className="weekly-episode-number">{episode.episodeNumber}</span>
                  {episode.episodeTitle && <span className="weekly-episode-title">{episode.episodeTitle}</span>}
                  <span className="weekly-episode-score">★ {episode.score.toFixed(1)} <small>· {episode.votes.toLocaleString(isEnglish ? "en" : "es")} {isEnglish ? "votes" : "votos"}</small></span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="weekly-episodes-status">{isEnglish ? "No qualifying episodes with enough rating data this week." : "Esta semana no hay episodios con datos de puntuación suficientes."}</p>
        )}
      </div>
      <style>{`
        .weekly-episodes{padding:clamp(2rem,4vw,3.5rem) 0 3rem;color:#f5f2ec;background:transparent}
        .weekly-episodes-inner{width:min(calc(100% - (var(--gutter)*2)),var(--container-max));margin:0 auto}
        .weekly-episodes h2{margin:0 0 1.2rem;font-size:clamp(1.55rem,2.8vw,2.25rem);font-weight:650;letter-spacing:-.045em}
        .weekly-episodes-track{display:flex;gap:1rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;padding:0 0 .8rem;scrollbar-width:thin;scrollbar-color:#444 transparent}
        .weekly-episode-card{flex:0 0 clamp(132px,17vw,174px);min-width:0;color:inherit;text-decoration:none;scroll-snap-align:start}
        .weekly-episode-poster{width:100%;aspect-ratio:3/4;overflow:hidden;border-radius:7px;background:#111}
        .weekly-episode-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
        .weekly-episode-card:hover img{transform:scale(1.035)}
        .weekly-episode-placeholder{height:100%;display:grid;place-items:center;color:#ec4899;font-weight:800}
        .weekly-episode-info{display:flex;flex-direction:column;gap:.28rem;padding:.65rem .05rem 0}
        .weekly-episode-anime{font-size:.78rem;color:#f2f0ed;font-weight:650;line-height:1.3}
        .weekly-episode-number{font-size:.72rem;color:#f9a8d4}
        .weekly-episode-title{font-size:.72rem;line-height:1.35;color:#aaa;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:1.9em}
        .weekly-episode-score{font-size:.78rem;color:#f9a8d4;margin-top:.2rem}
        .weekly-episode-score small{font-size:.68rem;color:#858585}
        .weekly-episodes-status{margin:0;color:#858585;font-size:.82rem}
        @media(max-width:650px){.weekly-episodes{padding:1.75rem 0 2.5rem}.weekly-episodes h2{margin-bottom:1rem}.weekly-episodes-track{gap:.8rem;margin-right:-.625rem;padding-right:.625rem}.weekly-episode-card{flex-basis:138px}.weekly-episode-info{padding-top:.55rem}}
        @media(prefers-reduced-motion:reduce){.weekly-episode-poster img{transition:none}}
      `}</style>
    </section>
  );
}
