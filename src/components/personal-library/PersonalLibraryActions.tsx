import { useEffect, useState } from "react";
import {
  addToPersonalList,
  getPersonalEntry,
  markPersonalWatched,
  removeFromPersonalLibrary,
  subscribeToPersonalLibrary,
} from "../../data/personal-library";

interface Props {
  animeId: number;
}

export default function PersonalLibraryActions({ animeId }: Props) {
  const id = String(animeId);
  const [status, setStatus] = useState(() => getPersonalEntry(id)?.state.status ?? "NOT_IN_COLLECTION");

  useEffect(() => {
    const sync = () => setStatus(getPersonalEntry(id)?.state.status ?? "NOT_IN_COLLECTION");
    sync();
    return subscribeToPersonalLibrary(sync);
  }, [id]);

  if (status === "WATCHED") {
    return (
      <div className="personal-actions">
        <span className="personal-status">✓ Ya lo has visto</span>
        <button type="button" onClick={() => removeFromPersonalLibrary(id)}>
          Quitar
        </button>
        <style>{styles}</style>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="personal-actions">
        <button type="button" className="is-active" onClick={() => markPersonalWatched(id)}>
          ✓ Ya lo he visto
        </button>
        <button type="button" onClick={() => removeFromPersonalLibrary(id)}>
          Quitar de mi lista
        </button>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="personal-actions">
      <button type="button" onClick={() => addToPersonalList(id)}>
        ＋ Añadir a mi lista
      </button>
      <button type="button" onClick={() => markPersonalWatched(id)}>
        ✓ Ya lo he visto
      </button>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
.personal-actions{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.9rem}
.personal-actions button,.personal-status{min-height:2.25rem;padding:.55rem .75rem;border:1px solid var(--color-border);background:transparent;color:var(--color-paper-50);font-family:var(--font-meta);font-size:.52rem;letter-spacing:.06em;text-transform:uppercase}
.personal-actions button{cursor:pointer}
.personal-actions button:hover,.personal-actions button.is-active{background:var(--color-paper-50);color:var(--color-ink-950)}
.personal-status{display:inline-flex;align-items:center;color:var(--color-paper-200)}
`;
