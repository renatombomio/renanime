import { useEffect, useState } from "react";
import type { Lang } from "../../i18n";

interface ShareAnimeProps {
  title: string;
  animeId: number;
  lang: Lang;
}

export default function ShareAnime({ title, animeId, lang }: ShareAnimeProps) {
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [url, setUrl] = useState("");
  const isEnglish = lang === "en";
  useEffect(() => {
    setUrl(new URL((isEnglish ? "/en" : "") + "/anime/" + animeId, window.location.origin).toString());
  }, [animeId, isEnglish]);
  const message = isEnglish
    ? `Take a look at ${title} on Renanime World: ${url}`
    : `Mira este anime en Renanime World: ${title} — ${url}`;

  async function shareNative() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${title} — Renanime World`, text: message, url });
        setMenuOpen(false);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") setNotice(isEnglish ? "Could not open sharing." : "No se pudo abrir el menú para compartir.");
      }
      return;
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice(isEnglish ? "Message and link copied." : "Mensaje y enlace copiados.");
      setMenuOpen(false);
    } catch {
      setNotice(isEnglish ? "Could not copy the link." : "No se pudo copiar el enlace.");
    }
  }

  const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(message);

  return <div className="anime-detail-share-wrap">
    <button type="button" className="anime-detail-share-button" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen((open) => !open)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
      <span>{isEnglish ? "Share" : "Compartir"}</span>
    </button>
    {menuOpen && <div className="anime-detail-share-menu" role="group" aria-label={isEnglish ? "Sharing options" : "Opciones para compartir"}>
      <a className="anime-detail-share-option" href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>WhatsApp</a>
      <button type="button" className="anime-detail-share-option" onClick={shareNative}>Instagram</button>
      <button type="button" className="anime-detail-share-option" onClick={copyLink}>{isEnglish ? "Copy link" : "Copiar enlace"}</button>
    </div>}
    {notice && <p className="anime-detail-share-notice" role="status">{notice}</p>}
    <style>{`
      .anime-detail-share-wrap{position:relative;display:inline-flex;flex-direction:column;align-items:flex-start}
      .anime-detail-share-button,.anime-detail-share-option{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:34px;padding:.4rem .65rem;border:1px solid rgba(245,242,236,.17);border-radius:999px;background:rgba(245,242,236,.045);color:var(--color-paper-200);font:inherit;font-size:.65rem;text-decoration:none;cursor:pointer}
      .anime-detail-share-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .anime-detail-share-button:hover,.anime-detail-share-option:hover{background:rgba(245,242,236,.1);border-color:rgba(245,242,236,.32)}
      .anime-detail-share-menu{position:absolute;z-index:20;top:calc(100% + .45rem);left:0;min-width:158px;padding:.3rem;border:1px solid rgba(245,242,236,.16);border-radius:12px;background:#171513;box-shadow:0 10px 30px rgba(0,0,0,.35);display:grid;gap:.15rem}
      .anime-detail-share-option{width:100%;justify-content:flex-start;border:0;border-radius:7px;background:transparent;text-align:left}
      .anime-detail-share-notice{margin:.4rem 0 0;color:var(--color-muted-400);font-size:.65rem}
    `}</style>
  </div>;
}
