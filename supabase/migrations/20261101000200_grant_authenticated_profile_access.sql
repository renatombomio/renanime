-- Allow authenticated users to read their own profile and update only
-- the fields required by the profile-completion flow.
-- RLS remains enabled and limits rows to auth.uid() = id.

revoke update on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (name, aka, updated_at) on table public.profiles to authenticated;
