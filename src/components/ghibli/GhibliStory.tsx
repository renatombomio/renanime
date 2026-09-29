import { useEffect, useState } from "react";
import type { GhibliStoryEntry } from "../../data/ghibli";

interface Media {
  id: number;
  title?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

const accents = ["pink", "blue", "lime", "coral", "teal", "red", "sky"];

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
      <header className="ghibli-story-intro">
        <div className="ghibli-story-intro-art" aria-hidden="true">
          <span className="ghibli-story-art-sun" />
          <span className="ghibli-story-art-leaf leaf-one" />
          <span className="ghibli-story-art-leaf leaf-two" />
        </div>
        <div className="ghibli-story-intro-copy">
          <p className="ghibli-story-kicker">01 / Mi historia con Ghibli</p>
          <h2>Bienvenidos a<br /><em>mi inicio en el anime.</em></h2>
          <p>
            Antes de ser una colección, Ghibli fue una puerta. <strong>El viaje de Chihiro</strong>
            fue la primera película de anime que vi y, sin saberlo, el comienzo de un viaje que
            todavía continúa.
          </p>
        </div>
      </header>

      <div className="ghibli-story-rule" aria-hidden="true">
        <span>MI VIAJE</span><i /><span>2001 — AHORA</span>
      </div>

      <div className="ghibli-story-timeline">
        {entries.map((entry, index) => {
          const item = media[entry.id];
          const image = item?.coverImage?.extraLarge || item?.coverImage?.large;
          const accent = accents[index % accents.length];

          return (
            <article className={"ghibli-story-entry ghibli-story-entry--" + accent} key={entry.id}>
              <div className="ghibli-story-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>

              <div className="ghibli-story-visual">
                {image ? (
                  <img src={image} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                ) : (
                  <div className="ghibli-story-placeholder" aria-hidden="true">{entry.title}</div>
                )}
                <span className="ghibli-story-year">{entry.year}</span>
              </div>

              <div className="ghibli-story-copy">
                <p className="ghibli-story-chapter">{entry.chapter}</p>
                <h3>{entry.title}</h3>
                <p className="ghibli-story-ren">{entry.renText}</p>

                <div className="ghibli-story-creator">
                  <div className="ghibli-story-creator-label">
                    <span>La película</span>
                    <b>Desde la mirada de {entry.director}</b>
                  </div>
                  <p>{entry.creatorContext}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="ghibli-story-end">
        <span>Hasta aquí, por ahora.</span>
        <p>La colección sigue abierta.<br /><em>La historia también.</em></p>
      </footer>
    </div>
  );
}
