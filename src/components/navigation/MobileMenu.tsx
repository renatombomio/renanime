import { useEffect, useState } from "react";
import { localizedPath, useT, type Lang } from "../../i18n";

interface Props { variant?: "default" | "ghibli"; lang: Lang; showLogout?: boolean; }

const links = [
  { key: "nav.home", href: "/" },
  { key: "nav.renCollection", href: "/ren-collection/" },
  { key: "nav.renGenres", href: "/genres/" },
  { key: "nav.search", href: "/search/" },
  { key: "nav.profile", href: "/profile/" },
  { key: "nav.community", href: "/community/" },
  { key: "nav.renSecret", href: "/ghibli/" }
] as const;

export default function MobileMenu({ variant = "default", lang, showLogout = false }: Props) {
  const t = useT(lang);
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    const pathname = window.location.pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    setCurrentPath(pathname.replace(/\/$/, "") || "/");
  }, []);

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
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
      </button>

      <button
        className="mobile-backdrop"
        type="button"
        aria-label={t("nav.closeMenu")}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div className="mobile-panel" id="mobile-navigation" aria-hidden={!open}>
        <nav aria-label={t("nav.mobile")}>
          {links.map((link, index) => (
            <a
              key={link.href}
              className="mobile-link"
              href={localizedPath(lang, link.href)}
              aria-current={currentPath === (link.href.replace(/\/$/, "") || "/") ? "page" : undefined}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              style={{ "--menu-index": index } as React.CSSProperties}
            >
              <span>{t(link.key)}</span>
            </a>
          ))}
          {showLogout && <button className="mobile-logout" type="button" tabIndex={open ? 0 : -1} onClick={async () => {
            const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
            if (response.ok) window.location.href = lang === "en" ? "/en/login/" : "/login/";
          }}>{lang === "en" ? "Log out" : "Cerrar sesión"}</button>}
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
          transition: transform var(--duration-slow) var(--ease-out);
        }
        .mobile-toggle span:first-child { transform: translateY(-4px); }
        .mobile-toggle span:last-child { transform: translateY(4px); }
        .mobile-nav.is-open .mobile-toggle span:first-child { transform: translateY(0) rotate(45deg); }
        .mobile-nav.is-open .mobile-toggle span:last-child { transform: translateY(0) rotate(-45deg); }

        .mobile-backdrop {
          position: fixed; top: 68px; right: 0; bottom: 0; left: 0; z-index: 0; width: 100%; height: auto;
          border: 0; padding: 0; background: var(--color-backdrop);
          opacity: 0; visibility: hidden; pointer-events: none;
          backdrop-filter: blur(3px);
          transition: opacity var(--duration-base) var(--ease-out), visibility 0s linear var(--duration-base);
        }
        .mobile-nav.is-open .mobile-backdrop {
          opacity: 1; visibility: visible; pointer-events: auto;
          transition: opacity var(--duration-base) var(--ease-out), visibility 0s;
        }

        .mobile-panel {
          position: fixed; top: 68px; right: 0; left: 0; z-index: 2;
          min-height: calc(100dvh - 68px); max-height: calc(100dvh - 68px);
          padding: 8px 24px 28px; overflow-y: auto; overscroll-behavior: contain;
          background: var(--color-background); color: var(--color-text-primary); opacity: 0; visibility: hidden;
          pointer-events: none; transform: translateY(-18px);
          transition: opacity var(--duration-base) var(--ease-out), transform var(--duration-slow) var(--ease-out), visibility 0s linear var(--duration-slow);
          box-shadow: 0 24px 60px rgba(0,0,0,.3);
          -webkit-overflow-scrolling: touch;
        }
        .mobile-nav.is-open .mobile-panel {
          opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0);
          transition: opacity var(--duration-base) var(--ease-out), transform var(--duration-slow) var(--ease-out), visibility 0s;
        }
        .mobile-panel nav { display: flex; flex-direction: column; }

        .mobile-link {
          display: flex; align-items: center; justify-content: space-between;
          min-height: 52px; padding: 12px 0;
          border: 0;
          color: var(--color-text-secondary); font-family: var(--font-body); font-size: 15px;
          font-weight: 600; letter-spacing: .01em; line-height: 1.35;
          text-transform: none; text-decoration: none; opacity: 0;
          transform: translateY(14px);
          transition: color var(--duration-fast) var(--ease-out), opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out);
          transition-delay: 0ms; -webkit-tap-highlight-color: transparent;
        }
        .mobile-nav.is-open .mobile-link {
          opacity: 1; transform: translateY(0);
          transition-delay: calc(70ms + (var(--menu-index) * 48ms));
        }
        .mobile-link:active { color: var(--color-text-primary); }
        .mobile-logout { min-height:58px; padding:14px 0; border:0; background:transparent; color:var(--color-accent); text-align:left; font:inherit; font-family:var(--font-body); font-size:14px; font-weight:600; letter-spacing:.01em; text-transform:none; cursor:pointer; }
        .mobile-link[aria-current="page"] { color: var(--color-text-primary); }
        .mobile-link[aria-current="page"]::after { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--color-accent); }
        .mobile-link--secret i {
          color: #c2ae91;
          font-family: Georgia,serif;
          font-size: 17px;
          font-style: normal;
          margin-left: 8px;
        }

        .mobile-nav--ghibli .mobile-toggle { color: #19362f; }
        .mobile-nav--ghibli .mobile-backdrop { background: rgba(25,54,47,.16); }
        .mobile-nav--ghibli .mobile-panel { background: #fffdf8; color: #19362f; }
        .mobile-nav--ghibli .mobile-link { color: #527066; }
        .mobile-nav--ghibli .mobile-logout { color:#c43c55; }
        .mobile-nav--ghibli .mobile-link:active { color: #18528a; }
        .mobile-nav--ghibli .mobile-link[aria-current="page"] { color: #18528a; }
        .mobile-nav--ghibli .mobile-link[aria-current="page"]::after { background: #f45164; }
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
