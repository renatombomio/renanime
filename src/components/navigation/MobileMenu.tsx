import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface Props { variant?: "default" | "ghibli"; }

const links = [
  { label: "Inicio", href: "/" },
  { label: "Favoritos", href: "/favorites/" },
  { label: "Colección", href: "/collection/" },
  { label: "Géneros", href: "/genres/" },
  { label: "Buscar", href: "/search/" },
  { label: "Pendientes", href: "/pending/" },
  { label: "Próximamente", href: "/coming-soon/" },
  { label: "El secreto de Ren", href: "/ghibli/" },
];

export default function MobileMenu({ variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const linksRef = useRef<HTMLAnchorElement[]>([]);
  const lineTopRef = useRef<HTMLSpanElement>(null);
  const lineBottomRef = useRef<HTMLSpanElement>(null);
  const secretRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const top = lineTopRef.current;
    const bottom = lineBottomRef.current;
    if (!panel || !backdrop || !top || !bottom) return;

    const items = linksRef.current.filter(Boolean);
    const secret = secretRef.current;

    if (open) {
      document.documentElement.classList.add("mobile-menu-open");

      gsap.killTweensOf([panel, backdrop, top, bottom, ...items, secret].filter(Boolean));

      gsap.set(panel, { autoAlpha: 1, y: 0 });
      gsap.set(backdrop, { autoAlpha: 1 });
      gsap.set(items, { autoAlpha: 0, y: 18 });
      gsap.set(secret, { autoAlpha: 0, y: 22, scale: 0.98 });
      gsap.set(top, { rotation: 0, y: -4, transformOrigin: "50% 50%" });
      gsap.set(bottom, { rotation: 0, y: 4, transformOrigin: "50% 50%" });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.to(backdrop, { autoAlpha: 1, duration: 0.22 }, 0)
        .fromTo(panel,
          { y: -14, autoAlpha: 0.4 },
          { y: 0, autoAlpha: 1, duration: 0.48, ease: "power3.out" },
          0
        )
        .to(items, {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.055,
          ease: "power3.out"
        }, 0.16)
        .to(secret, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          ease: "back.out(1.35)"
        }, 0.48)
        .to(top, { rotation: 45, y: 0, duration: 0.28, ease: "power2.out" }, 0)
        .to(bottom, { rotation: -45, y: 0, duration: 0.28, ease: "power2.out" }, 0);

      return () => tl.kill();
    }

    document.documentElement.classList.remove("mobile-menu-open");

    gsap.killTweensOf([panel, backdrop, top, bottom, ...items, secret].filter(Boolean));

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(panel, { autoAlpha: 0, y: -10 });
        gsap.set(backdrop, { autoAlpha: 0 });
      }
    });

    tl.to(secret, { autoAlpha: 0, y: 8, duration: 0.16 }, 0)
      .to(items, {
        autoAlpha: 0,
        y: -8,
        duration: 0.16,
        stagger: 0.025,
        ease: "power2.in"
      }, 0)
      .to(panel, { y: -10, autoAlpha: 0, duration: 0.28, ease: "power2.in" }, 0.08)
      .to(backdrop, { autoAlpha: 0, duration: 0.2 }, 0.08)
      .to(top, { rotation: 0, y: -4, duration: 0.22 }, 0)
      .to(bottom, { rotation: 0, y: 4, duration: 0.22 }, 0);

    return () => tl.kill();
  }, [open]);

  useEffect(() => {
    return () => document.documentElement.classList.remove("mobile-menu-open");
  }, []);

  const registerLink = (element: HTMLAnchorElement | null, index: number) => {
    if (element) linksRef.current[index] = element;
  };

  const handleToggle = () => {
    const button = rootRef.current?.querySelector(".mobile-toggle");
    if (button) {
      gsap.fromTo(button,
        { scale: 0.88 },
        { scale: 1, duration: 0.38, ease: "back.out(2)" }
      );
    }
    setOpen((value) => !value);
  };

  const handleSecretPointer = () => {
    if (!secretRef.current) return;

    gsap.fromTo(secretRef.current,
      { x: 0 },
      { x: 7, duration: 0.22, yoyo: true, repeat: 1, ease: "power2.inOut" }
    );
  };

  return (
    <div
      ref={rootRef}
      className={"mobile-nav" + (variant === "ghibli" ? " mobile-nav--ghibli" : "")}
    >
      <button
        className="mobile-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={handleToggle}
      >
        <span ref={lineTopRef} />
        <span ref={lineBottomRef} />
      </button>

      <button
        ref={backdropRef}
        className="mobile-backdrop"
        type="button"
        aria-label="Cerrar menú"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div
        className="mobile-panel"
        id="mobile-navigation"
        aria-hidden={!open}
      >
        <nav aria-label="Navegación móvil">
          {links.map((link, index) => (
            <a
              key={link.href}
              ref={(element) => registerLink(element, index)}
              className={link.href === "/ghibli/" ? "mobile-link mobile-link--secret" : "mobile-link"}
              href={link.href}
              tabIndex={open ? 0 : -1}
              onPointerDown={link.href === "/ghibli/" ? handleSecretPointer : undefined}
              onClick={() => setOpen(false)}
            >
              <span>{link.label}</span>
              {link.href === "/ghibli/" && <i aria-hidden="true">✦</i>}
            </a>
          ))}
        </nav>
      </div>

      <style>{`
        .mobile-nav {
          position: relative;
          z-index: 60;
        }

        .mobile-toggle {
          position: relative;
          z-index: 4;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-toggle span {
          position: absolute;
          width: 20px;
          height: 1.5px;
          border-radius: 999px;
          background: currentColor;
          will-change: transform;
        }

        .mobile-backdrop {
          position: fixed;
          inset: 0;
          z-index: -1;
          width: 100%;
          height: 100%;
          padding: 0;
          border: 0;
          background: rgba(0, 0, 0, 0.38);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          backdrop-filter: blur(2px);
        }

        .mobile-panel {
          position: fixed;
          top: 68px;
          right: 0;
          left: 0;
          z-index: 2;
          min-height: calc(100dvh - 68px);
          padding: 22px 24px 42px;
          overflow: auto;
          overscroll-behavior: contain;
          background: #090909;
          color: #f5f2ec;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
          -webkit-overflow-scrolling: touch;
        }

        .mobile-panel nav {
          display: flex;
          flex-direction: column;
        }

        .mobile-link {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 58px;
          padding: 15px 0;
          border-bottom: 1px solid rgba(245, 242, 236, 0.1);
          color: #b9b2a7;
          font-family: var(--font-meta);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-transform: uppercase;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          will-change: transform, opacity;
        }

        .mobile-link:active {
          color: #f5f2ec;
        }

        .mobile-link::after {
          position: absolute;
          right: 0;
          bottom: -1px;
          left: 0;
          height: 1px;
          background: #a48a68;
          content: "";
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 220ms cubic-bezier(.22,1,.36,1);
        }

        .mobile-link:active::after {
          transform: scaleX(1);
        }

        .mobile-link--secret {
          margin-top: 20px;
          padding: 19px 18px;
          border: 1px solid rgba(164, 138, 104, 0.42);
          border-radius: 14px;
          background: rgba(164, 138, 104, 0.08);
          color: #f5f2ec;
        }

        .mobile-link--secret::after {
          display: none;
        }

        .mobile-link--secret i {
          color: #c2ae91;
          font-family: Georgia, serif;
          font-size: 18px;
          font-style: normal;
        }

        .mobile-nav--ghibli .mobile-toggle {
          color: #19362f;
        }

        .mobile-nav--ghibli .mobile-panel {
          background: #fffdf8;
          color: #19362f;
        }

        .mobile-nav--ghibli .mobile-link {
          color: #527066;
          border-bottom-color: rgba(25, 54, 47, 0.12);
        }

        .mobile-nav--ghibli .mobile-link:active {
          color: #18528a;
        }

        .mobile-nav--ghibli .mobile-link::after {
          background: #f45164;
        }

        .mobile-nav--ghibli .mobile-link--secret {
          border-color: rgba(24, 82, 138, 0.24);
          background: rgba(240, 169, 165, 0.13);
          color: #19362f;
        }

        .mobile-nav--ghibli .mobile-link--secret i {
          color: #f45164;
        }

        @media (min-width: 521px) and (max-width: 1120px) {
          .mobile-panel {
            top: 74px;
            min-height: calc(100dvh - 74px);
            padding-left: 40px;
            padding-right: 40px;
          }
        }

        @media (min-width: 1121px) {
          .mobile-nav {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-toggle span,
          .mobile-link {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
