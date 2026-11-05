-- Renanime 2.0: additive identity mapping for the Supabase Auth migration.
-- REVIEW ONLY: do not apply to production until the account-claim flow is implemented and tested.
-- This migration intentionally does not create Auth users, modify library rows, or delete legacy data.

begin;

create table if not exists public.renanime_auth_identity_map (
  legacy_user_id uuid primary key
    references public.renanime_users(id) on delete restrict,
  auth_user_id uuid not null unique
    references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  linked_by text not null default 'verified_claim'
    check (linked_by in ('verified_claim', 'support_verified'))
);

comment on table public.renanime_auth_identity_map is
  'Maps a verified Supabase Auth identity to an existing Renanime account. Never populate based only on display name or an unverified email.';

alter table public.renanime_auth_identity_map enable row level security;

-- No direct access from browser roles. Server-side code may access via the
-- server-only secret key after validating the authenticated user and claim flow.
revoke all on table public.renanime_auth_identity_map from public, anon, authenticated;

commit;
