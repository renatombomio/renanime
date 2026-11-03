-- Renanime 2.0 clean auth/profile/library baseline.
-- Development environment only. No legacy account/session/library data is copied.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  aka text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id integer not null,
  status text not null check (status in ('pending', 'seen')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_anime_unique unique (user_id, anime_id)
);

create unique index profiles_aka_lower_unique
  on public.profiles (lower(aka))
  where aka is not null and length(trim(aka)) > 0;

create index user_anime_user_id_idx on public.user_anime (user_id);
create index user_anime_anime_id_idx on public.user_anime (anime_id);
create index user_anime_status_idx on public.user_anime (user_id, status);

alter table public.profiles enable row level security;
alter table public.user_anime enable row level security;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can view own anime"
  on public.user_anime for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add own anime"
  on public.user_anime for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own anime"
  on public.user_anime for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own anime"
  on public.user_anime for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.update_updated_at() from public, anon, authenticated;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger user_anime_updated_at
  before update on public.user_anime
  for each row execute function public.update_updated_at();

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
  values (new.id, coalesce(requested_name, 'Usuario'), requested_aka)
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant select on public.profiles to authenticated;
grant update (name, aka, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_anime to authenticated;
