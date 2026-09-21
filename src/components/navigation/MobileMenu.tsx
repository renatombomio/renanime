import { useState } from "react";

const links = [
  { label: "Inicio", href: "/" },
  { label: "Favoritos", href: "/#favorites" },
  { label: "Colección", href: "/collection/" },
  { label: "Géneros", href: "/#genres" },
  { label: "Buscar", href: "/search/" },
  { label: "Pendientes", href: "/pending/" },
  { label: "Próximamente", href: "/coming-soon/" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-nav">
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

      {open && (
        <div className="mobile-panel" id="mobile-navigation">
          <nav aria-label="Navegación móvil">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

.mobile-nav { position: relative; }
.mobile-toggle {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-content: center;
  gap: 0.28rem;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-paper-50);
  cursor: pointer;
}
.mobile-toggle span {
  display: block;
  width: 0.85rem;
  height: 1px;
  background: currentColor;
}
.mobile-panel {
  position: fixed;
  top: 4.25rem;
  right: var(--gutter);
  left: var(--gutter);
  z-index: var(--z-overlay);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  background: rgba(9, 9, 9, 0.97);
  box-shadow: var(--shadow-deep);
}
.mobile-panel nav { display: grid; gap: 1rem; }
.mobile-panel a {
  color: var(--color-paper-200);
  font-family: var(--font-meta);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.mobile-panel a:hover { color: var(--color-accent-soft); }
