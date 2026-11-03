-- Public profile libraries are readable only when the owning profile is public.
-- Owners retain access to their own rows through the existing owner SELECT policy.
drop policy if exists "Public libraries are viewable with public profiles" on public.user_anime;

create policy "Public libraries are viewable with public profiles"
on public.user_anime
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = user_anime.user_id
      and p.is_private = false
  )
);
