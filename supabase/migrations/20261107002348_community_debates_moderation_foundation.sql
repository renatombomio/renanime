-- Reconstructed from the live renanime-development catalog.
-- Historical baseline: this migration is committed for repository parity only.
-- It has ALREADY been applied to Development (version 20261107002348).
-- Do not apply it again to that database.
-- Follow-up policy/index changes made directly after the original migration are
-- included here so a fresh environment reproduces the observed final baseline.

create table if not exists public.community_debates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general'
    check (category = any (array['anime','characters','theories','comparisons','manga','general'])),
  image_path text,
  image_status text not null default 'none'
    check (image_status = any (array['none','pending','approved','rejected','removed'])),
  status text not null default 'published'
    check (status = any (array['published','hidden','removed'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_debates_title_check check (char_length(btrim(title)) between 8 and 120),
  constraint community_debates_body_check check (char_length(btrim(body)) between 20 and 3000)
);

create table if not exists public.community_debate_comments (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.community_debates(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid,
  content text not null,
  status text not null default 'visible'
    check (status = any (array['visible','hidden','removed'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_debate_comments_content_check check (char_length(btrim(content)) between 1 and 1500),
  constraint community_debate_comments_id_debate_id_key unique (id, debate_id),
  constraint community_debate_comments_parent_same_debate_fkey
    foreign key (parent_comment_id, debate_id)
    references public.community_debate_comments(id, debate_id) on delete cascade
);

create table if not exists public.community_debate_likes (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.community_debates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_debate_likes_one_per_user unique (debate_id, user_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type = any (array['debate','comment','user'])),
  debate_id uuid references public.community_debates(id) on delete cascade,
  comment_id uuid references public.community_debate_comments(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (reason = any (array['sexual_content','obscene_image','hate_speech','harassment','violence','spam','impersonation','other'])),
  details text,
  status text not null default 'pending' check (status = any (array['pending','reviewing','actioned','dismissed'])),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint community_reports_details_check check (details is null or char_length(details) <= 1000),
  constraint community_reports_target_check check (
    (target_type = 'debate' and debate_id is not null and comment_id is null and reported_user_id is null) or
    (target_type = 'comment' and comment_id is not null and debate_id is null and reported_user_id is null) or
    (target_type = 'user' and reported_user_id is not null and debate_id is null and comment_id is null)
  )
);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.community_reports(id) on delete set null,
  target_type text not null check (target_type = any (array['debate','comment','image','account'])),
  target_id uuid,
  reason text not null,
  action text not null check (action = any (array['content_removed','warning','temporary_suspension','account_terminated','report_dismissed'])),
  strike_number integer check (strike_number is null or strike_number between 1 and 3),
  moderator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists community_debates_created_idx
  on public.community_debates (created_at desc) where status = 'published';
create index if not exists community_debates_author_idx
  on public.community_debates (author_id, created_at desc);
create index if not exists community_debate_comments_debate_idx
  on public.community_debate_comments (debate_id, created_at);
create index if not exists community_debate_comments_author_idx
  on public.community_debate_comments (author_id, created_at desc);
create index if not exists community_debate_comments_parent_idx
  on public.community_debate_comments (parent_comment_id, debate_id);
create index if not exists community_debate_likes_rank_idx
  on public.community_debate_likes (debate_id, created_at desc);
create index if not exists community_debate_likes_user_idx
  on public.community_debate_likes (user_id);
create index if not exists community_reports_queue_idx
  on public.community_reports (status, created_at);
create index if not exists community_reports_reporter_idx
  on public.community_reports (reporter_id);
create index if not exists community_reports_debate_idx
  on public.community_reports (debate_id);
create index if not exists community_reports_comment_idx
  on public.community_reports (comment_id);
create index if not exists community_reports_reported_user_idx
  on public.community_reports (reported_user_id);
create index if not exists community_moderation_actions_report_idx
  on public.community_moderation_actions (report_id);
create index if not exists community_moderation_actions_moderator_idx
  on public.community_moderation_actions (moderator_id);
create index if not exists community_moderation_user_idx
  on public.community_moderation_actions (user_id, created_at desc);

alter table public.community_debates enable row level security;
alter table public.community_debate_comments enable row level security;
alter table public.community_debate_likes enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_actions enable row level security;

drop policy if exists "Debates are visible to public or author" on public.community_debates;
create policy "Debates are visible to public or author" on public.community_debates
for select to anon, authenticated
using (
  (status = 'published' and exists (
    select 1 from public.profiles p where p.id = community_debates.author_id and p.is_private = false
  )) or (select auth.uid()) = author_id
);

drop policy if exists "Users can create their own debates" on public.community_debates;
create policy "Users can create their own debates" on public.community_debates
for insert to authenticated
with check (
  (select auth.uid()) = author_id and status = 'published'
  and image_status in ('none','pending')
  and ((image_status = 'none' and image_path is null) or (image_status = 'pending' and image_path is not null))
  and exists (select 1 from public.profiles p where p.id = community_debates.author_id and p.is_private = false)
);

drop policy if exists "Authors can delete their own debates" on public.community_debates;
create policy "Authors can delete their own debates" on public.community_debates
for delete to authenticated using ((select auth.uid()) = author_id);

drop policy if exists "Debate comments are visible to public or author" on public.community_debate_comments;
create policy "Debate comments are visible to public or author" on public.community_debate_comments
for select to anon, authenticated
using (
  ((status = 'visible' and exists (
    select 1 from public.community_debates d join public.profiles p on p.id = d.author_id
    where d.id = community_debate_comments.debate_id and d.status = 'published' and p.is_private = false
  ) and exists (
    select 1 from public.profiles p2 where p2.id = community_debate_comments.author_id and p2.is_private = false
  )) or (select auth.uid()) = author_id
);

drop policy if exists "Users can comment as themselves" on public.community_debate_comments;
create policy "Users can comment as themselves" on public.community_debate_comments
for insert to authenticated
with check (
  (select auth.uid()) = author_id and status = 'visible'
  and exists (select 1 from public.profiles p where p.id = community_debate_comments.author_id and p.is_private = false)
  and exists (select 1 from public.community_debates d where d.id = community_debate_comments.debate_id and d.status = 'published')
);

drop policy if exists "Authors can delete their own debate comments" on public.community_debate_comments;
create policy "Authors can delete their own debate comments" on public.community_debate_comments
for delete to authenticated using ((select auth.uid()) = author_id);

drop policy if exists "Debate likes are publicly readable" on public.community_debate_likes;
create policy "Debate likes are publicly readable" on public.community_debate_likes
for select to anon, authenticated
using (exists (select 1 from public.community_debates d where d.id = community_debate_likes.debate_id and d.status = 'published'));

drop policy if exists "Users can like debates as themselves" on public.community_debate_likes;
create policy "Users can like debates as themselves" on public.community_debate_likes
for insert to authenticated
with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.community_debates d where d.id = community_debate_likes.debate_id and d.status = 'published'
  )
);

drop policy if exists "Users can remove their own debate likes" on public.community_debate_likes;
create policy "Users can remove their own debate likes" on public.community_debate_likes
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own reports" on public.community_reports;
create policy "Users can read their own reports" on public.community_reports
for select to authenticated using ((select auth.uid()) = reporter_id);

drop policy if exists "Users can submit community reports" on public.community_reports;
create policy "Users can submit community reports" on public.community_reports
for insert to authenticated with check ((select auth.uid()) = reporter_id and status = 'pending');

-- Match the effective table-level grants observed in Development. RLS remains
-- the row-level gate; moderation actions intentionally have no client grants.
grant all on table public.community_debates to anon, authenticated;
grant all on table public.community_debate_comments to anon, authenticated;
grant all on table public.community_debate_likes to anon, authenticated;
grant all on table public.community_reports to authenticated;

-- Private quarantine bucket; files are never public from this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('debate-quarantine','debate-quarantine',false,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own debate images to quarantine" on storage.objects;
create policy "Users upload own debate images to quarantine" on storage.objects
for insert to authenticated with check (
  bucket_id = 'debate-quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Users read own quarantined debate images" on storage.objects;
create policy "Users read own quarantined debate images" on storage.objects
for select to authenticated using (
  bucket_id = 'debate-quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "Users delete own quarantined debate images" on storage.objects;
create policy "Users delete own quarantined debate images" on storage.objects
for delete to authenticated using (
  bucket_id = 'debate-quarantine' and (storage.foldername(name))[1] = (select auth.uid())::text
);
