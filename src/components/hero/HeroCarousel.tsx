import { useEffect, useRef } from "react";

interface Props {
  slides: Array<{
    id: string;
    title: string;
  }>;
}

export default function HeroCarousel({\n  slides: _slides,\n  kicker = "Renanime's",\n  title = "Gallery.",\n  copy = "Anime a través de mis ojos.\\nEste es mi regalo para ti.",\n  videoSrc = "/videos/hero.mp4",\n}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
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
    <section className="hero" aria-label="Renanime's Gallery">
      <div className="hero-media" aria-hidden="true">
        <video
          className="hero-video"
          ref={videoRef}
          muted
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
            {kicker === "Renanime's" ? (\n              <>\n                <span className="hero-accent">Ren</span>anime's\n              </>\n            ) : (\n              kicker\n            )}
          </p>
          <h1>{title}</h1>
          <p className="hero-copy">
            Anime a través de mis ojos.<br />
            Este es mi regalo para ti.
          </p>
        </div>
      </div>
    </section>
  );
}
