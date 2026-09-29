import { useEffect, useState } from "react";

interface Film { id: string; title: string; year: number; watched: boolean; }
interface Media { id: number; title?: { romaji?: string | null; english?: string | null }; coverImage?: { extraLarge?: string | null; large?: string | null }; }

export default function GhibliView({ films }: { films: Film[] }) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const variables: Record<string, string> = {};
    const fields = films.map((film, index) => {
      variables["s" + index] = film.title;
      return "a" + index + ": Page(page:1,perPage:1){media(search:$s" + index + ",type:ANIME,sort:SEARCH_MATCH){id title{romaji english} coverImage{extraLarge large}}}";
    }).join("\n");
    const definitions = films.map((_, index) => "$s" + index + ":String!").join(",");

    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "query Ghibli(" + definitions + "){" + fields + "}", variables }),
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        if (cancelled) return;
        const result: Record<string, Media | null> = {};
        films.forEach((film, index) => {
          result[film.id] = payload.data?.["a" + index]?.media?.[0] ?? null;
        });
        setMedia(result);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [films]);

  const watched = films.filter((film) => film.watched).length;

  return (
    <div className="ghibli-view">
      <style>{`
        .ghibli-view{--gp-cream:#FFF7E8;--gp-paper:#F4E9D5;--gp-sky:#DCEFF1;--gp-blue:#18528A;--gp-teal:#0B798B;--gp-coral:#F45164;--gp-pink:#F0A9A5;--gp-lime:#91CC57;--gp-ink:#19362F}
        .ghibli-view .ghibli-meta{border-bottom-color:rgba(25,54,47,.16);color:#486B3C}
        .ghibli-view .ghibli-meta strong{color:var(--gp-coral)}
        .ghibli-view .ghibli-grid{gap:1.25rem;margin-top:1.75rem}
        .ghibli-view .ghibli-card{overflow:hidden;border:1px solid rgba(25,54,47,.1);border-radius:22px;background:#fff;box-shadow:0 14px 35px rgba(25,54,47,.08);transition:transform .45s cubic-bezier(.22,1,.36,1),box-shadow .45s,border-color .45s}
        .ghibli-view .ghibli-card:hover{border-color:rgba(24,82,138,.24);background:#fff;box-shadow:0 22px 50px rgba(25,54,47,.14);transform:translateY(-7px)}
        .ghibli-view .ghibli-poster{border-radius:0;background:var(--gp-sky)}
        .ghibli-view .ghibli-poster:after{background:linear-gradient(180deg,transparent 55%,rgba(25,54,47,.3))}
        .ghibli-view .ghibli-year{left:.8rem;bottom:.8rem;background:rgba(255,247,232,.94);color:var(--gp-blue);border:1px solid rgba(24,82,138,.12)}
        .ghibli-view .ghibli-badge{top:.8rem;right:.8rem;background:var(--gp-lime);color:var(--gp-ink);border:0}
        .ghibli-view .ghibli-info{min-height:6.8rem;padding:1.05rem 1rem 1.2rem;background:#fff}
        .ghibli-view .ghibli-info h3{color:var(--gp-blue);font-family:Georgia,"Times New Roman",serif;font-size:1.02rem;line-height:1.05}
        .ghibli-view .ghibli-info span{color:#59756b;font-size:.57rem}
        .ghibli-view .ghibli-placeholder{background:linear-gradient(145deg,var(--gp-pink),var(--gp-sky));color:var(--gp-blue)}
        @media(max-width:560px){
          .ghibli-view .ghibli-grid{gap:1.25rem .75rem;margin-top:1.25rem}
          .ghibli-view .ghibli-card{border-radius:17px}
          .ghibli-view .ghibli-info{min-height:6.2rem;padding:.8rem .75rem .9rem}
          .ghibli-view .ghibli-info h3{font-size:.82rem}
          .ghibli-view .ghibli-info span{font-size:.49rem}
        }
      `}</style>
      <div className="ghibli-meta">
        <span><strong>{watched}</strong> vistas</span>
        <span><strong>{films.length - watched}</strong> por descubrir</span>
        <span>{films.length} películas</span>
      </div>

      {loading ? (
        <div className="ghibli-loading" role="status" aria-live="polite">Abriendo el archivo…</div>
      ) : (
        <div className="ghibli-grid">
          {films.map((film, index) => {
            const item = media[film.id];
            const image = item?.coverImage?.extraLarge || item?.coverImage?.large;

            return (
              <article className={"ghibli-card" + (film.watched ? " is-watched" : "")} key={film.id}>
                <a href={item ? "/anime/search?id=" + item.id + "&from=ghibli" : "#"} aria-label={"Abrir " + film.title}>
                  <div className="ghibli-poster">
                    {image ? (
                      <img src={image} alt="" loading={index < 6 ? "eager" : "lazy"} decoding="async" />
                    ) : (
                      <div className="ghibli-placeholder" aria-hidden="true">
                        <strong>{film.title}</strong>
                      </div>
                    )}
                    <span className="ghibli-year">{film.year}</span>
                    {film.watched && <span className="ghibli-badge">Vista</span>}
                  </div>
                  <div className="ghibli-info">
                    <h3>{film.title}</h3>
                    <span>{film.watched ? "Ya forma parte de mi viaje" : "Todavía me espera"}</span>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
