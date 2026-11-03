import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

const ALLOWED_EMOJIS = ["❤️", "😂", "🔥", "😭", "👏", "😮", "👍"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { commentId?: unknown; emoji?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  const commentId = typeof body.commentId === "string" ? body.commentId : "";
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!/^[0-9a-f-]{36}$/i.test(commentId) || !ALLOWED_EMOJIS.includes(emoji as typeof ALLOWED_EMOJIS[number])) {
    return json({ ok: false, error: "INVALID_REACTION" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data: comment, error: commentError } = await supabase
      .from("anime_comments").select("id, user_id").eq("id", commentId).maybeSingle();
    if (commentError || !comment) return json({ ok: false, error: "COMMENT_NOT_FOUND" }, 404);

    const { data: existing, error: existingError } = await supabase
      .from("anime_comment_reactions").select("id")
      .eq("comment_id", commentId).eq("user_id", authData.user.id).eq("emoji", emoji).maybeSingle();
    if (existingError) return json({ ok: false, error: "REACTION_LOOKUP_FAILED" }, 503);

    if (existing) {
      const { error } = await supabase.from("anime_comment_reactions").delete().eq("id", existing.id);
      if (error) return json({ ok: false, error: "REACTION_REMOVE_FAILED" }, 503);
      if (comment.user_id !== authData.user.id) {
        const { error: notificationError } = await supabase.from("notifications").delete()
          .eq("recipient_id", comment.user_id).eq("actor_id", authData.user.id)
          .eq("comment_id", commentId).eq("type", "comment_reaction").eq("emoji", emoji);
        if (notificationError) console.warn("Reaction notification cleanup failed:", notificationError.code);
      }
      return json({ ok: true, active: false });
    }

    const { error: insertError } = await supabase.from("anime_comment_reactions").insert({
      comment_id: commentId, user_id: authData.user.id, emoji,
    });
    if (insertError) return json({ ok: false, error: "REACTION_CREATE_FAILED" }, 503);

    if (comment.user_id !== authData.user.id) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: comment.user_id, actor_id: authData.user.id,
        comment_id: commentId, type: "comment_reaction", emoji,
      });
      if (notificationError) console.warn("Reaction notification create failed:", notificationError.code);
    }
    return json({ ok: true, active: true });
  } catch (error) {
    console.error("Anime comment reaction failed:", error);
    return json({ ok: false, error: "REACTION_FAILED" }, 503);
  }
};
