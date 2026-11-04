create table if not exists public.anime_of_the_week (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  anilist_id integer not null check (anilist_id > 0),
  selection_source text not null default 'anilist',
  selection_reason text,
  source_rank integer,
  created_at timestamptz not null default now(),
  constraint anime_of_the_week_valid_period check (week_end > week_start),
  constraint anime_of_the_week_week_unique unique (week_start)
);

create index if not exists anime_of_the_week_period_idx
  on public.anime_of_the_week (week_start desc, week_end);

alter table public.anime_of_the_week enable row level security;

drop policy if exists "Anime of the week is publicly readable" on public.anime_of_the_week;
create policy "Anime of the week is publicly readable"
  on public.anime_of_the_week for select to anon, authenticated using (true);

revoke all on public.anime_of_the_week from anon, authenticated;
grant select on public.anime_of_the_week to anon, authenticated;

insert into public.anime_of_the_week
  (week_start, week_end, anilist_id, selection_source, selection_reason, source_rank)
values
  ('2026-11-02', '2026-11-09', 195604, 'anilist', 'Selección inicial de la temporada de otoño 2026: anime en emisión con buena puntuación y actividad reciente.', 1)
on conflict (week_start) do nothing;
