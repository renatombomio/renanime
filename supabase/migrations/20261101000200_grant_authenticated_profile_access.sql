-- Allow authenticated users to read and update their own profile.
-- Row-level security policies remain the authority for which rows are accessible.
grant select, update on table public.profiles to authenticated;
