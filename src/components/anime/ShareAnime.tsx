import { useState } from "react";
import type { Lang } from "../../i18n";

interface ShareAnimeProps {
  title: string;
  animeId: number;
  lang: Lang;
}

export default function ShareAnime({ title, animeId, lang }: ShareAnimeProps) {
  const [notice, setNotice] = useState("");
  const isEnglish = lang === "en";
  const url = typeof window !== "undefined"
    ? new URL((isEnglish ? "/en" : "") + "/anime/" + animeId, window.location.origin).toString()
    : "";
  const message = isEnglish
    ? `Take a look at ${title} on Renanime World: ${url}`
    : `Mira este anime en Renanime World: ${title} — ${url}`;

  async function shareNative() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${title} — Renanime World`, text: message, url });
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
    } catch {
      setNotice(isEnglish ? "Could not copy the link." : "No se pudo copiar el enlace.");
    }
  }

  const whatsappUrl = "https://wa.me/?text=" + encodeURIComponent(message);

  return <div className="anime-detail-share-wrap">
    <div className="anime-detail-share-actions" aria-label={isEnglish ? "Share anime" : "Compartir anime"}>
      <button type="button" className="anime-detail-share-button" onClick={shareNative}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
        <span>{isEnglish ? "Share" : "Compartir"}</span>
      </button>
      <a className="anime-detail-share-button" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.1A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8.5 8.2c.3-.6.6-.6.9-.6h.4c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .7.5.8 1.1 1.4 1.9 1.8.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.2.1.4.3.4.5 0 .4-.2 1.1-.7 1.5-.5.5-1.2.7-2 .5-1.1-.3-2.4-1-3.6-2.1-1-.9-1.8-2.1-2-3.1-.2-.8.1-1.4.7-2.1Z"/></svg>
        <span>WhatsApp</span>
      </a>
      <button type="button" className="anime-detail-share-button" onClick={shareNative}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>
        <span>Instagram</span>
      </button>
      <button type="button" className="anime-detail-share-copy" onClick={copyLink} aria-label={isEnglish ? "Copy link" : "Copiar enlace"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>
    {notice && <p className="anime-detail-share-notice" role="status">{notice}</p>}
    <style>{`
      .anime-detail-share-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem}
      .anime-detail-share-button,.anime-detail-share-copy{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:34px;padding:.4rem .65rem;border:1px solid rgba(245,242,236,.17);border-radius:999px;background:rgba(245,242,236,.045);color:var(--color-paper-200);font:inherit;font-size:.65rem;text-decoration:none;cursor:pointer}
      .anime-detail-share-button svg,.anime-detail-share-copy svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .anime-detail-share-button:hover,.anime-detail-share-copy:hover{background:rgba(245,242,236,.1);border-color:rgba(245,242,236,.32)}
      .anime-detail-share-copy{width:34px;padding:0}
      .anime-detail-share-notice{margin:.4rem 0 0;color:var(--color-muted-400);font-size:.65rem}
    `}</style>
  </div>;
}
