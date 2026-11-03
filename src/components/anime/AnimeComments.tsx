import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Lang } from "../../i18n";

type CommentProfile = {
  name?: string | null;
  aka?: string | null;
  avatar_url?: string | null;
};

type CommentReaction = { id: string; comment_id: string; user_id: string; emoji: string; profiles?: { name?: string | null; aka?: string | null } | null };

type AnimeComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_comment_id?: string | null;
  profiles?: CommentProfile | CommentProfile[] | null;
};

export default function AnimeComments({ animeId, lang = "es" }: { animeId: number; lang?: Lang }) {
  const [comments, setComments] = useState<AnimeComment[]>([]);
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const en = lang === "en";
  const copy = (es: string, english: string) => en ? english : es;

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/anime/comments?animeId=" + animeId, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error("comments_unavailable");
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
      setReactions(Array.isArray(payload.reactions) ? payload.reactions : []);
      setViewerId(payload.viewerId ?? null);
    } catch {
      setNotice(copy("No se pudieron cargar los comentarios.", "Could not load comments."));
    } finally {
      setLoading(false);
    }
  }, [animeId, en]);

  useEffect(() => { void loadComments(); }, [loadComments]);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/anime/comments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, content: value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setNotice(copy("Inicia sesión para comentar.", "Sign in to leave a comment."));
        return;
      }
      if (!response.ok || !payload.ok) throw new Error("comment_create_failed");
      setContent("");
      await loadComments();
    } catch {
      setNotice(copy("No se pudo publicar el comentario.", "Could not publish the comment."));
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = replyContent.trim();
    if (!replyToId || !value || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/anime/comments", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, parentCommentId: replyToId, content: value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error("comment_reply_failed");
      setReplyContent("");
      setReplyToId(null);
      await loadComments();
    } catch {
      setNotice(copy("No se pudo publicar la respuesta.", "Could not post the reply."));
    } finally {
      setBusy(false);
    }
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!viewerId || busy) {
      setNotice(copy("Inicia sesión para reaccionar.", "Sign in to react."));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/anime/comment-reactions", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, emoji }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error("reaction_failed");
      await loadComments();
    } catch {
      setNotice(copy("No se pudo guardar la reacción.", "Could not save the reaction."));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: string) => {
    const value = editContent.trim();
    if (!value || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/anime/comments", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content: value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error("comment_update_failed");
      setEditingId(null);
      await loadComments();
    } catch {
      setNotice(copy("No se pudo editar el comentario.", "Could not edit the comment."));
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (busy || !window.confirm(copy("¿Eliminar este comentario?", "Delete this comment?"))) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/anime/comments", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error("comment_delete_failed");
      await loadComments();
    } catch {
      setNotice(copy("No se pudo eliminar el comentario.", "Could not delete the comment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="anime-comments" aria-labelledby="anime-comments-title">
      <style>{`
        .anime-comments{grid-column:1/-1;width:100%;max-width:58rem;margin:2rem 0 0}
        .anime-comments-head{display:flex;align-items:baseline;gap:.55rem;margin-bottom:1rem;padding-bottom:.7rem;border-bottom:1px solid rgba(245,242,236,.13)}
        .anime-comments-head h2{margin:0;font-size:1.1rem;font-weight:550}
        .anime-comments-total{color:#999;font-size:.72rem}
        .anime-comments-form{display:grid;gap:.65rem;margin-bottom:1.5rem}
        .anime-comments-form textarea,.anime-comment-edit textarea{width:100%;min-height:82px;resize:vertical;border:1px solid rgba(245,242,236,.17);border-radius:10px;background:#080808;color:#f5f2ec;padding:.8rem .9rem;font:inherit;font-size:.85rem;line-height:1.5}
        .anime-comments-form textarea:focus,.anime-comment-edit textarea:focus{outline:1px solid rgba(236,72,153,.7);border-color:rgba(236,72,153,.55)}
        .anime-comments-form button,.anime-comment-actions button,.anime-comment-edit button{justify-self:start;border:1px solid rgba(245,242,236,.2);border-radius:999px;background:transparent;color:#f5f2ec;padding:.48rem .85rem;font:inherit;font-size:.72rem;cursor:pointer}
        .anime-comments-form button[type=submit]{border-color:#ec4899;background:#ec4899;color:#fff;font-weight:600}
        .anime-comments-form button:disabled,.anime-comment-actions button:disabled,.anime-comment-edit button:disabled{opacity:.5;cursor:wait}
        .anime-comments-list{display:grid;gap:1.15rem}
        .anime-comment{display:grid;grid-template-columns:36px minmax(0,1fr);gap:.7rem;min-width:0}
        .anime-comment-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;background:#171717}
        .anime-comment-avatar-fallback{display:grid;place-items:center;color:#aaa;font-size:.75rem}
        .anime-comment-body{min-width:0}
        .anime-comment-author{display:flex;align-items:baseline;flex-wrap:wrap;gap:.4rem;margin-bottom:.3rem}
        .anime-comment-author strong{font-size:.76rem;font-weight:650}
        .anime-comment-author span,.anime-comment-date{color:#858585;font-size:.65rem}
        .anime-comment-body>p{margin:0;color:#d4d4d4;font-size:.82rem;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
        .anime-comment-actions{display:flex;gap:.45rem;margin-top:.5rem}
        .anime-comment-social{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem;margin-top:.55rem}
        .anime-comment-social button{border:1px solid rgba(245,242,236,.15);border-radius:999px;background:transparent;color:#aaa;padding:.22rem .48rem;font:inherit;font-size:.65rem;cursor:pointer}
        .anime-comment-social button.active{border-color:rgba(236,72,153,.65);color:#f9a8d4;background:rgba(236,72,153,.08)}
        .anime-comment-reply-form{display:grid;gap:.4rem;margin-top:.6rem}
        .anime-comment-reply-form textarea{width:100%;min-height:58px;border:1px solid rgba(245,242,236,.15);border-radius:8px;background:#080808;color:#f5f2ec;padding:.55rem;font:inherit;font-size:.75rem}
        .anime-comment-replies{display:grid;gap:.75rem;margin:.85rem 0 0 1rem;padding-left:.75rem;border-left:1px solid rgba(245,242,236,.12)}
        .anime-comment-reply{display:grid;grid-template-columns:26px minmax(0,1fr);gap:.5rem}
        .anime-comment-reply .anime-comment-avatar{width:26px;height:26px}
        .anime-comment-reply p{margin:0;color:#bbb;font-size:.75rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
        .anime-comment-actions button{padding:.25rem .55rem;color:#999;font-size:.64rem}
        .anime-comment-edit{display:grid;gap:.5rem}
        .anime-comment-edit textarea{min-height:70px}
        .anime-comment-edit>div{display:flex;gap:.45rem}
        .anime-comments-empty,.anime-comments-loading{color:#888;font-size:.78rem}
        .anime-comments-more{margin-top:1.1rem;border:1px solid rgba(245,242,236,.2);border-radius:999px;background:transparent;color:#c7c7c7;padding:.5rem .9rem;font:inherit;font-size:.72rem;cursor:pointer;transition:border-color .2s,color .2s}
        .anime-comments-more:hover{border-color:rgba(236,72,153,.65);color:#fff}
        .anime-comments-notice{margin:.2rem 0;color:#f3a3bd;font-size:.72rem}
        @media(max-width:760px){.anime-comments{margin-top:1.5rem}.anime-comments-head h2{font-size:1rem}}
      `}</style>
      <div className="anime-comments-head">
        <h2 id="anime-comments-title">{copy("Comentarios", "Comments")}</h2>
        <span className="anime-comments-total">{comments.length}</span>
      </div>
      <form className="anime-comments-form" onSubmit={submitComment}>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={1000}
          placeholder={viewerId ? copy("Comparte tu opinión sobre este anime…", "Share your thoughts about this anime…") : copy("Inicia sesión para participar en la conversación.", "Sign in to join the conversation.")}
          aria-label={copy("Escribe un comentario", "Write a comment")}
        />
        <button type="submit" disabled={busy || !content.trim()}>
          {busy ? copy("Enviando…", "Posting…") : copy("Publicar comentario", "Post comment")}
        </button>
      </form>
      {notice && <p className="anime-comments-notice" role="status">{notice}</p>}
      {loading ? <p className="anime-comments-loading">{copy("Cargando comentarios…", "Loading comments…")}</p> : comments.length === 0 ? (
        <p className="anime-comments-empty">{copy("Todavía no hay comentarios. Abre la conversación.", "No comments yet. Start the conversation.")}</p>
      ) : (
        <div className="anime-comments-list">
          {comments.filter(comment => !comment.parent_comment_id).slice(0, showAllComments ? comments.filter(comment => !comment.parent_comment_id).length : 5).map((comment) => {
            const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
            const author = profile?.name || (profile?.aka ? "@" + profile.aka : copy("Usuario", "User"));
            const own = Boolean(viewerId && viewerId === comment.user_id);
            const commentReactions = reactions.filter(reaction => reaction.comment_id === comment.id);
            const reactionCounts = new Map<string, number>();
            commentReactions.forEach(reaction => reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) || 0) + 1));
            const replies = comments.filter(reply => reply.parent_comment_id === comment.id);
            return (
              <article className="anime-comment" key={comment.id} id={"comment-" + comment.id}>
                {profile?.avatar_url ? <img className="anime-comment-avatar" src={profile.avatar_url} alt="" loading="lazy" /> : (
                  <span className="anime-comment-avatar anime-comment-avatar-fallback" aria-hidden="true">{author.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="anime-comment-body">
                  <div className="anime-comment-author">
                    <strong>{author}</strong>
                    {profile?.aka && profile.name && <span>@{profile.aka}</span>}
                    <time className="anime-comment-date" dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString(en ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric" })}</time>
                  </div>
                  {editingId === comment.id ? (
                    <div className="anime-comment-edit">
                      <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={1000} />
                      <div>
                        <button type="button" disabled={busy || !editContent.trim()} onClick={() => void saveEdit(comment.id)}>{copy("Guardar", "Save")}</button>
                        <button type="button" disabled={busy} onClick={() => setEditingId(null)}>{copy("Cancelar", "Cancel")}</button>
                      </div>
                    </div>
                  ) : <p>{comment.content}</p>}
                  <div className="anime-comment-social">
                    {["❤️","😂","🔥","😭","👏","😮","👍"].map(emoji => {
                      const count = reactionCounts.get(emoji) || 0;
                      const active = commentReactions.some(reaction => reaction.user_id === viewerId && reaction.emoji === emoji);
                      return <button key={emoji} type="button" className={active ? "active" : ""} disabled={busy} aria-label={copy("Reaccionar con " + emoji, "React with " + emoji)} onClick={() => void toggleReaction(comment.id, emoji)}>{emoji}{count > 0 ? " " + count : ""}</button>;
                    })}
                    {viewerId && <button type="button" disabled={busy} onClick={() => { setReplyToId(replyToId === comment.id ? null : comment.id); setReplyContent(""); }}>{copy("Responder", "Reply")}</button>}
                  </div>
                  {replyToId === comment.id && <form className="anime-comment-reply-form" onSubmit={submitReply}>
                    <textarea value={replyContent} onChange={event => setReplyContent(event.target.value)} maxLength={1000} placeholder={copy("Escribe tu respuesta…", "Write your reply…")} />
                    <div className="anime-comment-actions"><button type="submit" disabled={busy || !replyContent.trim()}>{copy("Enviar respuesta", "Post reply")}</button><button type="button" onClick={() => setReplyToId(null)}>{copy("Cancelar", "Cancel")}</button></div>
                  </form>}
                  {own && editingId !== comment.id && (
                    <div className="anime-comment-actions">
                      <button type="button" disabled={busy} onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}>{copy("Editar", "Edit")}</button>
                      <button type="button" disabled={busy} onClick={() => void deleteComment(comment.id)}>{copy("Eliminar", "Delete")}</button>
                    </div>
                  )}
                  {replies.length > 0 && <div className="anime-comment-replies">
                    {replies.map(reply => {
                      const replyProfile = Array.isArray(reply.profiles) ? reply.profiles[0] : reply.profiles;
                      const replyAuthor = replyProfile?.name || (replyProfile?.aka ? "@" + replyProfile.aka : copy("Usuario", "User"));
                      return <div className="anime-comment-reply" key={reply.id} id={"comment-" + reply.id}>
                        {replyProfile?.avatar_url ? <img className="anime-comment-avatar" src={replyProfile.avatar_url} alt="" loading="lazy" /> : <span className="anime-comment-avatar anime-comment-avatar-fallback">{replyAuthor.slice(0,1).toUpperCase()}</span>}
                        <div><div className="anime-comment-author"><strong>{replyAuthor}</strong><time className="anime-comment-date" dateTime={reply.created_at}>{new Date(reply.created_at).toLocaleDateString(en ? "en-GB" : "es-ES",{day:"numeric",month:"short",year:"numeric"})}</time></div><p>{reply.content}</p></div>
                      </div>;
                    })}
                  </div>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && comments.filter(comment => !comment.parent_comment_id).length > 5 && (
        <button
          type="button"
          className="anime-comments-more"
          onClick={() => setShowAllComments((current) => !current)}
        >
          {showAllComments ? copy("Ver menos comentarios", "Show fewer comments") : copy("Ver más comentarios", "View more comments")}
        </button>
      )}
    </section>
  );
}
