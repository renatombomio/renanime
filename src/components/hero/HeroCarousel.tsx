import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export interface HeroSlide {
  id: string;
  title: string;
  year?: number;
  format: string;
  banner?: string;
  cover: string;
  eyebrow: string;
  note: string;
}

interface Props {
  slides: HeroSlide[];
}

export default function HeroCarousel({ slides }: Props) {
  const [active, setActive] = useState(0);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;

    timer.current = setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 7000);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length]);

  useEffect(() => {
    const images = imageRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!images.length) return;

    gsap.killTweensOf(images);

    images.forEach((image, index) => {
      gsap.set(image, {
        autoAlpha: index === active ? 1 : 0,
        scale: index === active ? 1 : 1.025,
      });
    });

    gsap.to(images[active], {
      autoAlpha: 1,
      scale: 1.025,
      duration: 7,
      ease: "none",
    });
  }, [active]);

  const goTo = (index: number) => {
    if (index === active) return;
    if (timer.current) clearInterval(timer.current);
    setActive(index);
    timer.current = setInterval(
      () => setActive((current) => (current + 1) % slides.length),
      7000,
    );
  };

  if (!slides.length) return null;

  return (
    <section className="hero" aria-label="Renanime's Gallery">
      <div className="hero-media" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(element) => {
              imageRefs.current[index] = element;
            }}
            className="hero-image"
            style={{
              backgroundImage: `url("${slide.banner || slide.cover}")`,
            }}
          />
        ))}
        <div className="hero-vignette" />
        <div className="hero-grain" />
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

        <div className="hero-controls" aria-label="Cambiar anime destacado">
          <div className="hero-progress">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === active ? "is-active" : ""}
                aria-label={`Mostrar ${slide.title}`}
                aria-pressed={index === active}
                onClick={() => goTo(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
          <p className="hero-scroll">Scroll to explore</p>
        </div>
      </div>
    </section>
  );
}
