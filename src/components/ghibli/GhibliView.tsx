import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface Film { id: string; title: string; year: number; watched: boolean; searchTitle?: string; }
interface Media { id: number; title?: { romaji?: string | null; english?: string | null }; coverImage?: { extraLarge?: string | null; large?: string | null }; }

export default function GhibliView({ films }: { films: Film[] }) {
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const variables: Record<string, string> = {};
    const fields = films.map((film, index) => {
      variables["s" + index] = film.searchTitle || film.title;
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

  useEffect(() => {
    if (loading || !gridRef.current) return;
    const grid = gridRef.current;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".ghibli-card"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!cards.length || reduceMotion) return;

    const cleanups: Array<() => void> = [];

    cards.forEach((card, index) => {
      gsap.set(card, { autoAlpha: 0, y: 22, scale: 0.985 });

      const reveal = () => {
        gsap.to(card, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.58,
          delay: index * 0.055,
          ease: "power3.out",
          overwrite: true,
        });
      };

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          if (!entries[0]?.isIntersecting) return;
          observer.disconnect();
          reveal();
        }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
        observer.observe(card);
        cleanups.push(() => observer.disconnect());
      } else {
        reveal();
      }

      const link = card.querySelector<HTMLElement>("a");
      const poster = card.querySelector<HTMLElement>(".ghibli-poster");
      if (!link || !poster) return;

      const press = () => gsap.to(card, { scale: 0.985, duration: 0.12, ease: "power2.out", overwrite: true });
      const release = () => gsap.to(card, { y: 0, scale: 1, duration: 0.38, ease: "power3.out", overwrite: true });
      const enter = () => {
        gsap.to(card, { y: -5, scale: 1.012, duration: 0.32, ease: "power2.out", overwrite: true });
        gsap.to(poster, { scale: 1.025, duration: 0.5, ease: "power2.out", overwrite: true });
      };
      const leave = () => {
        gsap.to(card, { y: 0, scale: 1, duration: 0.42, ease: "power3.out", overwrite: true });
        gsap.to(poster, { scale: 1, duration: 0.5, ease: "power2.out", overwrite: true });
      };

      link.addEventListener("pointerdown", press);
      link.addEventListener("pointerup", release);
      link.addEventListener("pointercancel", release);
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);

      cleanups.push(() => {
        link.removeEventListener("pointerdown", press);
        link.removeEventListener("pointerup", release);
        link.removeEventListener("pointercancel", release);
        link.removeEventListener("pointerenter", enter);
        link.removeEventListener("pointerleave", leave);
        gsap.killTweensOf([card, poster]);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [loading]);

  const watched = films.filter((film) => film.watched).length;

  return (
    <div className="ghibli-view">
      <style>{`
        .ghibli-view{--gp-cream:#FFF7E8;--gp-paper:#F4E9D5;--gp-sky:#DCEFF1;--gp-blue:#18528A;--gp-teal:#0B798B;--gp-coral:#F45164;--gp-pink:#F0A9A5;--gp-lime:#91CC57;--gp-ink:#19362F}
        .ghibli-view .ghibli-meta{border-bottom-color:rgba(25,54,47,.16);color:#486B3C}
        .ghibli-view .ghibli-meta strong{color:var(--gp-coral)}
        .ghibli-view{width:min(1120px,calc(100% - clamp(2rem,8vw,6rem)));margin:0 auto}.ghibli-view .ghibli-grid{gap:1rem .72rem;margin-top:1.35rem}
        .ghibli-view .ghibli-card{position:relative;overflow:hidden;border:1px solid rgba(25,54,47,.1);border-radius:22px;background:#fff;box-shadow:0 12px 32px rgba(25,54,47,.07);transition:transform .45s cubic-bezier(.22,1,.36,1),box-shadow .45s,border-color .45s}
        .ghibli-view .ghibli-card:before{position:absolute;z-index:5;left:0;top:0;bottom:0;width:3px;background:var(--gp-coral);content:"";opacity:.75}
        .ghibli-view .ghibli-card:nth-child(3n):before{background:var(--gp-blue)}
        .ghibli-view .ghibli-card:nth-child(3n+2):before{background:var(--gp-lime)}
        .ghibli-view .ghibli-card:hover{border-color:rgba(24,82,138,.24);background:#fff;box-shadow:0 22px 48px rgba(25,54,47,.13);transform:translateY(-6px)}
        .ghibli-view .ghibli-poster{border-radius:0;background:var(--gp-sky)}
        .ghibli-view .ghibli-poster:after{background:linear-gradient(180deg,transparent 48%,rgba(25,54,47,.34))}
        .ghibli-view .ghibli-year{left:.8rem;bottom:.8rem;background:rgba(255,247,232,.94);color:var(--gp-blue);border:1px solid rgba(24,82,138,.12)}
        .ghibli-view .ghibli-badge{top:.8rem;right:.8rem;background:var(--gp-lime);color:var(--gp-ink);border:0}
        .ghibli-view .ghibli-info{min-height:5.25rem;padding:.68rem .7rem .78rem;background:#fff}
        .ghibli-view .ghibli-info h3{color:var(--gp-blue);font-family:Georgia,"Times New Roman",serif;font-size:.92rem;line-height:1.08;letter-spacing:-.02em}
        .ghibli-view .ghibli-info span{display:block;margin-top:.15rem;color:#59756b;font-size:.52rem;line-height:1.3}
        .ghibli-view .ghibli-placeholder{position:relative;background:linear-gradient(145deg,#f4c1bd 0%,#e6eff0 100%);color:var(--gp-blue)}
        .ghibli-view .ghibli-placeholder:after{position:absolute;inset:12%;border:1px solid rgba(24,82,138,.18);border-radius:50%;content:"";transform:rotate(-12deg)}
        @media(max-width:560px){
          .ghibli-view .ghibli-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem .7rem;margin-top:1rem}
          .ghibli-view .ghibli-card{border-radius:13px}
          .ghibli-view .ghibli-card:before{width:2px}
          .ghibli-view .ghibli-info{min-height:4.8rem;padding:.55rem .48rem .62rem}
          .ghibli-view .ghibli-info h3{font-size:.66rem;line-height:1.05}
          .ghibli-view .ghibli-info span{font-size:.38rem;line-height:1.25}
          .ghibli-view .ghibli-year,.ghibli-view .ghibli-badge{padding:.25rem .3rem;font-size:.35rem}
        }
      `}</style>
      {loading ? (
        <div className="ghibli-loading" role="status" aria-live="polite">Abriendo el archivo…</div>
      ) : (
        <div ref={gridRef} className="ghibli-grid">
          {films.map((film, index) => {
            const item = media[film.id];
            const image = item?.coverImage?.extraLarge || item?.coverImage?.large;
            const fallbackImage = film.id === "the-red-turtle" ? "https://www.ghibli.jp/images/red-turtle.jpg" : null;
            const posterImage = image || fallbackImage;
            const href = item
              ? "/ghibli/anime?id=" + item.id
              : "/ghibli/anime?film=" + encodeURIComponent(film.id);

            return (
              <article className={"ghibli-card" + (film.watched ? " is-watched" : "")} key={film.id}>
                <a href={href} aria-label={"Abrir " + film.title}>
                  <div className="ghibli-poster">
                    {posterImage ? (
                      <img src={posterImage} alt="" loading={index < 6 ? "eager" : "lazy"} decoding="async" />
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
