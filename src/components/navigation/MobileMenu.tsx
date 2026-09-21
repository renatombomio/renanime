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
