-- Allow the public anime detail endpoint to cache AniList character metadata
-- without a Supabase service-role/secret key. Writes are constrained to a
-- single anime and a maximum of 25 validated AniList character records per call.
create or replace function public.sync_anime_character_catalog(
  p_anime_id integer,
  p_characters jsonb,
  p_relations jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_character jsonb;
  v_relation jsonb;
  v_id integer;
  v_name text;
  v_image_url text;
  v_role text;
  v_sort_order integer;
begin
  if p_anime_id is null or p_anime_id <= 0 then
    raise exception 'Invalid anime id';
  end if;

  if jsonb_typeof(p_characters) <> 'array'
     or jsonb_typeof(p_relations) <> 'array'
     or jsonb_array_length(p_characters) > 25
     or jsonb_array_length(p_relations) > 25
     or jsonb_array_length(p_characters) <> jsonb_array_length(p_relations) then
    raise exception 'Invalid character batch';
  end if;

  for v_character in select value from jsonb_array_elements(p_characters)
  loop
    v_id := (v_character->>'id')::integer;
    v_name := btrim(v_character->>'name');
    v_image_url := nullif(v_character->>'image_url', '');

    if v_id is null or v_id <= 0 or v_name is null or length(v_name) = 0 or length(v_name) > 160 then
      raise exception 'Invalid character metadata';
    end if;

    if v_image_url is not null and v_image_url !~ '^https://(s[0-9]+\.)?anilist\.co/[^[:space:]]+$' then
      raise exception 'Invalid character image URL';
    end if;

    insert into public.characters (id, name, image_url, updated_at)
    values (v_id, v_name, v_image_url, now())
    on conflict (id) do update
      set name = excluded.name,
          image_url = excluded.image_url,
          updated_at = now();
  end loop;

  for v_relation in select value from jsonb_array_elements(p_relations)
  loop
    v_id := (v_relation->>'character_id')::integer;
    v_role := nullif(v_relation->>'role', '');
    v_sort_order := (v_relation->>'sort_order')::integer;

    if v_role is not null and v_role not in ('MAIN', 'SUPPORTING', 'BACKGROUND') then
      v_role := null;
    end if;

    if v_id is null or v_id <= 0 or v_sort_order is null or v_sort_order < 0 then
      raise exception 'Invalid anime character relation';
    end if;

    insert into public.anime_characters (anime_id, character_id, role, sort_order, updated_at)
    values (p_anime_id, v_id, v_role, v_sort_order, now())
    on conflict (anime_id, character_id) do update
      set role = excluded.role,
          sort_order = excluded.sort_order,
          updated_at = now();
  end loop;
end;
$function$;

revoke all on function public.sync_anime_character_catalog(integer, jsonb, jsonb) from public;
grant execute on function public.sync_anime_character_catalog(integer, jsonb, jsonb) to anon, authenticated;
