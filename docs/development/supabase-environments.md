# Supabase environments

Renanime uses two independent Supabase projects.

| Environment | Project ref | Purpose |
|---|---|---|
| Production | `zgjetpoamiewygqlhheo` | Real users and production data |
| Development / Preview | `pakkdnfifrshqyqedpni` | Test registrations, profiles, libraries and community |

## Astro/Vercel variables

The SSR client reads:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `PUBLIC_SUPABASE_ANON_KEY` fallback)
- `SUPABASE_SECRET_KEY` only for trusted server-side catalog synchronization; never expose it through a `PUBLIC_` variable or browser code.
- `ANIME_SEARCH_CACHE_TOKEN` for the private server-side anime search cache. This token is isolated to the Preview branch and is never sent to the browser.

Configure the **Preview** environment in Vercel with the Development project's URL and publishable key. The character catalog synchronization endpoint also requires the Development project's `SUPABASE_SECRET_KEY` in Preview only. Keep the **Production** environment pointed at the Production project. Do not use a shared variable scope for both environments.

Development values:
- `PUBLIC_SUPABASE_URL=https://pakkdnfifrshqyqedpni.supabase.co`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: retrieve from the Development project's API Keys page and store in Vercel Preview only.

The anime search cache uses private tables and token-validated database functions. Only the server route receives the cache token. Cache entries are shared across Preview instances, keyed by normalized query/filter state and page. Search entries expire after 12 hours; filter combinations expire after 6 hours; Jikan fallback entries expire after 30 minutes. Expired entries are opportunistically cleaned during writes.

Do not commit real keys. Keep local development values in an ignored `.env.local`. Never configure the Development secret as a Production variable.

## Database baseline

The clean Development project starts with only:
- `public.profiles`, linked to `auth.users`
- `public.user_anime`, linked to `auth.users`
- per-user RLS policies and timestamp/auth triggers

No production user records or legacy custom-auth tables are copied. Apply subsequent migrations from `supabase/migrations` only after reviewing them against this baseline.
