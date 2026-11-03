create table if not exists public.anime_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id integer not null check (anime_id > 0),
  created_at timestamptz not null default now(),
  constraint anime_likes_user_anime_unique unique (user_id, anime_id)
);

create index if not exists anime_likes_anime_id_idx on public.anime_likes (anime_id);
create index if not exists anime_likes_user_created_idx on public.anime_likes (user_id, created_at desc);

alter table public.anime_likes enable row level security;

create policy "Anime likes are publicly readable"
  on public.anime_likes for select to anon, authenticated
  using (true);

create policy "Users can like anime as themselves"
  on public.anime_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own anime likes"
  on public.anime_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.anime_likes to anon, authenticated;
grant insert, delete on public.anime_likes to authenticated;
