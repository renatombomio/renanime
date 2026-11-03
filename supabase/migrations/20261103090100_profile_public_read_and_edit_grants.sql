-- Grant public profile reads and owner edits for profile editor fields.
grant select on public.profiles to anon, authenticated;
grant update (name, aka, bio, location, avatar_url, cover_url, interests, favorite_anime_id, is_private, updated_at)
  on public.profiles to authenticated;
