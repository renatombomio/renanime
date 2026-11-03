import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../../i18n";

type Notice = {
  id: string;
  actor_id: string;
  comment_id: string;
  type: "comment_reply" | "comment_reaction";
  emoji: string | null;
  is_read: boolean;
  created_at: string;
  profiles?: { name?: string | null; aka?: string | null; avatar_url?: string | null } | Array<{ name?: string | null; aka?: string | null; avatar_url?: string | null }> | null;
  anime_comments?: { anime_id?: number; content?: string } | Array<{ anime_id?: number; content?: string }> | null;
};

export default function NotificationBell({ lang = "es" }: { lang?: Lang }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const en = lang === "en";
  const copy = (es: string, english: string) => en ? english : es;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) return;
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnread(Number(payload.unreadCount) || 0);
    } catch {
      // Keep the bell usable if notifications are temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems(current => current.map(item => item.id === id ? { ...item, is_read: true } : item));
    setUnread(current => Math.max(0, current - (items.some(item => item.id === id && !item.is_read) ? 1 : 0)));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems(current => current.map(item => ({ ...item, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="notification-bell-wrap">
      <style>{`
        .notification-bell-wrap{position:relative;flex:0 0 auto;margin-left:1rem}
        .notification-bell-trigger{position:relative;display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(245,242,236,.2);border-radius:50%;background:transparent;color:#f5f2ec;cursor:pointer}
        .notification-bell-trigger svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        .notification-bell-count{position:absolute;top:-4px;right:-5px;min-width:17px;height:17px;padding:0 4px;display:grid;place-items:center;border-radius:99px;background:#ec4899;color:#fff;font-size:10px;font-weight:700}
        .notification-panel{position:absolute;top:calc(100% + 12px);right:0;z-index:80;width:min(360px,calc(100vw - 28px));max-height: min(480px,calc(100vh - 100px));overflow:auto;border:1px solid rgba(245,242,236,.14);border-radius:14px;background:#0b0b0b;box-shadow:0 16px 50px rgba(0,0,0,.5);color:#f5f2ec}
        .notification-panel-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
        .notification-panel-head strong{font-size:13px}
        .notification-panel-head button{border:0;background:none;color:#ec4899;font-size:11px;cursor:pointer}
        .notification-item{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.07);text-decoration:none;color:inherit}
        .notification-item.unread{background:rgba(236,72,153,.07)}
        .notification-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;object-fit:cover;background:#222}
        .notification-copy{min-width:0;display:grid;gap:4px}
        .notification-copy p{margin:0;font-size:11px;line-height:1.45;color:#ddd}
        .notification-copy small{font-size:10px;color:#777}
        .notification-empty{padding:24px 16px;color:#888;font-size:12px;text-align:center}
        @media(max-width:1120px){.notification-bell-wrap{margin:0 .5rem 0 auto}.notification-panel{right:-54px}}
      `}</style>
      <button type="button" className="notification-bell-trigger" aria-label={copy("Notificaciones","Notifications")} aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) void load(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        {unread > 0 && <span className="notification-bell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <div className="notification-panel" role="dialog" aria-label={copy("Notificaciones","Notifications")}>
        <div className="notification-panel-head"><strong>{copy("Notificaciones","Notifications")}</strong>{unread > 0 && <button type="button" onClick={() => void markAllRead()}>{copy("Marcar todo leído","Mark all as read")}</button>}</div>
        {loading && items.length === 0 ? <p className="notification-empty">{copy("Cargando…","Loading…")}</p> : items.length === 0 ? <p className="notification-empty">{copy("No tienes notificaciones todavía.","No notifications yet.")}</p> : items.map(item => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          const comment = Array.isArray(item.anime_comments) ? item.anime_comments[0] : item.anime_comments;
          const actor = profile?.name || (profile?.aka ? "@" + profile.aka : copy("Alguien","Someone"));
          const text = item.type === "comment_reply"
            ? copy("ha respondido a tu comentario","replied to your comment")
            : copy(`ha reaccionado ${item.emoji || ""} a tu comentario`, `reacted ${item.emoji || ""} to your comment`);
          const href = (en ? "/en" : "") + "/anime/" + (comment?.anime_id || "") + "#comment-" + item.comment_id;
          return <a key={item.id} className={"notification-item" + (!item.is_read ? " unread" : "")} href={href} onClick={() => { void markRead(item.id); setOpen(false); }}>
            {profile?.avatar_url ? <img className="notification-avatar" src={profile.avatar_url} alt="" /> : <span className="notification-avatar" />}
            <span className="notification-copy"><p><strong>{actor}</strong> {text}</p><small>{new Date(item.created_at).toLocaleDateString(en ? "en-GB" : "es-ES",{day:"numeric",month:"short",year:"numeric"})}</small></span>
          </a>;
        })}
      </div>}
    </div>
  );
}
