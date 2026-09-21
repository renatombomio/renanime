interface Props {
  slides: Array<{
    id: string;
    title: string;
  }>;
}

export default function HeroCarousel({ slides: _slides }: Props) {
  return (
    <section className="hero" aria-label="Renanime's Gallery">
      <div className="hero-media" aria-hidden="true">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="hero-inner">
        <div className="hero-title">
          <p className="hero-kicker">
            <span className="hero-accent">Ren</span>anime's
          </p>
          <h1>Gallery.</h1>
          <p className="hero-copy">
            Anime a través de mis ojos.<br />
            Este es mi regalo para ti.
          </p>
        </div>
      </div>
    </section>
  );
}
