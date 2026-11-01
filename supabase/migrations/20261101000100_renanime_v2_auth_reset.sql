-- Renanime 2.0: prepare the new account and library model.
-- This migration is intentionally additive. It does not delete legacy users,
-- sessions, recovery data, or library rows. Legacy data remains archived until
-- the new application has passed Preview verification and cutover is approved.

alter table public.user_anime
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists profiles_aka_lower_unique
  on public.profiles (lower(aka))
  where aka is not null and length(trim(aka)) > 0;

comment on column public.user_anime.metadata is
  'Optional user-owned anime metadata (favorite, recommended, format, franchise, score, ranking, review).';

-- Create a profile for every new Supabase Auth user.
-- Nicknames are user-provided metadata, not authorization data. If a nickname
-- is already taken, create a collision-safe fallback profile so Auth signup
-- does not fail because of a profile nickname collision.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_name text;
  requested_aka text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  requested_aka := nullif(trim(new.raw_user_meta_data ->> 'aka'), '');

  insert into public.profiles (id, name, aka)
  values (
    new.id,
    coalesce(requested_name, 'Usuario'),
    requested_aka
  )
  on conflict do nothing;

  if not found then
    insert into public.profiles (id, name, aka)
    values (
      new.id,
      coalesce(requested_name, 'Usuario'),
      'nakama_' || left(replace(new.id::text, '-', ''), 12)
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
