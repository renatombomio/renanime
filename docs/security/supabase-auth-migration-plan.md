# Renanime 2.0 — Supabase Auth migration plan

## Objective

Replace the custom `renanime_session`, `renanime_register`, and `renanime_recover` authentication flow with Supabase Auth. Preserve every existing Renanime profile and personal library.

## Current-state findings

- The application currently authenticates through custom Postgres RPCs and a `renanime_session` cookie.
- The server Supabase client uses `SUPABASE_SECRET_KEY`; this key must remain server-only.
- The production database has existing `renanime_users`, `renanime_sessions`, and `renanime_library` data.
- Supabase Auth's `auth.users` and the existing `public.profiles` / `public.user_anime` tables were empty at audit time.
- The site is intentionally in maintenance mode. Keep it that way until the migration passes verification.

## Migration principles

1. Do not delete or overwrite existing users, recovery data, or library entries during preparation.
2. Do not assume existing custom-auth users have email addresses or passwords that can be migrated.
3. Do not create Supabase Auth accounts based on unverified email addresses or profile names alone.
4. Preserve the existing Renanime profile ID as a stable legacy identifier and explicitly map it to a new Supabase Auth UUID.
5. Require each existing user to reclaim their account through a secure, verified process. Where no verified email exists, provide a support-assisted/manual claim flow with proof of control; do not allow claiming based on display name alone.
6. Do not auto-link Google accounts solely because an unverified email string matches.
7. Keep the service-role/secret key server-side; use a publishable key in browser code and enforce Row Level Security for client-accessible data.
8. Keep legacy recovery codes and custom-auth tables until migration and account recovery have been tested. Then remove obsolete fields/functions in a separate, reviewed database migration.

## Target account model

- Supabase Auth owns authentication, email verification, password reset, OAuth identity, and sessions.
- A profile mapping links `auth.users.id` to the existing Renanime user identity.
- Personal anime collections remain associated with the stable Renanime identity during the transition; only migrate their ownership to `auth.users.id` after a verified mapping is established.
- A user can link Google from an authenticated session. OAuth callback handling must validate state and the authenticated session.

## Implementation phases

### Phase 1 — Inventory and mapping
- Inspect all auth routes, client flows, profile reads/writes, and database RPCs.
- Define a reversible mapping table between legacy user IDs and Supabase Auth IDs.
- Back up production data and test the mapping against a non-production database.

### Phase 2 — Server-side Supabase Auth
- Add a request-scoped Supabase server client that reads/writes Astro cookies using the supported SSR pattern.
- Replace custom-session middleware with verified Supabase Auth sessions.
- Add sign-up, sign-in, sign-out, password reset, email verification, and OAuth callback routes.
- Do not expose service-role credentials to the browser.

### Phase 3 — Existing-account recovery
- Build an explicit claim/migration flow for existing accounts.
- Require email verification before mapping an email account to a legacy profile.
- Preserve existing libraries; verify ownership and counts before changing any foreign keys.
- Provide a clear path for users without a previously verified email.

### Phase 4 — Google OAuth
- Configure Google provider and allowed redirect URLs in Supabase and the deployed app.
- Allow linking from a signed-in account and avoid automatic identity merges based only on matching email text.
- Test first sign-in, returning sign-in, cancelled OAuth, and conflicting identities.

### Phase 5 — Cutover and cleanup
- Run smoke tests for registration, verification, login, password recovery, Google login, profile access, library reads/writes, and logout.
- Review RLS and Supabase Security Advisor findings.
- Remove custom-auth RPCs and recovery-code fields only after all migration checks pass.
- Disable maintenance mode only after production verification.

## Acceptance criteria

- Existing library rows are preserved and mapped to the correct user.
- No user can read or modify another user's profile or library.
- Email recovery works end-to-end.
- Google OAuth does not create accidental duplicate or incorrectly linked accounts.
- All secret keys remain server-side.
- Database backups and rollback instructions are documented.
- The site remains in maintenance mode until acceptance criteria are met.

## Safety note

This document is a plan, not a production migration. No user data, database schema, or production authentication settings should be changed until the mapping strategy and rollback plan have been reviewed.
