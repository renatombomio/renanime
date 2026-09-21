import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export interface HeroSlide {
  id: string;
  title: string;
  year?: number;
  format: string;
  synopsis?: string;
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
  const root = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;

    const advance = () => setActive((current) => (current + 1) % slides.length);
    timer.current = setInterval(advance, 7000);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length]);

  useEffect(() => {
    const images = imageRefs.current.filter(Boolean) as HTMLDivElement[];
    const contents = contentRefs.current.filter(Boolean) as HTMLDivElement[];

    if (!images.length) return;

    gsap.killTweensOf(images);
    gsap.killTweensOf(contents);

    images.forEach((image, index) => {
      gsap.set(image, {
        autoAlpha: index === active ? 1 : 0,
        scale: index === active ? 1.03 : 1.08,
      });
    });

    contents.forEach((content, index) => {
      gsap.set(content, {
        autoAlpha: index === active ? 1 : 0,
        y: index === active ? 0 : 18,
      });
    });

    gsap.to(images[active], {
      autoAlpha: 1,
      scale: 1.08,
      duration: 7,
      ease: "none",
    });

    gsap.to(contents[active], {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
    });
  }, [active]);

  const goTo = (index: number) => {
    if (index === active) return;
    if (timer.current) clearInterval(timer.current);
    setActive(index);
    timer.current = setInterval(() => setActive((current) => (current + 1) % slides.length), 7000);
  };

  if (!slides.length) return null;

  return (
    <section ref={root} className="hero" aria-label="Renanime's Gallery">
      <div className="hero-media" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(element) => { imageRefs.current[index] = element; }}
            className="hero-image"
            style={{ backgroundImage: `url("${slide.banner || slide.cover}")` }}
          />
        ))}
        <div className="hero-vignette" />
        <div className="hero-grain" />
      </div>

      <div className="hero-inner">
        <div className="hero-brand">
          <p className="hero-kicker">
            <span className="hero-accent">Ren</span>anime's
          </p>
          <h1>Gallery.</h1>
        </div>

        <div className="hero-slides">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              ref={(element) => { contentRefs.current[index] = element; }}
              className="hero-content"
              aria-hidden={index !== active}
            >
              <p className="hero-eyebrow">{slide.eyebrow}</p>
              <h2>{slide.title}</h2>
              <p className="hero-note">{slide.note}</p>
              <div className="hero-meta">
                <span>{slide.year ?? "—"}</span>
                <span>{slide.format}</span>
                <span>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
              </div>
            </div>
          ))}
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
