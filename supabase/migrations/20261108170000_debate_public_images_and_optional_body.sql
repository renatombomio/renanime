-- Debate feed images and optional text.
-- Prepared for review only. Do NOT apply until explicitly approved.
-- Requires the existing community_debates moderation foundation.

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

comment on column public.community_debates.anime_id is
  'Optional AniList anime identifier associated with the debate.';
comment on column public.community_debates.anime_title is
  'Optional anime title snapshot shown with the debate.';

-- The user session uploads directly to this public bucket. Public read is
-- provided by the bucket access model; writes remain protected by storage RLS.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('debate-images','debate-images',true,5242880,array['image/webp'])
on conflict (id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=array['image/webp'];

drop policy if exists "Users upload own debate images" on storage.objects;
create policy "Users upload own debate images"
on storage.objects for insert to authenticated
with check (
  bucket_id='debate-images'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and metadata->>'mimetype'='image/webp'
);

-- Keep the original private debate-quarantine bucket and its policies untouched.
-- It remains unused by the new API and is not deleted by this migration.

drop policy if exists "Users can create their own debates" on public.community_debates;
create policy "Users can create their own debates"
on public.community_debates for insert to authenticated
with check (
  (select auth.uid())=author_id
  and status='published'
  and exists (
    select 1 from public.profiles p
    where p.id=community_debates.author_id and p.is_private=false
  )
  and (
    (image_status='none' and image_path is null)
    or (
      image_status='approved'
      and image_path is not null
      and image_path like (select auth.uid())::text || '/%.webp'
    )
  )
);

-- Moderation uses a server-managed app_metadata claim; clients cannot set it.
revoke update on table public.community_debates from authenticated;
grant update (image_status) on table public.community_debates to authenticated;

drop policy if exists "Community moderators can remove debate images" on public.community_debates;
create policy "Community moderators can remove debate images"
on public.community_debates for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'community_role')='moderator')
with check (
  (select auth.jwt()->'app_metadata'->>'community_role')='moderator'
  and image_status='removed'
);
