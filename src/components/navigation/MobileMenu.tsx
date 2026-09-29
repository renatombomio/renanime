import { useEffect, useState } from "react";

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

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-menu-open", open);
    return () => document.documentElement.classList.remove("mobile-menu-open");
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`mobile-nav ${variant === "ghibli" ? "mobile-nav--ghibli" : ""} ${open ? "is-open" : ""}`}>
      <button
        className="mobile-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
      </button>

      <button
        className="mobile-backdrop"
        type="button"
        aria-label="Cerrar menú"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div className="mobile-panel" id="mobile-navigation" aria-hidden={!open}>
        <nav aria-label="Navegación móvil">
          {links.map((link, index) => (
            <a
              key={link.href}
              className={link.href === "/ghibli/" ? "mobile-link mobile-link--secret" : "mobile-link"}
              href={link.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              style={{ "--menu-index": index } as React.CSSProperties}
            >
              <span>{link.label}</span>
              {link.href === "/ghibli/" && <i aria-hidden="true">✦</i>}
            </a>
          ))}
        </nav>
      </div>

      <style>{`
        .mobile-nav { position: relative; z-index: 100; display: block; }
        .mobile-toggle {
          position: relative; z-index: 3; width: 42px; height: 42px;
          display: grid; place-items: center; border: 0; border-radius: 999px;
          padding: 0; background: transparent; color: inherit; cursor: pointer;
          -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        }
        .mobile-toggle span {
          position: absolute; width: 20px; height: 1.5px; border-radius: 999px;
          background: currentColor; transform-origin: center;
          transition: transform 420ms cubic-bezier(.22,1,.36,1);
        }
        .mobile-toggle span:first-child { transform: translateY(-4px); }
        .mobile-toggle span:last-child { transform: translateY(4px); }
        .mobile-nav.is-open .mobile-toggle span:first-child { transform: translateY(0) rotate(45deg); }
        .mobile-nav.is-open .mobile-toggle span:last-child { transform: translateY(0) rotate(-45deg); }

        .mobile-backdrop {
          position: fixed; top: 68px; right: 0; bottom: 0; left: 0; z-index: 0; width: 100%; height: auto;
          border: 0; padding: 0; background: rgba(0,0,0,.42);
          opacity: 0; visibility: hidden; pointer-events: none;
          backdrop-filter: blur(3px);
          transition: opacity 360ms ease, visibility 0s linear 360ms;
        }
        .mobile-nav.is-open .mobile-backdrop {
          opacity: 1; visibility: visible; pointer-events: auto;
          transition: opacity 360ms ease, visibility 0s;
        }

        .mobile-panel {
          position: fixed; top: 68px; right: 0; left: 0; z-index: 2;
          min-height: calc(100dvh - 68px); max-height: calc(100dvh - 68px);
          padding: 12px 24px 40px; overflow-y: auto; overscroll-behavior: contain;
          background: #090909; color: #f5f2ec; opacity: 0; visibility: hidden;
          pointer-events: none; transform: translateY(-18px);
          transition: opacity 360ms ease, transform 480ms cubic-bezier(.22,1,.36,1), visibility 0s linear 480ms;
          box-shadow: 0 24px 60px rgba(0,0,0,.3);
          -webkit-overflow-scrolling: touch;
        }
        .mobile-nav.is-open .mobile-panel {
          opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0);
          transition: opacity 360ms ease, transform 480ms cubic-bezier(.22,1,.36,1), visibility 0s;
        }
        .mobile-panel nav { display: flex; flex-direction: column; }

        .mobile-link {
          display: flex; align-items: center; justify-content: space-between;
          min-height: 54px; padding: 13px 0;
          border-bottom: 1px solid rgba(245,242,236,.1);
          color: #b9b2a7; font-family: var(--font-meta); font-size: 12px;
          font-weight: 500; letter-spacing: .08em; line-height: 1.2;
          text-transform: uppercase; text-decoration: none; opacity: 0;
          transform: translateY(14px);
          transition: color 180ms ease, opacity 420ms cubic-bezier(.22,1,.36,1), transform 420ms cubic-bezier(.22,1,.36,1);
          transition-delay: 0ms; -webkit-tap-highlight-color: transparent;
        }
        .mobile-nav.is-open .mobile-link {
          opacity: 1; transform: translateY(0);
          transition-delay: calc(70ms + (var(--menu-index) * 48ms));
        }
        .mobile-link:active { color: #f5f2ec; }
        .mobile-link--secret {
          position: relative;
          margin-top: 22px;
          min-height: 58px;
          padding: 15px 2px 16px;
          border: 0;
          border-top: 1px solid rgba(164,138,104,.28);
          border-bottom: 1px solid rgba(164,138,104,.28);
          border-radius: 0;
          background: transparent;
          color: #f5f2ec;
          font-family: var(--font-heading);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: .015em;
          text-transform: none;
          overflow: hidden;
        }
        .mobile-link--secret::before {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #a48a68 22%, #c2ae91 78%, transparent);
          content: "";
          transform: scaleX(.45);
          transform-origin: center;
          transition: transform 420ms cubic-bezier(.22,1,.36,1);
        }
        .mobile-link--secret:active::before {
          transform: scaleX(1);
        }
        .mobile-link--secret i {
          color: #c2ae91;
          font-family: Georgia,serif;
          font-size: 17px;
          font-style: normal;
          margin-left: 8px;
        }

        .mobile-nav--ghibli .mobile-toggle { color: #19362f; }
        .mobile-nav--ghibli .mobile-panel { background: #fffdf8; color: #19362f; }
        .mobile-nav--ghibli .mobile-link { color: #527066; border-bottom-color: rgba(25,54,47,.12); }
        .mobile-nav--ghibli .mobile-link:active { color: #18528a; }
        .mobile-nav--ghibli .mobile-link--secret {
          border-top-color: rgba(24,82,138,.24);
          border-bottom-color: rgba(24,82,138,.24);
          background: transparent;
          color: #19362f;
        }
        .mobile-nav--ghibli .mobile-link--secret::before {
          background: linear-gradient(90deg, transparent, #18528a 22%, #f45164 78%, transparent);
        }
        .mobile-nav--ghibli .mobile-link--secret i { color: #f45164; }

        @media (min-width: 521px) and (max-width: 1120px) {
          .mobile-panel {
            top: 74px; min-height: calc(100dvh - 74px); max-height: calc(100dvh - 74px);
            padding-left: 40px; padding-right: 40px;
          }
        }
        @media (min-width: 1121px) { .mobile-nav { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .mobile-toggle span, .mobile-backdrop, .mobile-panel, .mobile-link {
            transition-duration: .01ms !important; transition-delay: 0ms !important;
          }
        }
      `}</style>
    </div>
  );
}
