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


  return (
    <div className="ghibli-view">
      <style>{`
        .ghibli-view{--gp-cream:#FFF7E8;--gp-paper:#F4E9D5;--gp-sky:#DCEFF1;--gp-blue:#18528A;--gp-teal:#0B798B;--gp-coral:#F45164;--gp-pink:#F0A9A5;--gp-lime:#91CC57;--gp-ink:#19362F}
        .ghibli-view .ghibli-meta{border-bottom-color:rgba(25,54,47,.16);color:#486B3C}
        .ghibli-view .ghibli-meta strong{color:var(--gp-coral)}
        .ghibli-view{width:min(1120px,calc(100% - clamp(2rem,8vw,6rem)));margin:0 auto}.ghibli-view .ghibli-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(2rem,4vw,4.5rem) clamp(1rem,2.4vw,2.5rem);margin-top:1.35rem}.ghibli-view .ghibli-card{width:100%}
        .ghibli-view .ghibli-card{position:relative;overflow:hidden;border:0;border-radius:0;background:#111;box-shadow:none;transition:transform .45s cubic-bezier(.22,1,.36,1)}
        .ghibli-view .ghibli-card:hover{transform:translateY(-4px)}
        .ghibli-view .ghibli-poster{position:relative;width:100%;aspect-ratio:2 / 3;border-radius:0;background:var(--gp-sky);overflow:hidden}
        .ghibli-view .ghibli-poster:after{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 0%,transparent 48%,rgba(0,0,0,.82) 100%);content:"";pointer-events:none}
        .ghibli-view .ghibli-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.22,1,.36,1)}
        .ghibli-view .ghibli-card:hover .ghibli-poster img{transform:scale(1.025)}
        .ghibli-view .ghibli-year{position:static;display:block;margin-top:.32rem;color:rgba(255,255,255,.9);font-family:var(--font-meta);font-size:.62rem;font-weight:600;line-height:1;letter-spacing:.09em}
        .ghibli-view .ghibli-badge{position:absolute;z-index:4;top:.65rem;right:.65rem;left:auto;bottom:auto;padding:.28rem .42rem;background:rgba(17,17,17,.78);color:#fff;border:0;border-radius:0;font-family:var(--font-meta);font-size:.4rem;line-height:1;letter-spacing:.08em;text-transform:uppercase;box-shadow:none}
        .ghibli-view .ghibli-info{position:absolute;z-index:3;left:.65rem;right:.65rem;bottom:.75rem;min-height:0;padding:0;background:transparent;pointer-events:none}
        .ghibli-view .ghibli-info h3{margin:0;color:#fff;font-family:var(--font-body);font-size:clamp(.72rem,1.3vw,.95rem);font-weight:500;line-height:1.05;letter-spacing:-.02em;text-shadow:0 1px 8px rgba(0,0,0,.4)}
        .ghibli-view .ghibli-info span{display:none}
        .ghibli-view .ghibli-info .ghibli-year{display:block;position:static;margin-top:.2rem;color:rgba(255,255,255,.62);font-family:var(--font-meta);font-size:.42rem;line-height:1;letter-spacing:.08em}
        .ghibli-view .ghibli-placeholder{position:relative;background:linear-gradient(145deg,#f4c1bd 0%,#e6eff0 100%);color:var(--gp-blue)}
        .ghibli-view .ghibli-placeholder:after{position:absolute;inset:12%;border:1px solid rgba(24,82,138,.18);border-radius:50%;content:"";transform:rotate(-12deg)}
        @media(max-width:700px){
          .ghibli-view .ghibli-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:2.5rem .75rem;margin-top:1rem}
          .ghibli-view .ghibli-card{border-radius:0}
          .ghibli-view .ghibli-info{left:.55rem;right:.55rem;bottom:.68rem}
          .ghibli-view .ghibli-info h3{font-size:.72rem;line-height:1.05}
          .ghibli-view .ghibli-year{font-size:.32rem;margin-top:.18rem}
          .ghibli-view .ghibli-badge{top:.55rem;right:.55rem;padding:.22rem .3rem;font-size:.32rem}
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
                    {film.watched && <span className="ghibli-badge">VISTA</span>}
                  </div>
                  <div className="ghibli-info">
                    <h3>{film.title}</h3>
                    <span className="ghibli-year">{film.year}</span>
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
