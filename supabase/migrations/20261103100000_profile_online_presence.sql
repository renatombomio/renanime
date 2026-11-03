alter table public.profiles
  add column if not exists last_seen_at timestamptz;

grant update (last_seen_at) on public.profiles to authenticated;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc)
  where last_seen_at is not null;
