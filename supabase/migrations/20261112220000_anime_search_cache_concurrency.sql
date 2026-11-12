create table if not exists private.anime_search_cache_locks (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  owner_token uuid not null,
  expires_at timestamptz not null
);
revoke all on private.anime_search_cache_locks from public,anon,authenticated;

create or replace function public.anime_search_cache_claim(p_cache_key text,p_owner uuid,p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_hash text;
begin
 if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_owner is null or p_token is null or length(p_token)<32 then return false; end if;
 select token_hash into v_hash from private.anime_search_cache_config where singleton=true;
 if v_hash is null or encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')<>v_hash then return false; end if;
 insert into private.anime_search_cache_locks(cache_key,owner_token,expires_at)
 values(p_cache_key,p_owner,now()+interval '25 seconds')
 on conflict(cache_key) do update set owner_token=excluded.owner_token,expires_at=excluded.expires_at
 where private.anime_search_cache_locks.expires_at<=now();
 return exists(select 1 from private.anime_search_cache_locks where cache_key=p_cache_key and owner_token=p_owner);
end;
$$;

create or replace function public.anime_search_cache_release(p_cache_key text,p_owner uuid,p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_hash text; v_count integer;
begin
 if p_cache_key is null or p_owner is null or p_token is null or length(p_token)<32 then return false; end if;
 select token_hash into v_hash from private.anime_search_cache_config where singleton=true;
 if v_hash is null or encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')<>v_hash then return false; end if;
 delete from private.anime_search_cache_locks where cache_key=p_cache_key and owner_token=p_owner;
 get diagnostics v_count=row_count;
 return v_count>0;
end;
$$;
revoke all on function public.anime_search_cache_claim(text,uuid,text) from public;
revoke all on function public.anime_search_cache_release(text,uuid,text) from public;
grant execute on function public.anime_search_cache_claim(text,uuid,text) to anon,authenticated;
grant execute on function public.anime_search_cache_release(text,uuid,text) to anon,authenticated;
