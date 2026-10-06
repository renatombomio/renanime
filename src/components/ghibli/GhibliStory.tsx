import { useEffect, useState } from "react";
import type { GhibliStoryEntry } from "../../data/ghibli";

interface Media {
  id: number;
  title?: { romaji?: string | null; english?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

const accents = ["pink", "blue", "lime", "coral", "teal", "red", "sky"];

export default function GhibliStory({ entries, totalFilms, watchedFilms }: { entries: GhibliStoryEntry[]; totalFilms: number; watchedFilms: number }) {
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

  useEffect(() => {
    if (loading) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".ghs-intro, .ghs-entry"));

    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((observed) => {
      observed.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, [loading]);

  if (loading) {
    return <div className="ghs-loading" role="status" aria-live="polite">Recordando el viaje…</div>;
  }

  return (
    <section className="ghs">
      <style>{`
        .ghs{--pink:#F0A9A5;--coral:#F45164;--blue:#18528A;--teal:#0B798B;--lime:#91CC57;--red:#B12A31;--cream:#FFF7E8;--paper:#F4E9D5;--sky:#DCEFF1;--moss:#486B3C;--ink:#19362F;--serif:Georgia,"Times New Roman",serif;--sans:"Helvetica Neue",Helvetica,Arial,sans-serif;--mono:"SFMono-Regular",Consolas,monospace;max-width:1320px;margin:0 auto;padding:clamp(3rem,7vw,8rem) clamp(1rem,4vw,4rem) 8rem;color:var(--ink);font-family:var(--sans)}
        .ghs-loading{padding:7rem 1rem;text-align:center;color:#486B3C;font:600 .65rem/1 var(--ghibli-meta);letter-spacing:.14em;text-transform:uppercase}
        .ghs-intro{display:grid;opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1);grid-template-columns:1fr .72fr;min-height:330px;margin-bottom:clamp(3rem,6vw,5.5rem);background:#fff;border-radius:32px;overflow:hidden;box-shadow:0 22px 60px rgba(25,54,47,.1)}
        .ghs-intro-copy{display:flex;flex-direction:column;justify-content:center;padding:clamp(2rem,4vw,4.5rem)}
        .ghs-kicker{margin:0 0 1.1rem;color:var(--coral);font:600 .58rem/1 var(--mono);letter-spacing:.16em;text-transform:uppercase}
        .ghs-intro-copy>p:last-child{max-width:690px;margin:0;color:#48675D;font:400 clamp(1.05rem,1.6vw,1.3rem)/1.65 var(--sans)}
        .ghs-intro-copy strong{color:var(--red);font-weight:600}
        .ghs-intro-copy strong{color:var(--red)}
        .ghs-intro-art{position:relative;min-height:330px;overflow:hidden;background:var(--teal)}
        .ghs-intro-art img{display:block;width:100%;height:100%;min-height:330px;object-fit:cover;object-position:center}
        .ghs-intro-art:after{position:absolute;inset:0;background:linear-gradient(180deg,rgba(25,54,47,.02),rgba(25,54,47,.34));content:"";pointer-events:none}
        .ghs-index{position:absolute;z-index:5;left:2rem;bottom:1.75rem;color:#fff;font:600 .65rem/1 var(--mono);letter-spacing:.14em}
        .ghs-index b{font-size:2rem;color:var(--cream);font-weight:500}
        .ghs-intro-note{position:absolute;z-index:5;right:1.75rem;bottom:1.75rem;padding:.7rem .9rem;border:1px solid rgba(255,255,255,.35);border-radius:999px;color:#fff;font:600 .55rem/1 var(--mono);letter-spacing:.1em;text-transform:uppercase}
        .ghs-route{display:flex;align-items:center;gap:1rem;margin:0 0 1.5rem;color:var(--moss);font:600 .58rem/1 var(--mono);letter-spacing:.14em;text-transform:uppercase}
        .ghs-route i{height:1px;flex:1;background:rgba(25,54,47,.2)}
        .ghs-intro.is-visible,.ghs-entry.is-visible{opacity:1;transform:none}
        .ghs-entry{position:relative;opacity:0;transform:translateY(34px);transition:opacity .75s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);align-items:center;min-height:650px;margin:0 0 clamp(3rem,6vw,7rem)}
        .ghs-entry:nth-child(even){grid-template-columns:minmax(320px,.8fr) minmax(0,1.2fr)}
        .ghs-entry:nth-child(even) .ghs-image-wrap{grid-column:2;grid-row:1}
        .ghs-entry:nth-child(even) .ghs-copy{grid-column:1;grid-row:1}
        .ghs-image-wrap{position:relative;z-index:1;height:min(70vw,700px);overflow:hidden;border-radius:34px;background:var(--sky);box-shadow:0 30px 80px rgba(25,54,47,.16)}
        .ghs-image-wrap img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .9s cubic-bezier(.22,1,.36,1)}
        .ghs-entry:hover .ghs-image-wrap img{transform:scale(1.035)}
        @media(prefers-reduced-motion:reduce){
          .ghs-intro,.ghs-entry{opacity:1;transform:none;transition:none}
          .ghs-entry:hover .ghs-image-wrap img{transform:none}
        }
        .ghs-image-wrap:after{position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(25,54,47,.28));content:"";pointer-events:none}
        .ghs-year{position:absolute;z-index:3;right:1.25rem;bottom:1.25rem;padding:.55rem .75rem;border-radius:999px;background:rgba(255,247,232,.92);color:var(--blue);font:600 .55rem/1 var(--mono);letter-spacing:.1em}
        .ghs-num{position:absolute;z-index:4;top:1.5rem;left:1.5rem;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--cream);color:var(--blue);font:600 .62rem/1 var(--mono);box-shadow:0 10px 25px rgba(25,54,47,.16)}
        .ghs-copy{position:relative;z-index:2;margin-left:-12%;padding:clamp(2rem,5vw,5rem);background:#fff;border-radius:34px;box-shadow:0 24px 70px rgba(25,54,47,.12)}
        .ghs-entry:nth-child(even) .ghs-copy{margin-left:0;margin-right:-12%}
        .ghs-chapter{margin:0 0 .9rem;color:var(--coral);font:600 .62rem/1 var(--mono);letter-spacing:.14em;text-transform:uppercase}
        .ghs-copy h3{margin:0;color:var(--blue);font:400 clamp(2.7rem,5vw,5.6rem)/.86 var(--serif);letter-spacing:-.055em}
        .ghs-ren{margin:1.8rem 0 0;font-size:1.06rem;line-height:1.75}
        .ghs-creator{margin-top:2.25rem;padding-top:1.4rem;border-top:1px solid rgba(25,54,47,.14)}
        .ghs-creator-label{display:flex;justify-content:space-between;gap:1rem;align-items:baseline}
        .ghs-creator-label span{color:var(--moss);font:600 .55rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}
        .ghs-creator-label b{color:var(--blue);font:600 .58rem/1.2 var(--mono);letter-spacing:.05em;text-transform:uppercase;text-align:right}
        .ghs-creator p{margin:.75rem 0 0;color:#49675d;font-size:.86rem;line-height:1.65}
        .ghs-entry:nth-child(1) .ghs-num{color:var(--coral)}.ghs-entry:nth-child(2) .ghs-num{color:var(--blue)}.ghs-entry:nth-child(3) .ghs-num{color:var(--moss)}.ghs-entry:nth-child(4) .ghs-num{color:var(--coral)}.ghs-entry:nth-child(5) .ghs-num{color:var(--teal)}.ghs-entry:nth-child(6) .ghs-num{color:var(--red)}
        .ghs-end{margin:clamp(1rem,3vw,2.5rem) 0 0;padding:clamp(2.5rem,5vw,4rem) 1rem;text-align:center}
        .ghs-end span{color:var(--coral);font:600 .58rem/1 var(--mono);letter-spacing:.16em;text-transform:uppercase}
        .ghs-end p{margin:.85rem 0 0;color:var(--blue);font:400 clamp(2rem,4vw,4.2rem)/.92 var(--serif);letter-spacing:-.045em}
        .ghs-end em{color:var(--coral);font-style:italic}
        .ghs-end small{display:block;margin:1.25rem 0 0;color:#71847d;font:600 .5rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}
        @media(max-width:800px){
          .ghs{padding:2.25rem 1rem 5rem}
          .ghs-intro{display:block;min-height:0;border-radius:22px;margin-bottom:2.75rem}
          .ghs-intro-art{height:145px;min-height:0}.ghs-intro-art img{min-height:145px}
          .ghs-intro-copy{padding:1.45rem 1.25rem 1.65rem}
          .ghs-intro-copy>p:last-child{font-size:.92rem;line-height:1.55}
          .ghs-kicker{margin-bottom:.8rem}
          .ghs-sun{width:70px;height:70px;right:19%;top:18%}.ghs-leaf{width:90px;height:38px}
          .ghs-index{left:1rem;bottom:.75rem}.ghs-intro-note{right:1rem;bottom:.75rem}
          .ghs-entry,.ghs-entry:nth-child(even){display:block;min-height:0;margin-bottom:3rem}
          .ghs-entry:nth-child(even) .ghs-image-wrap,.ghs-entry:nth-child(even) .ghs-copy{grid-column:auto;grid-row:auto}
          .ghs-image-wrap{height:112vw;max-height:560px;border-radius:22px}
          .ghs-copy,.ghs-entry:nth-child(even) .ghs-copy{margin:-4rem .7rem 0;padding:1.5rem 1.2rem 1.75rem;border-radius:22px}
          .ghs-num{top:1rem;left:1rem;width:42px;height:42px}
          .ghs-copy h3{font-size:clamp(2.2rem,11vw,3.5rem)}
          .ghs-ren{font-size:.9rem;line-height:1.6}
          .ghs-creator{margin-top:1.5rem;padding-top:1rem}.ghs-creator-label{display:block}.ghs-creator-label b{display:block;margin-top:.45rem;text-align:left}.ghs-creator p{font-size:.74rem;line-height:1.55}
          .ghs-end{border-radius:24px;padding:4rem 1.25rem}
          .ghs-end p{font-size:2.8rem}
        }
        @media(prefers-reduced-motion:reduce){.ghs-image-wrap img{transition:none}.ghs-entry:hover .ghs-image-wrap img{transform:none}}
      `}</style>

      <header className="ghs-intro">
        <div className="ghs-intro-copy">
          <p className="ghs-kicker">01 / Mi historia con Ghibli</p>
          <p>
            <strong>El viaje de Chihiro</strong> fue la primera película de anime que vi.
            Desde entonces, Ghibli se convirtió en una forma de mirar el anime: naturaleza,
            imaginación, música y pequeñas historias que se quedan contigo.
          </p>
        </div>
        <div className="ghs-intro-art">
          <img
            src="https://www.ghibli.jp/gallery/chihiro001.jpg"
            alt="Escena de Spirited Away"
            loading="eager"
            decoding="async"
          />
          <span className="ghs-index"><b>01</b> / 07</span>
          <span className="ghs-intro-note">2001 — ahora</span>
        </div>
      </header>

      <div className="ghs-route" aria-hidden="true"><span>Mi viaje</span><i /><span>2001 — ahora</span></div>

      <div className="ghs-entries">
        {entries.map((entry, index) => {
          const item = media[entry.id];
          const image = item?.coverImage?.extraLarge || item?.coverImage?.large;
          return (
            <article className="ghs-entry" key={entry.id}>
              <div className="ghs-image-wrap">
                {image ? (
                  <img src={image} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                ) : (
                  <div className="ghs-placeholder">{entry.title}</div>
                )}
                <span className="ghs-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="ghs-year">{entry.year}</span>
              </div>
              <div className="ghs-copy">
                <p className="ghs-chapter">{entry.chapter}</p>
                <h3>{entry.title}</h3>
                <p className="ghs-ren">{entry.renText}</p>
                <div className="ghs-creator">
                  <div className="ghs-creator-label">
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

      <footer className="ghs-end">
        <span>El viaje continúa</span>
        <p>Algunas ya son recuerdos.<br /><em>Otras todavía me esperan.</em></p>
        <small>{totalFilms} películas · {watchedFilms} vistas · {totalFilms - watchedFilms} por descubrir</small>
      </footer>
    </section>
  );
}
