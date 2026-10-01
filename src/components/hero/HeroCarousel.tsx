import { useEffect, useRef, useState } from "react";

export interface HeroSlide {
  id: string;
  title: string;
  year?: number;
  format?: string;
  banner?: string;
  cover?: string;
  eyebrow?: string;
  note?: string;
}

interface Props {
  slides: HeroSlide[];
  kicker?: string;
  title?: string;
  copy?: string;
  videoSrc?: string;
  variant?: "default" | "ghibli";
}

const formatLabel = (format?: string) => {
  if (format === "MOVIE") return "Película";
  if (format === "TV") return "Serie";
  return format || "Anime";
};

export default function HeroCarousel({
  slides,
  kicker = "Renanime's",
  title = "Gallery.",
  copy = "Anime a través de mis ojos.\nEste es mi regalo para ti.",
  videoSrc = "/videos/hero.mp4",
  variant = "default",
}: Props) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotionRef = useRef(false);

  const current = slides[active];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reduceMotionRef.current = mediaQuery.matches; };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      video.muted = true;
      if (mediaQuery.matches) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };
    syncPlayback();
    mediaQuery.addEventListener("change", syncPlayback);
    return () => mediaQuery.removeEventListener("change", syncPlayback);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || reduceMotionRef.current) return;
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setActive((index) => (index + 1) % slides.length);
      if (event.key === "ArrowLeft") setActive((index) => (index - 1 + slides.length) % slides.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onMove = (event: PointerEvent) => {
      if (reduceMotionRef.current || !window.matchMedia("(hover: hover)").matches) return;
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      hero.style.setProperty("--hero-parallax-x", `${x * -10}px`);
      hero.style.setProperty("--hero-parallax-y", `${y * -6}px`);
    };
    const reset = () => {
      hero.style.setProperty("--hero-parallax-x", "0px");
      hero.style.setProperty("--hero-parallax-y", "0px");
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", reset);
    };
  }, []);

  if (!slides.length) {
    return (
      <section className={`hero hero--${variant}`} aria-label="Renanime's Gallery">
        <div className="hero-fallback">
          <p><span className="hero-accent">Ren</span>anime's</p>
          <h1>{title}</h1>
          <span>{copy}</span>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={heroRef}
      className={`hero hero--${variant}`}
      aria-roledescription="carousel"
      aria-label="Renanime's Gallery"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hero-slides" aria-live="polite">
        {slides.map((slide, index) => {
          const image = slide.banner || slide.cover;
          const isActive = index === active;
          return (
            <div
              className={`hero-slide${isActive ? " is-active" : ""}`}
              key={slide.id}
              aria-hidden={!isActive}
            >
              {image && <img className="hero-image" src={image} alt="" loading={index === 0 ? "eager" : "lazy"} />}
            </div>
          );
        })}
      </div>

      <div className="hero-media-wash" aria-hidden="true" />

      <div className="hero-video-wrap" aria-hidden="true">
        <video ref={videoRef} className="hero-video" muted loop playsInline autoPlay preload="metadata">
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>

      <div className="hero-inner">
        <div className="hero-brand">
          <p className="hero-kicker">
            {kicker === "Renanime's" ? <><span className="hero-accent">Ren</span>anime's</> : kicker}
          </p>
          <h1>{title}</h1>
          <p className="hero-copy">
            {copy.split("\n").map((line, index) => <span key={`${line}-${index}`}>{index > 0 && <br />}{line}</span>)}
          </p>
        </div>

        <div className="hero-slide-content">
          <div className="hero-slide-copy">
            <span className="hero-eyebrow">{current.eyebrow || "De mi archivo"}</span>
            <h2>{current.title}</h2>
            <div className="hero-meta" aria-label="Información del anime">
              <span>{current.year || "—"}</span>
              <span>{formatLabel(current.format)}</span>
            </div>
            {current.note && <p>{current.note}</p>}
            <a className="hero-cta" href={`/anime/search?id=${current.id}&from=hero`}>
              Ver anime <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="hero-controls">
            <div className="hero-progress" role="tablist" aria-label="Seleccionar anime destacado">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Mostrar ${slide.title}`}
                  className={index === active ? "is-active" : ""}
                  onClick={() => setActive(index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
            <span className="hero-scroll">Scroll to explore ↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
