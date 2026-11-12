create or replace function private.is_anime_search_cache_token()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_hash text; v_token text;
begin
  v_token := coalesce(pg_catalog.current_setting('request.headers', true), '{}')::jsonb ->> 'x-cache-token';
  if v_token is null or length(v_token) < 32 then return false; end if;
  select token_hash into v_hash from private.anime_search_cache_config where singleton = true;
  return v_hash is not null and encode(pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')), 'hex') = v_hash;
end;
$$;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_anime_search_cache_token() to anon, authenticated;
alter table private.anime_search_cache enable row level security;
alter table private.anime_search_cache_locks enable row level security;
drop policy if exists anime_search_cache_server_access on private.anime_search_cache;
create policy anime_search_cache_server_access on private.anime_search_cache for all to anon,authenticated using ((select private.is_anime_search_cache_token())) with check ((select private.is_anime_search_cache_token()));
drop policy if exists anime_search_cache_locks_server_access on private.anime_search_cache_locks;
create policy anime_search_cache_locks_server_access on private.anime_search_cache_locks for all to anon,authenticated using ((select private.is_anime_search_cache_token())) with check ((select private.is_anime_search_cache_token()));
grant select,insert,update,delete on private.anime_search_cache to anon,authenticated;
grant select,insert,update,delete on private.anime_search_cache_locks to anon,authenticated;
drop function if exists public.anime_search_cache_get(text,text);
drop function if exists public.anime_search_cache_put(text,text,jsonb,jsonb,integer,text);
drop function if exists public.anime_search_cache_claim(text,uuid,text);
drop function if exists public.anime_search_cache_release(text,uuid,text);
create function public.anime_search_cache_get(p_cache_key text) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_payload jsonb;
begin
 if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' then return null; end if;
 update private.anime_search_cache c set hit_count=c.hit_count+1,last_accessed_at=now() where c.cache_key=p_cache_key and c.expires_at>now() returning c.payload into v_payload;
 return v_payload;
end; $$;
create function public.anime_search_cache_put(p_cache_key text,p_query_type text,p_filters jsonb,p_payload jsonb,p_ttl_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_bytes integer;
begin
 if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_query_type not in ('search','filters') or p_filters is null or pg_catalog.jsonb_typeof(p_filters)<>'object' or p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' or p_ttl_seconds<60 or p_ttl_seconds>86400 then return false; end if;
 v_bytes:=pg_catalog.octet_length(p_payload::text); if v_bytes>2000000 then return false; end if;
 insert into private.anime_search_cache(cache_key,query_type,filters,payload,expires_at,byte_size,created_at,last_accessed_at,hit_count)
 values(p_cache_key,p_query_type,p_filters,p_payload,now()+pg_catalog.make_interval(secs=>p_ttl_seconds),v_bytes,now(),now(),0)
 on conflict(cache_key) do update set query_type=excluded.query_type,filters=excluded.filters,payload=excluded.payload,expires_at=excluded.expires_at,byte_size=excluded.byte_size,created_at=now(),last_accessed_at=now(),hit_count=0;
 delete from private.anime_search_cache where cache_key in (select cache_key from private.anime_search_cache where expires_at<now() order by expires_at limit 100);
 return true;
end; $$;
create function public.anime_search_cache_claim(p_cache_key text,p_owner uuid) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_owner is null then return false; end if;
 insert into private.anime_search_cache_locks(cache_key,owner_token,expires_at) values(p_cache_key,p_owner,now()+interval '25 seconds')
 on conflict(cache_key) do update set owner_token=excluded.owner_token,expires_at=excluded.expires_at where private.anime_search_cache_locks.expires_at<=now();
 return exists(select 1 from private.anime_search_cache_locks where cache_key=p_cache_key and owner_token=p_owner);
end; $$;
create function public.anime_search_cache_release(p_cache_key text,p_owner uuid) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
 if p_cache_key is null or p_owner is null then return false; end if;
 delete from private.anime_search_cache_locks where cache_key=p_cache_key and owner_token=p_owner;
 get diagnostics v_count=row_count; return v_count>0;
end; $$;
revoke all on function public.anime_search_cache_get(text) from public;
revoke all on function public.anime_search_cache_put(text,text,jsonb,jsonb,integer) from public;
revoke all on function public.anime_search_cache_claim(text,uuid) from public;
revoke all on function public.anime_search_cache_release(text,uuid) from public;
grant execute on function public.anime_search_cache_get(text) to anon,authenticated;
grant execute on function public.anime_search_cache_put(text,text,jsonb,jsonb,integer) to anon,authenticated;
grant execute on function public.anime_search_cache_claim(text,uuid) to anon,authenticated;
grant execute on function public.anime_search_cache_release(text,uuid) to anon,authenticated;
