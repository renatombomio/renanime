import { useEffect, useState } from "react";
import { useT, type Lang } from "../../i18n";
import {
  addToPersonalList,
  getPersonalEntry,
  markPersonalWatched,
  removeFromPersonalLibrary,
  subscribeToPersonalLibrary,
  hydratePersonalLibrary,
} from "../../data/personal-library";

interface Props {
  animeId: number | string;
  lang?: Lang;
}

export default function PersonalLibraryActions({ animeId, lang = "es" }: Props) {
  const t = useT(lang);
  const id = String(animeId);
  const [status, setStatus] = useState(() => getPersonalEntry(id)?.state.status ?? "NOT_IN_COLLECTION");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch { setError(lang === "en" ? "Could not save your library changes. Try again." : "No se pudieron guardar los cambios. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    let active = true;
    const sync = () => setStatus(getPersonalEntry(id)?.state.status ?? "NOT_IN_COLLECTION");

    void hydratePersonalLibrary().then(() => {
      if (!active) return;
      sync();
      setReady(true);
    });

    const unsubscribe = subscribeToPersonalLibrary(sync);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  if (!ready) {
    return (
      <div className="personal-actions">
        <span className="personal-status" role="status" aria-live="polite">{t("actions.loading")}</span>
        {error && <span className="personal-error" role="alert">{error}</span>}
        {error && <span className="personal-error" role="alert">{error}</span>}
        <style>{styles}</style>
      </div>
    );
  }

  if (status === "WATCHED") {
    return (
      <div className="personal-actions">
        <span className="personal-status">{t("actions.watched")}</span>
        <button type="button" disabled={busy} onClick={() => void run(() => removeFromPersonalLibrary(id))}>
          {t("actions.remove")}
        </button>
        <style>{styles}</style>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="personal-actions">
        <button type="button" className="is-active" disabled={busy} onClick={() => void run(() => markPersonalWatched(id))}>
          {t("actions.markWatched")}
        </button>
        <button type="button" disabled={busy} onClick={() => void run(() => removeFromPersonalLibrary(id))}>
          {t("actions.removeFromList")}
        </button>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="personal-actions">
      <button type="button" disabled={busy} onClick={() => void run(() => addToPersonalList(id))}>
        {t("actions.add")}
      </button>
      <button type="button" disabled={busy} onClick={() => void run(() => markPersonalWatched(id))}>
        ✓ {lang === "en" ? "I have watched it" : "Ya lo he visto"}
      </button>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.personal-actions{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.9rem}
.personal-actions button,.personal-status{min-height:2.25rem;padding:.55rem .75rem;border:1px solid var(--color-border);background:transparent;color:var(--color-paper-50);font-family:var(--font-meta);font-size:.52rem;letter-spacing:.06em;text-transform:uppercase}
.personal-actions button{cursor:pointer;transition:background 180ms ease,color 180ms ease,border-color 180ms ease,transform 180ms ease}
.personal-actions button:disabled{cursor:wait;opacity:.55}.personal-error{flex-basis:100%;color:#f3a4b5;font-size:.72rem;line-height:1.4}.personal-actions button:hover,.personal-actions button.is-active{background:var(--color-paper-50);color:var(--color-ink-950)}
.personal-actions button:hover{transform:translateY(-1px)}
.personal-actions button:focus-visible{outline:1px solid var(--color-paper-50);outline-offset:3px}
.personal-status{display:inline-flex;align-items:center;color:var(--color-paper-200)}
@media (prefers-reduced-motion:reduce){.personal-actions button{transition:none}.personal-actions button:hover{transform:none}}
`;
