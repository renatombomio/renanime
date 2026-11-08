-- Phase 1 proposal: social feed and composer fields.
-- Prepared for review only. Do NOT apply until explicitly approved.

alter table public.community_debates
  alter column body drop not null;

alter table public.community_debates
  drop constraint if exists community_debates_body_check;

alter table public.community_debates
  add constraint community_debates_body_check
  check (body is null or char_length(btrim(body)) <= 1500);

alter table public.community_debates
  add column if not exists anime_id integer,
  add column if not exists anime_title text;

comment on column public.community_debates.anime_id is 'AniList anime ID associated with the debate, optional.';
comment on column public.community_debates.anime_title is 'Anime title snapshot for display, optional.';
