import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { accessPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const accessPassword =
    typeof body.accessPassword === "string" ? body.accessPassword.trim() : "";

  if (!accessPassword || accessPassword.length > 128) {
    return json({ ok: false, error: "INVALID_ACCESS_PASSWORD" }, 401);
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const secretKey = import.meta.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error("Renanime access gate is missing its server Supabase configuration.");
    return json({ ok: false, error: "ACCESS_UNAVAILABLE" }, 503);
  }

  try {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.rpc("renanime_check_access", {
      p_access_password: accessPassword,
    });

    if (error) {
      if (error.message.includes("INVALID_ACCESS_PASSWORD")) {
        return json({ ok: false, error: "INVALID_ACCESS_PASSWORD" }, 401);
      }
      console.error("Renanime access verification failed:", error.code ?? "UNKNOWN");
      return json({ ok: false, error: "ACCESS_UNAVAILABLE" }, 503);
    }

    return json({ ok: true, hasProfiles: Boolean(data?.has_profiles) });
  } catch (error) {
    console.error("Renanime access verification threw an exception:", error);
    return json({ ok: false, error: "ACCESS_UNAVAILABLE" }, 503);
  }
};
