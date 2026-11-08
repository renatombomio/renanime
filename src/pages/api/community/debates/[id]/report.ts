import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../../lib/supabase-ssr";
export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const reasons = ["sexual_content", "obscene_image", "hate_speech", "harassment", "violence", "spam", "impersonation", "other"] as const;

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const id = params.id;
    if (!id) return json({ ok: false, error: "INVALID_DEBATE" }, 400);
    const payload = await request.json();
    const reason = typeof payload?.reason === "string" ? payload.reason : "";
    const details = typeof payload?.details === "string" ? payload.details.trim() : "";
    if (!reasons.includes(reason as typeof reasons[number]) || details.length > 1000) return json({ ok: false, error: "INVALID_REPORT" }, 400);
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    const { data: debate } = await supabase.from("community_debates").select("id,author_id").eq("id", id).eq("status", "published").maybeSingle();
    if (!debate) return json({ ok: false, error: "DEBATE_NOT_FOUND" }, 404);
    if (debate.author_id === auth.user.id) return json({ ok: false, error: "CANNOT_REPORT_OWN_POST" }, 400);
    const { error } = await supabase.from("community_reports").insert({
      reporter_id: auth.user.id,
      target_type: "debate",
      debate_id: id,
      reason,
      details: details || null,
      status: "pending",
    });
    if (error) return json({ ok: false, error: error.code === "23505" ? "ALREADY_REPORTED" : "REPORT_FAILED" }, 503);
    return json({ ok: true }, 201);
  } catch {
    return json({ ok: false, error: "REPORT_FAILED" }, 503);
  }
};
