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
        .notification-bell-trigger{position:relative;display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--color-border-strong);border-radius:50%;background:transparent;color:var(--color-text-primary);cursor:pointer;transition:border-color var(--duration-fast) var(--ease-out),color var(--duration-fast) var(--ease-out)}
        .notification-bell-trigger:hover,.notification-bell-trigger:focus-visible{border-color:var(--color-border-accent);color:var(--color-accent)}
        .notification-bell-trigger:focus-visible{outline:2px solid var(--color-focus);outline-offset:3px}
        .notification-bell-trigger svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        .notification-bell-count{position:absolute;top:-4px;right:-5px;min-width:17px;height:17px;padding:0 4px;display:grid;place-items:center;border-radius:var(--radius-pill);background:var(--color-accent);color:#fff;font-size:10px;font-weight:700}
        .notification-panel{position:absolute;top:calc(100% + 12px);right:0;z-index:80;width:min(360px,calc(100vw - 28px));max-height:min(480px,calc(100vh - 100px));overflow:auto;border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-background);box-shadow:var(--shadow-overlay);color:var(--color-text-primary)}
        .notification-panel-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--color-border)}
        .notification-panel-head strong{font-size:13px}
        .notification-panel-head button{border:0;background:none;color:var(--color-accent);font-size:11px;cursor:pointer}
        .notification-panel-head button:hover,.notification-panel-head button:focus-visible{color:var(--color-accent-soft)}
        .notification-item{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--color-border);text-decoration:none;color:inherit}
        .notification-item:hover{background:var(--color-surface-hover)}
        .notification-item.unread{background:color-mix(in srgb,var(--color-accent) 7%,transparent)}
        .notification-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;object-fit:cover;background:var(--color-surface-raised)}
        .notification-copy{min-width:0;display:grid;gap:4px}
        .notification-copy p{margin:0;font-size:11px;line-height:1.45;color:var(--color-text-secondary)}
        .notification-copy small{font-size:10px;color:var(--color-muted-500)}
        .notification-empty{padding:24px 16px;color:var(--color-text-muted);font-size:12px;text-align:center}
        .site-header--ghibli .notification-bell-trigger{border-color:rgba(25,54,47,.25);color:var(--ghibli-ink,#19362f)}
        .site-header--ghibli .notification-bell-trigger:hover,.site-header--ghibli .notification-bell-trigger:focus-visible{border-color:var(--ghibli-coral,#f45164);color:var(--ghibli-blue,#18528a)}
        .site-header--ghibli .notification-bell-trigger:focus-visible{outline-color:var(--ghibli-coral,#f45164)}
        .site-header--ghibli .notification-bell-count{background:var(--ghibli-coral,#f45164);color:#fff}
        .site-header--ghibli .notification-panel{border-color:rgba(25,54,47,.16);background:var(--ghibli-cream,#fff7e8);color:var(--ghibli-ink,#19362f);box-shadow:0 16px 50px rgba(25,54,47,.18)}
        .site-header--ghibli .notification-panel-head{border-bottom-color:rgba(25,54,47,.14)}
        .site-header--ghibli .notification-panel-head button{color:var(--ghibli-coral,#f45164)}
        .site-header--ghibli .notification-panel-head button:hover,.site-header--ghibli .notification-panel-head button:focus-visible{color:var(--ghibli-blue,#18528a)}
        .site-header--ghibli .notification-item{border-bottom-color:rgba(25,54,47,.10)}
        .site-header--ghibli .notification-item:hover{background:rgba(24,82,138,.06)}
        .site-header--ghibli .notification-item.unread{background:rgba(244,81,100,.08)}
        .site-header--ghibli .notification-avatar{background:var(--ghibli-paper,#f4e9d5)}
        .site-header--ghibli .notification-copy p{color:var(--ghibli-ink,#19362f)}
        .site-header--ghibli .notification-copy small{color:#71847b}
        .site-header--ghibli .notification-empty{color:#59756b}
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
