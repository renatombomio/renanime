import { useEffect, useRef } from "react";

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

export default function HeroCarousel({
  slides: _slides,
  kicker = "Renanime's",
  title = "Gallery.",
  copy = "Anime a través de mis ojos.\nEste es mi regalo para ti.",
  videoSrc = "/videos/hero.mp4",
  variant = "default",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Keep every Hero video silent. React can hydrate the HTML muted attribute
    // differently from the browser's media property, so set both DOM properties
    // before attempting playback.
    video.defaultMuted = true;
    video.muted = true;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      video.defaultMuted = true;
      video.muted = true;

      if (mediaQuery.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {});
    };

    syncPlayback();
    mediaQuery.addEventListener("change", syncPlayback);

    return () => mediaQuery.removeEventListener("change", syncPlayback);
  }, []);

  return (
    <section className={variant === "ghibli" ? "hero hero--ghibli" : "hero"} aria-label="Renanime's Gallery">
      <div className="hero-media" aria-hidden="true">
        <video
          className="hero-video"
          ref={videoRef}
          muted
          suppressHydrationWarning
          loop
          playsInline
          preload="metadata"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>

      <div className="hero-inner">
        <div className="hero-title">
          <p className="hero-kicker">
            {kicker === "Renanime's" ? (
              <>
                <span className="hero-accent">Ren</span>anime's
              </>
            ) : (
              kicker
            )}
          </p>
          <h1>{title}</h1>
          <p className="hero-copy">
            {copy.split("\n").map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}