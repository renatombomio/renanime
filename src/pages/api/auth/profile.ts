import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { name?: unknown; aka?: unknown; headline?: unknown; bio?: unknown; location?: unknown; interests?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 40) return json({ ok: false, error: "INVALID_NAME" }, 400);
    updates.name = name;
  }
  if (body.aka !== undefined) {
    const aka = typeof body.aka === "string" ? body.aka.trim().replace(/^@/, "") : "";
    if (!/^[\p{L}\p{N}_-]{2,24}$/u.test(aka)) return json({ ok: false, error: "INVALID_NICKNAME" }, 400);
    updates.aka = aka;
  }
  if (body.headline !== undefined) {
    if (typeof body.headline !== "string" || body.headline.length > 80) return json({ ok: false, error: "INVALID_HEADLINE" }, 400);
    updates.headline = body.headline.trim() || null;
  }
  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests) || body.interests.length > 8 || body.interests.some((item) => typeof item !== "string" || item.trim().length > 24)) {
      return json({ ok: false, error: "INVALID_INTERESTS" }, 400);
    }
    updates.interests = [...new Set(body.interests.map((item: string) => item.trim()).filter(Boolean))];
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== "string" || body.bio.length > 280) return json({ ok: false, error: "INVALID_BIO" }, 400);
    updates.bio = body.bio.trim() || null;
  }
  if (body.location !== undefined) {
    if (typeof body.location !== "string" || body.location.length > 80) return json({ ok: false, error: "INVALID_LOCATION" }, 400);
    updates.location = body.location.trim() || null;
  }
  if (!Object.keys(updates).length) return json({ ok: false, error: "NO_CHANGES" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", authData.user.id)
      .select("name, aka, headline, bio, location, interests")
      .single();

    if (error) {
      console.warn("Profile update failed:", error.code);
      return json({ ok: false, error: "PROFILE_UPDATE_FAILED", code: error.code ?? "UNKNOWN" }, 400);
    }
    return json({ ok: true, profile: data });
  } catch (error) {
    console.error("Profile update endpoint failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
