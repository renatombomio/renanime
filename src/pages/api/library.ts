import type { APIRoute } from "astro";
import { supabaseServer } from "../../../lib/supabase-server";

export const prerender = false;

type Entry = {
  animeId: string;
  format?: "SERIES" | "MOVIE";
  franchiseId?: string;
  state: {
    status: "WATCHED" | "PENDING" | "NOT_IN_COLLECTION";
    favorite: boolean;
    recommended: boolean;
    personalScore?: number;
    personalRanking?: number;
    review?: string;
  };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getToken(AstroCookies: any) {
  return AstroCookies.get("renanime_session")?.value as string | undefined;
}

export const GET: APIRoute = async ({ cookies }) => {
  const token = await getToken(cookies);
  if (!token) return json({ error: "No hay sesión activa." }, 401);

  const { data, error } = await supabaseServer.rpc("renanime_get_library", { p_token: token });
  if (error) return json({ error: "No se pudo cargar tu biblioteca." }, 500);

  return json(Array.isArray(data) ? data : []);
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = await getToken(cookies);
  if (!token) return json({ error: "No hay sesión activa." }, 401);

  let body: { action?: string; entry?: Entry; entries?: Entry[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Petición inválida." }, 400);
  }

  if (body.action === "sync") {
    const entries = Array.isArray(body.entries) ? body.entries : [];
    for (const entry of entries) {
      if (!entry?.animeId || !entry.state || entry.state.status === "NOT_IN_COLLECTION") continue;
      const { error } = await supabaseServer.rpc("renanime_upsert_entry", {
        p_token: token,
        p_anime_id: String(entry.animeId),
        p_format: entry.format ?? null,
        p_franchise_id: entry.franchiseId ?? null,
        p_state: entry.state,
      });
      if (error) return json({ error: "No se pudo migrar tu biblioteca completa." }, 500);
    }
    return json({ ok: true });
  }

  if (!body.entry?.animeId || !body.entry.state) return json({ error: "Falta la entrada." }, 400);

  const { data, error } = await supabaseServer.rpc("renanime_upsert_entry", {
    p_token: token,
    p_anime_id: String(body.entry.animeId),
    p_format: body.entry.format ?? null,
    p_franchise_id: body.entry.franchiseId ?? null,
    p_state: body.entry.state,
  });

  if (error) return json({ error: "No se pudo guardar el cambio." }, 500);
  return json(data ?? body.entry);
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const token = await getToken(cookies);
  if (!token) return json({ error: "No hay sesión activa." }, 401);

  const url = new URL(request.url);
  const animeId = url.searchParams.get("animeId");
  if (!animeId) return json({ error: "Falta animeId." }, 400);

  const { data, error } = await supabaseServer.rpc("renanime_remove_entry", {
    p_token: token,
    p_anime_id: animeId,
  });

  if (error) return json({ error: "No se pudo eliminar el anime." }, 500);
  return json({ ok: Boolean(data) });
};