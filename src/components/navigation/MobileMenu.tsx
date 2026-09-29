import { useEffect, useState } from "react";

interface Props { variant?: "default" | "ghibli"; }\n\nconst links = [
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
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={"mobile-nav" + (variant === "ghibli" ? " mobile-nav--ghibli" : "")}>
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
