const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function callRenanime<T>(body: Record<string, unknown>): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE_NOT_CONFIGURED");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/renanime-v2`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "RENANIME_REQUEST_FAILED");
  return payload as T;
}
