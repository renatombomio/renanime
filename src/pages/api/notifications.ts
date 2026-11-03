import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase.from("notifications")
        .select("id, actor_id, comment_id, type, emoji, is_read, created_at, profiles!notifications_actor_id_fkey(name, aka, avatar_url), anime_comments(anime_id, content)")
        .eq("recipient_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("recipient_id", authData.user.id).eq("is_read", false),
    ]);
    if (error || countError) return json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }, 503);
    return json({ ok: true, notifications: data ?? [], unreadCount: count ?? 0 });
  } catch (error) {
    console.error("Notifications read failed:", error);
    return json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }, 503);
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  let body: { id?: unknown; all?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    let query = supabase.from("notifications").update({ is_read: true }).eq("recipient_id", authData.user.id);
    if (body.all === true) {
      // Mark all notifications as read for the current user.
    } else if (typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)) {
      query = query.eq("id", body.id);
    } else {
      return json({ ok: false, error: "INVALID_NOTIFICATION" }, 400);
    }
    const { error } = await query;
    if (error) return json({ ok: false, error: "NOTIFICATION_UPDATE_FAILED" }, 503);
    return json({ ok: true });
  } catch (error) {
    console.error("Notification update failed:", error);
    return json({ ok: false, error: "NOTIFICATION_UPDATE_FAILED" }, 503);
  }
};
