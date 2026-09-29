import { useEffect, useRef } from "react";

interface Props {
  slides: Array<{
    id: string;
    title: string;
  }>;
}

export default function HeroCarousel({
  slides: _slides,
  kicker = "Renanime's",
  title = "Gallery.",
  copy = "Anime a través de mis ojos.\nEste es mi regalo para ti.",
  videoSrc = "/videos/hero.mp4",
}: Props) {
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
