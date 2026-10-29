import { createServerClient } from "@supabase/ssr";

type CookieValue = { name: string; value: string };
type CookieOptions = any;

type AstroCookieAdapter = {
  getAll: () => CookieValue[];
  set: (name: string, value: string, options?: CookieOptions) => void;
};

/**
 * Creates a Supabase client bound to one incoming request.
 * Never cache this client across requests and never use the service-role key here.
 */
export function createSupabaseSsrClient(request: Request, cookies: AstroCookieAdapter) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey =
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY (or PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        // Astro's cookie jar represents the cookies from this request.
        return cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, options as CookieOptions);
        }
      },
    },
    global: {
      headers: {
        "X-Client-Info": "renanime-ssr",
      },
    },
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
}
