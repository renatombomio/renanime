# Supabase Auth implementation contract

Status: initial SSR foundation and isolated login/session/callback routes committed on the migration branch. Not yet integrated into the login UI, middleware, registration, or library. Do not deploy or disable maintenance mode.

## Dependency gate

The repository now includes `@supabase/ssr` in `package.json` and the generated `pnpm-lock.yaml`. The request-scoped SSR client is in `src/lib/supabase-ssr.ts`. Keep dependency and lockfile changes synchronized using pnpm; do not hand-edit the lockfile.

Use the documented `createServerClient` cookie adapter with request-cookie `getAll` and Astro cookie `setAll`. Use the public publishable/anon key in the SSR client; never use the secret/service-role key in a browser or SSR session client. Keep the existing service-role client isolated to trusted server-only maintenance tasks.

## Target routes

- `POST /api/auth/register`: validate email/password/name/aka, call `auth.signUp`, and return a neutral confirmation message. Do not create a legacy profile until the identity/profile strategy is finalized.
- `POST /api/auth/login`: initial isolated endpoint added; calls `auth.signInWithPassword` and returns generic credential errors. Needs local build/tests and UI integration.
- `POST /api/auth/logout`: legacy endpoint remains unchanged. An isolated `POST /api/auth/logout-supabase` endpoint has been added pending cutover.
- `POST /api/auth/reset`: validate email and call `auth.resetPasswordForEmail` with a fixed, allowlisted redirect URL.
- `GET /api/auth/session`: initial session-check endpoint added. `GET /auth/callback` exchanges PKCE code and rejects external redirect targets.
- OAuth: use `signInWithOAuth({ provider: 'google', options: { redirectTo } })` and the same callback handler. Enable Google provider and exact redirect URLs in Supabase Dashboard separately.

## Legacy account and library preservation

- Do not auto-link an Auth user to a legacy account by display name, aka, or unverified email.
- Keep `renanime_users.id` and all `renanime_library.user_id` values unchanged.
- Only create `renanime_auth_identity_map` links after a verified legacy-account claim or documented support verification.
- Before each mapping write, ensure the legacy ID and Auth ID are both unique and that the claimant controls the target Auth account.
- Migrate library read/write routes only after identity mapping is implemented and tested. Do not expose service-role credentials or call privileged legacy RPCs directly from the browser.

## Current implementation status

- Added `src/lib/supabase-ssr.ts` using the public publishable/anon key and a request-scoped cookie adapter.
- Added initial `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout-supabase`, and `GET /auth/callback` routes.
- These routes are currently behind the global maintenance middleware, have not been build/test validated in this environment, and are not wired to the existing legacy login screen.
- The current `POST /api/auth/register`, `POST /api/auth/recover`, `POST /api/auth/logout`, middleware and library routes still use legacy authentication. Do not treat the migration as usable until the remaining integration is completed.

## Required tests before cutover

1. `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm test` pass in CI.
2. Sign-up with email confirmation enabled; duplicate email; invalid input; rate-limited attempts.
3. Login succeeds; wrong password fails without leaking whether an account exists; logout invalidates the session.
4. Expired/invalid callback, malformed redirect target, reset flow, and session refresh.
5. Google OAuth callback in the configured preview environment.
6. Authenticated users can only read/write their own mapped library; an unmapped Auth user cannot access legacy records.
7. Reconcile all 17 existing library entries and verify their legacy owner IDs remain unchanged.
8. Production rollback procedure is documented and tested without deleting legacy tables/RPCs.

## Cutover rule

Keep `MAINTENANCE_MODE = true` until the above checks pass on a preview deployment. Do not apply the review-only SQL or disable legacy auth in production as part of this preparation stage.
