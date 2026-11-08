-- Character catalog, anime relations and community likes.
-- Applied to the Development Supabase project only.
create table if not exists public.characters (
  id integer primary key check (id > 0),
  name text not null,
  image_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.anime_characters (
  anime_id integer not null check (anime_id > 0),
  character_id integer not null references public.characters(id) on delete cascade,
  role text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (anime_id, character_id)
);

create table if not exists public.character_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id integer not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint character_likes_user_character_unique unique (user_id, character_id)
);

create index if not exists anime_characters_anime_sort_idx on public.anime_characters (anime_id, sort_order, character_id);
create index if not exists character_likes_character_idx on public.character_likes (character_id);
create index if not exists character_likes_user_created_idx on public.character_likes (user_id, created_at desc);

alter table public.characters enable row level security;
alter table public.anime_characters enable row level security;
alter table public.character_likes enable row level security;

create policy "Characters are publicly readable" on public.characters for select to anon, authenticated using (true);
create policy "Anime character relations are publicly readable" on public.anime_characters for select to anon, authenticated using (true);
create policy "Character likes are publicly readable" on public.character_likes for select to anon, authenticated using (true);
create policy "Users can like characters as themselves" on public.character_likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can remove their own character likes" on public.character_likes for delete to authenticated using ((select auth.uid()) = user_id);

-- Explicit grants are required because new public tables are no longer automatically exposed by the Data API.
grant select on public.characters, public.anime_characters, public.character_likes to anon, authenticated;
grant insert, delete on public.character_likes to authenticated;
