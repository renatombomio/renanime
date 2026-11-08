import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../lib/supabase-ssr";

export const prerender = false;

type LibraryEntry = {
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
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function serializeEntry(row: { anime_id: number; status: string; metadata: unknown }): PersonalAnimeEntry {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  return {
    animeId: String(row.anime_id),
    format: metadata.format === "SERIES" || metadata.format === "MOVIE" ? metadata.format : undefined,
    franchiseId: typeof metadata.franchiseId === "string" ? metadata.franchiseId : undefined,
    state: {
      status: row.status === "seen" ? "WATCHED" : "PENDING",
      favorite: metadata.favorite === true,
      recommended: metadata.recommended === true,
      ...(typeof metadata.personalScore === "number" ? { personalScore: metadata.personalScore } : {}),
      ...(typeof metadata.personalRanking === "number" ? { personalRanking: metadata.personalRanking } : {}),
      ...(typeof metadata.review === "string" ? { review: metadata.review } : {}),
    },
  };
}

function normalizeEntry(entry: LibraryEntry, userId: string) {
  const animeId = Number(entry?.animeId);
  if (!Number.isSafeInteger(animeId) || animeId <= 0 || !entry.state) return null;

  const status =
    entry.state.status === "WATCHED"
      ? "seen"
      : entry.state.status === "PENDING"
        ? "pending"
        : null;

  if (!status) return null;

  const metadata: Record<string, unknown> = {
    favorite: Boolean(entry.state.favorite),
    recommended: Boolean(entry.state.recommended),
  };

  if (entry.format === "SERIES" || entry.format === "MOVIE") metadata.format = entry.format;
  if (typeof entry.franchiseId === "string" && entry.franchiseId.length <= 64) {
    metadata.franchiseId = entry.franchiseId;
  }
  if (typeof entry.state.personalScore === "number" && Number.isFinite(entry.state.personalScore)) metadata.personalScore = entry.state.personalScore;
  if (typeof entry.state.personalRanking === "number" && Number.isSafeInteger(entry.state.personalRanking)) metadata.personalRanking = entry.state.personalRanking;
  if (typeof entry.state.review === "string") metadata.review = entry.state.review.slice(0, 5000);

  return { user_id: userId, anime_id: animeId, status, metadata };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data, error } = await supabase
      .from("user_anime")
      .select("anime_id, status, metadata")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Library read failed:", error.code);
      return json({ ok: false, error: "LIBRARY_UNAVAILABLE" }, 500);
    }

    const entries = (data ?? []).map((row) => {
      const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
      return {
        animeId: String(row.anime_id),
        format: metadata.format,
        franchiseId: metadata.franchiseId,
        state: {
          status: row.status === "seen" ? "WATCHED" : "PENDING",
          favorite: metadata.favorite === true,
          recommended: metadata.recommended === true,
          ...(typeof metadata.personalScore === "number" ? { personalScore: metadata.personalScore } : {}),
          ...(typeof metadata.personalRanking === "number" ? { personalRanking: metadata.personalRanking } : {}),
          ...(typeof metadata.review === "string" ? { review: metadata.review } : {}),
        },
      };
    });

    return json(entries);
  } catch (error) {
    console.error("Library read setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { action?: string; entry?: LibraryEntry; entries?: LibraryEntry[] };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    if (body.action === "sync") {
      if (!Array.isArray(body.entries) || body.entries.length > 500) {
        return json({ ok: false, error: "INVALID_LIBRARY" }, 400);
      }

      const rows = body.entries
        .map((entry) => normalizeEntry(entry, auth.user.id))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      if (rows.length) {
        const { error } = await supabase
          .from("user_anime")
          .upsert(rows, { onConflict: "user_id,anime_id" });

        if (error) {
          console.error("Library sync failed:", error.code);
          return json({ ok: false, error: "LIBRARY_SYNC_FAILED" }, 500);
        }
      }

      return json({ ok: true, synced: rows.length });
    }

    if (!body.entry) return json({ ok: false, error: "MISSING_ENTRY" }, 400);
    const row = normalizeEntry(body.entry, auth.user.id);
    if (!row) return json({ ok: false, error: "INVALID_ENTRY" }, 400);

    const { data: saved, error } = await supabase
      .from("user_anime")
      .upsert(row, { onConflict: "user_id,anime_id" })
      .select("anime_id,status,metadata")
      .single();

    if (error || !saved) {
      console.error("Library update failed:", { code: error?.code, message: error?.message });
      return json({ ok: false, error: "LIBRARY_UPDATE_FAILED" }, 500);
    }

    return json({ ok: true, entry: serializeEntry(saved) });
  } catch (error) {
    console.error("Library write setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const animeId = Number(new URL(request.url).searchParams.get("animeId"));
  if (!Number.isSafeInteger(animeId) || animeId <= 0) {
    return json({ ok: false, error: "INVALID_ANIME_ID" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { error } = await supabase
      .from("user_anime")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("anime_id", animeId);

    if (error) {
      console.error("Library delete failed:", error.code);
      return json({ ok: false, error: "LIBRARY_DELETE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Library delete setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
