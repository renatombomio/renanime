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
