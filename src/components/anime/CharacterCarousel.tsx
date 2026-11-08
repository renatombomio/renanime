import { useEffect, useState } from "react";
import type { Lang } from "../../i18n";

type Character = { id: number; name: string; image_url: string | null; role: string | null; count: number; liked: boolean };

export default function CharacterCarousel({ animeId, lang = "es" }: { animeId: number; lang?: Lang }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const en = lang === "en";

  async function loadPage(nextPage: number) {
    const response = await fetch(`/api/anime/${animeId}/characters?page=${nextPage}`, { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error("characters_unavailable");
    setCharacters((current) => {
      const merged = new Map(current.map((item) => [item.id, item]));
      for (const item of payload.characters as Character[]) merged.set(item.id, item);
      return [...merged.values()];
    });
    setPage(nextPage);
    setHasNextPage(Boolean(payload.hasNextPage));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/anime/${animeId}/characters?page=1`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error("characters_unavailable");
        if (cancelled) return;
        setCharacters(payload.characters ?? []);
        setPage(1);
        setHasNextPage(Boolean(payload.hasNextPage));
      })
      .catch(() => { if (!cancelled) setNotice(en ? "Characters could not be loaded." : "No se pudieron cargar los personajes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [animeId, en]);

  async function toggleLike(character: Character) {
    if (busyIds.includes(character.id)) return;
    setBusyIds((ids) => [...ids, character.id]);
    setNotice("");
    try {
      const response = await fetch(`/api/characters/${character.id}/like`, { method: "POST", credentials: "same-origin" });
      const payload = await response.json();
      if (response.status === 401) { setNotice(en ? "Sign in to like characters." : "Inicia sesión para dar like a personajes."); return; }
      if (!response.ok || !payload.ok) throw new Error("like_failed");
      setCharacters((items) => items.map((item) => item.id === character.id ? { ...item, liked: payload.liked, count: payload.count } : item));
    } catch {
      setNotice(en ? "Could not update this like. Try again." : "No se pudo actualizar el like. Inténtalo de nuevo.");
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== character.id));
    }
  }

  async function loadMore() {
    if (!hasNextPage || loadingMore) return;
    setLoadingMore(true);
    try { await loadPage(page + 1); }
    catch { setNotice(en ? "Could not load more characters." : "No se pudieron cargar más personajes."); }
    finally { setLoadingMore(false); }
  }

  if (loading && !characters.length) return <section className="anime-detail-characters"><span className="anime-detail-label">{en ? "Characters" : "Personajes"}</span><p className="character-loading">{en ? "Loading characters…" : "Cargando personajes…"}</p></section>;
  if (!characters.length && !notice) return null;

  return <section className="anime-detail-characters" aria-label={en ? "Characters" : "Personajes"}>
    <div className="anime-detail-recommendations-head">
      <span className="anime-detail-label">{en ? "Characters" : "Personajes"}</span>
      {characters.length > 0 && <span className="character-total">{characters.length}{hasNextPage ? "+" : ""}</span>}
    </div>
    {characters.length > 0 && <div className="anime-detail-characters-track">
      {characters.map((character) => <article className="anime-detail-character" key={character.id}>
        <div className="anime-detail-character-image">
          {character.image_url && <img src={character.image_url} alt={character.name} loading="lazy" />}
          <button type="button" className={"anime-character-like" + (character.liked ? " is-liked" : "")} onClick={() => toggleLike(character)} disabled={busyIds.includes(character.id)} aria-pressed={character.liked} aria-label={character.liked ? (en ? "Unlike character" : "Quitar like al personaje") : (en ? "Like character" : "Dar like al personaje")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11S3.2 14 3.2 8.8a4.5 4.5 0 0 1 8.8-1.1 4.5 4.5 0 0 1 8.8 1.1Z"/></svg>
            <span>{character.count.toLocaleString(en ? "en" : "es")}</span>
          </button>
        </div>
        <strong className="anime-detail-character-name">{character.name}</strong>
        <span className="anime-detail-character-role">{character.role === "MAIN" ? (en ? "Main character" : "Principal") : (en ? "Supporting" : "Secundario")}</span>
      </article>)}
    </div>}
    {hasNextPage && <button type="button" className="anime-character-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? (en ? "Loading…" : "Cargando…") : (en ? "Load more characters" : "Cargar más personajes")}</button>}
    {notice && <p className="anime-character-notice" role="status">{notice}</p>}
    <style>{`
      .anime-detail-character-image{position:relative}
      .anime-character-like{position:absolute;right:.35rem;bottom:.35rem;display:inline-flex;align-items:center;gap:.25rem;padding:.3rem .4rem;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(0,0,0,.78);color:#fff;font:inherit;font-size:.58rem;cursor:pointer}
      .anime-character-like svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8}
      .anime-character-like.is-liked{color:#ff4f91;border-color:rgba(255,79,145,.55)}
      .anime-character-like.is-liked svg{fill:currentColor}
      .anime-character-like:disabled{opacity:.5}
      .anime-character-load-more{margin-top:.5rem;padding:.5rem .8rem;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:transparent;color:var(--color-paper-100);font:inherit;font-size:.68rem;cursor:pointer}
      .anime-character-load-more:disabled{opacity:.5}
      .anime-character-notice,.character-loading{margin:.5rem 0;color:var(--color-muted-400);font-size:.68rem}
      .character-total{margin-left:.5rem;color:var(--color-muted-400);font-size:.62rem}
    `}</style>
  </section>;
}
