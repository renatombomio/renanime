import { useEffect, useState } from "react";
import type { GhibliStoryEntry } from "../../data/ghibli";

interface Media {
  id: number;
  title?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

export default function GhibliStory({ entries }: { entries: GhibliStoryEntry[] }) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const variables: Record<string, string> = {};
    const fields = entries.map((entry, index) => {
      variables["s" + index] = entry.title;
      return "a" + index + ": Page(page:1,perPage:1){media(search:$s" + index + ",type:ANIME,sort:SEARCH_MATCH){id title{romaji english} coverImage{extraLarge large}}}";
    }).join("\n");
    const definitions = entries.map((_, index) => "$s" + index + ":String!").join(",");

    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "query GhibliStory(" + definitions + "){" + fields + "}", variables }),
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        if (cancelled) return;
        const result: Record<string, Media | null> = {};
        entries.forEach((entry, index) => {
          result[entry.id] = payload.data?.["a" + index]?.media?.[0] ?? null;
        });
        setMedia(result);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [entries]);

  if (loading) {
    return <div className="ghibli-story-loading" role="status" aria-live="polite">Recordando el viaje…</div>;
  }

  return (
    <div className="ghibli-story">
      <div className="ghibli-story-intro">
        <p className="ghibli-story-kicker">Mi historia con Ghibli</p>
        <h2>Antes de ser una colección,<br /><em>fue un descubrimiento.</em></h2>
        <p>
          No quiero que este rincón sea una lista de películas que he visto.
          Quiero que sea el recorrido que hay detrás de ellas: la primera puerta
          que abrí, las historias que fui encontrando y la película que, por ahora,
          cierra este capítulo.
        </p>
      </div>

      <div className="ghibli-story-timeline">
        {entries.map((entry, index) => {
          const item = media[entry.id];
          const image = item?.coverImage?.extraLarge || item?.coverImage?.large;
          const first = index === 0;
          const last = index === entries.length - 1;

          return (
            <article className={"ghibli-story-entry" + (first ? " is-first" : "") + (last ? " is-last" : "")} key={entry.id}>
              <div className="ghibli-story-marker" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>

              <div className="ghibli-story-visual">
                {image ? (
                  <img src={image} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                ) : (
                  <div className="ghibli-story-placeholder" aria-hidden="true">{entry.title}</div>
                )}
              </div>

              <div className="ghibli-story-copy">
                <p className="ghibli-story-chapter">{entry.chapter} · {entry.year}</p>
                <h3>{entry.title}</h3>
                <p className="ghibli-story-ren">{entry.renText}</p>
                <div className="ghibli-story-creator">
                  <span>Desde la mirada de {entry.director}</span>
                  <p>{entry.creatorContext}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="ghibli-story-end">
        <span>2023 · The Boy and the Heron</span>
        <p>La colección sigue abierta. La historia también.</p>
      </div>
    </div>
  );
}
