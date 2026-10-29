# Supabase Auth implementation contract

Status: Supabase email login/sign-up UI and initial email/password, Google OAuth, reset-password, password-update, and nickname setup routes are implemented on the migration branch. They are not yet end-to-end validated. API requests remain blocked by Preview maintenance middleware. Do not deploy or disable production maintenance mode.

## Dependency gate

The repository now includes `@supabase/ssr` in `package.json` and the generated `pnpm-lock.yaml`. The request-scoped SSR client is in `src/lib/supabase-ssr.ts`. Keep dependency and lockfile changes synchronized using pnpm; do not hand-edit the lockfile.

Use the documented `createServerClient` cookie adapter with request-cookie `getAll` and Astro cookie `setAll`. Use the public publishable/anon key in the SSR client; never use the secret/service-role key in a browser or SSR session client. Keep the existing service-role client isolated to trusted server-only maintenance tasks.

## Target routes

- `POST /api/auth/register`: validates email/password/aka and calls `auth.signUp`; nickname and display name are stored in Auth metadata and the existing `handle_new_user` trigger seeds `public.profiles`.
- `POST /api/auth/login`: initial isolated endpoint added; calls `auth.signInWithPassword` and returns generic credential errors. Needs local build/tests and UI integration.
- `POST /api/auth/logout`: legacy endpoint remains unchanged. An isolated `POST /api/auth/logout-supabase` endpoint has been added pending cutover.
- `POST /api/auth/reset`: validates email and requests a password-reset email. `POST /api/auth/update-password` requires a valid recovery session.
- `GET /api/auth/session`: initial session-check endpoint added. `GET /auth/callback` exchanges PKCE code and rejects external redirect targets.
- OAuth: `POST /api/auth/oauth` initiates Google OAuth and routes first-time Google users through nickname setup. Enable Google provider and exact redirect URLs in Supabase Dashboard separately.

## Legacy account and library preservation

- Do not auto-link an Auth user to a legacy account by display name, aka, or unverified email.
- Keep `renanime_users.id` and all `renanime_library.user_id` values unchanged.
- Only create `renanime_auth_identity_map` links after a verified legacy-account claim or documented support verification.
- Before each mapping write, ensure the legacy ID and Auth ID are both unique and that the claimant controls the target Auth account.
- Migrate library read/write routes only after identity mapping is implemented and tested. Do not expose service-role credentials or call privileged legacy RPCs directly from the browser.

## Current implementation status

- Added `src/lib/supabase-ssr.ts` using the public publishable/anon key and a request-scoped cookie adapter.
- Added initial `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout-supabase`, and `GET /auth/callback` routes.
- Replaced the legacy access-code login UI with email/password sign-in, email/password registration, Google OAuth, password reset/update, and nickname onboarding.
- Added initial Supabase endpoints for registration, OAuth, password reset/update, and authenticated nickname setup.
- Added a review-only migration file for case-insensitive nickname uniqueness; it has not been applied to the database.
- These routes remain blocked by Preview maintenance middleware, and no build or end-to-end tests have been run after these changes.
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
