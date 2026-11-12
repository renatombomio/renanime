create or replace function public.anime_search_cache_put(
  p_cache_key text,
  p_query_type text,
  p_filters jsonb,
  p_payload jsonb,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bytes integer;
begin
  if p_cache_key is null
    or p_cache_key !~ '^[a-f0-9]{64}$'
    or p_query_type not in ('search', 'filters', 'discovery')
    or p_filters is null
    or pg_catalog.jsonb_typeof(p_filters) <> 'object'
    or p_payload is null
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or p_ttl_seconds < 60
    or p_ttl_seconds > 86400
  then
    return false;
  end if;

  v_bytes := pg_catalog.octet_length(p_payload::text);
  if v_bytes > 2000000 then return false; end if;

  insert into private.anime_search_cache(
    cache_key, query_type, filters, payload, expires_at, byte_size,
    created_at, last_accessed_at, hit_count
  )
  values (
    p_cache_key, p_query_type, p_filters, p_payload,
    now() + pg_catalog.make_interval(secs => p_ttl_seconds),
    v_bytes, now(), now(), 0
  )
  on conflict (cache_key) do update set
    query_type = excluded.query_type,
    filters = excluded.filters,
    payload = excluded.payload,
    expires_at = excluded.expires_at,
    byte_size = excluded.byte_size,
    created_at = now(),
    last_accessed_at = now(),
    hit_count = 0;

  delete from private.anime_search_cache
  where cache_key in (
    select cache_key from private.anime_search_cache
    where expires_at < now()
    order by expires_at
    limit 100
  );
  return true;
end;
$$;
