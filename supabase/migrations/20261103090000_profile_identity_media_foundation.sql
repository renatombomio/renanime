-- Renanime 2.0 profile identity and media foundation.
-- Applied to the Development project only. Production remains untouched.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists avatar_url text,
  add column if not exists cover_url text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists favorite_anime_id integer,
  add column if not exists is_private boolean not null default false;

alter table public.profiles
  add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 280),
  add constraint profiles_location_length_check check (location is null or char_length(location) <= 80),
  add constraint profiles_avatar_url_length_check check (avatar_url is null or char_length(avatar_url) <= 2048),
  add constraint profiles_cover_url_length_check check (cover_url is null or char_length(cover_url) <= 2048);

create index if not exists profiles_aka_lookup_idx on public.profiles (lower(aka));

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (is_private = false or (select auth.uid()) = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "Public profile media is readable" on storage.objects;
create policy "Public profile media is readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-media');

drop policy if exists "Users upload own profile media" on storage.objects;
create policy "Users upload own profile media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update own profile media" on storage.objects;
create policy "Users update own profile media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete own profile media" on storage.objects;
create policy "Users delete own profile media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
