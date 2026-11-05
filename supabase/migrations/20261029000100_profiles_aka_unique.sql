-- Renanime Auth profile constraints.
-- Review and apply to the intended Supabase environment only after backup and preview configuration.
-- Existing profiles table is empty at authoring time; do not modify legacy renanime_users/library IDs.

create unique index if not exists profiles_aka_lower_unique
  on public.profiles (lower(aka))
  where aka is not null and length(trim(aka)) > 0;

comment on index public.profiles_aka_lower_unique is
  'Prevents duplicate non-empty Renanime nicknames regardless of case.';
