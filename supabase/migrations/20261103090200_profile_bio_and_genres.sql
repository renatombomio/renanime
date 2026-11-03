alter table public.profiles
  add column if not exists headline text;

alter table public.profiles
  add constraint profiles_headline_length_check
  check (headline is null or char_length(headline) <= 80);

grant update (headline) on public.profiles to authenticated;
