create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.anime_search_cache_config (
  singleton boolean primary key default true check (singleton),
  token_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.anime_search_cache_config from public, anon, authenticated;

create table if not exists private.anime_search_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  query_type text not null check (query_type in ('search','filters')),
  filters jsonb not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_accessed_at timestamptz not null default now(),
  hit_count bigint not null default 0 check (hit_count >= 0),
  byte_size integer not null default 0 check (byte_size >= 0)
);
create index if not exists anime_search_cache_expiry_idx on private.anime_search_cache (expires_at);
create index if not exists anime_search_cache_access_idx on private.anime_search_cache (last_accessed_at);
revoke all on private.anime_search_cache from public, anon, authenticated;

create or replace function public.anime_search_cache_get(p_cache_key text, p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_payload jsonb; v_hash text;
begin
  if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_token is null or length(p_token) < 32 then return null; end if;
  select c.token_hash into v_hash from private.anime_search_cache_config c where c.singleton = true;
  if v_hash is null or encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex') <> v_hash then return null; end if;
  update private.anime_search_cache c set hit_count=c.hit_count+1,last_accessed_at=now()
  where c.cache_key=p_cache_key and c.expires_at>now() returning c.payload into v_payload;
  return v_payload;
end;
$$;

create or replace function public.anime_search_cache_put(p_cache_key text,p_query_type text,p_filters jsonb,p_payload jsonb,p_ttl_seconds integer,p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_hash text; v_bytes integer;
begin
  if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_query_type not in ('search','filters')
    or p_filters is null or pg_catalog.jsonb_typeof(p_filters)<>'object'
    or p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object'
    or p_ttl_seconds<60 or p_ttl_seconds>86400 or p_token is null or length(p_token)<32 then return false; end if;
  select c.token_hash into v_hash from private.anime_search_cache_config c where c.singleton=true;
  if v_hash is null or encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')<>v_hash then return false; end if;
  v_bytes:=pg_catalog.octet_length(p_payload::text);
  if v_bytes>2000000 then return false; end if;
  insert into private.anime_search_cache(cache_key,query_type,filters,payload,expires_at,byte_size,created_at,last_accessed_at,hit_count)
  values(p_cache_key,p_query_type,p_filters,p_payload,now()+pg_catalog.make_interval(secs=>p_ttl_seconds),v_bytes,now(),now(),0)
  on conflict(cache_key) do update set query_type=excluded.query_type,filters=excluded.filters,payload=excluded.payload,
    expires_at=excluded.expires_at,byte_size=excluded.byte_size,created_at=now(),last_accessed_at=now(),hit_count=0;
  delete from private.anime_search_cache where cache_key in
    (select cache_key from private.anime_search_cache where expires_at<now() order by expires_at limit 100);
  return true;
end;
$$;

revoke all on function public.anime_search_cache_get(text,text) from public;
revoke all on function public.anime_search_cache_put(text,text,jsonb,jsonb,integer,text) from public;
grant execute on function public.anime_search_cache_get(text,text) to anon,authenticated;
grant execute on function public.anime_search_cache_put(text,text,jsonb,jsonb,integer,text) to anon,authenticated;
