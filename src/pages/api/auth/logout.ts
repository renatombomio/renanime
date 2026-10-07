import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { supabaseServer } from "../../../lib/supabase-server";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get("renanime_session")?.value;

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await supabaseServer.from("renanime_sessions").delete().eq("token_hash", tokenHash);
  }

  cookies.delete("renanime_session", { path: "/" });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
