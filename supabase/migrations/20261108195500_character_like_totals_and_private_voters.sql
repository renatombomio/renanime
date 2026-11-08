-- Keep voter identities private while exposing pre-aggregated character popularity.
drop policy if exists "Character likes are publicly readable" on public.character_likes;
create policy "Users can view their own character likes"
  on public.character_likes for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.character_like_totals (
  character_id integer primary key references public.characters(id) on delete cascade,
  like_count bigint not null default 0 check (like_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.character_like_totals enable row level security;
create policy "Character like totals are publicly readable"
  on public.character_like_totals for select to anon, authenticated using (true);
grant select on public.character_like_totals to anon, authenticated;

create or replace function public.sync_character_like_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.character_like_totals (character_id, like_count, updated_at)
    values (new.character_id, 1, now())
    on conflict (character_id) do update
      set like_count = public.character_like_totals.like_count + 1,
          updated_at = now();
    return new;
  elsif tg_op = 'DELETE' then
    update public.character_like_totals
      set like_count = greatest(0, like_count - 1), updated_at = now()
      where character_id = old.character_id;
    delete from public.character_like_totals where character_id = old.character_id and like_count = 0;
    return old;
  end if;
  return null;
end;
$function$;
revoke all on function public.sync_character_like_totals() from public, anon, authenticated;
drop trigger if exists character_likes_sync_totals on public.character_likes;
create trigger character_likes_sync_totals
  after insert or delete on public.character_likes
  for each row execute function public.sync_character_like_totals();
