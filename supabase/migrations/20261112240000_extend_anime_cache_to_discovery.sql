alter table private.anime_search_cache
  drop constraint if exists anime_search_cache_query_type_check;

alter table private.anime_search_cache
  add constraint anime_search_cache_query_type_check
  check (query_type in ('search', 'filters', 'discovery'));
