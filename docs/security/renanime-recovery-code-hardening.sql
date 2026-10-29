-- Renanime 2.0 security migration
-- Apply only after the matching application code has been deployed and smoke-tested.
-- Existing recovery_code_hash values are preserved, so existing users keep their current recovery codes.
-- New recovery codes have 128 bits of random entropy and are shown only once at registration.

BEGIN;

CREATE OR REPLACE FUNCTION public.renanime_register(
  p_access_password text,
  p_name text,
  p_aka text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  new_user public.renanime_users;
  raw_code text;
  raw_token text;
  code_hex text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.renanime_access
    WHERE id = true
      AND password_hash = extensions.crypt(p_access_password, password_hash)
  ) THEN
    RAISE EXCEPTION 'INVALID_ACCESS_PASSWORD';
  END IF;

  IF trim(p_name) = '' OR trim(p_aka) = '' THEN
    RAISE EXCEPTION 'INVALID_PROFILE';
  END IF;

  IF char_length(trim(p_name)) > 80 OR char_length(trim(p_aka)) > 40
     OR char_length(trim(p_aka)) < 2 THEN
    RAISE EXCEPTION 'INVALID_PROFILE';
  END IF;

  IF lower(trim(p_name)) = lower(trim(p_aka)) THEN
    RAISE EXCEPTION 'SAME_NAME_AKA';
  END IF;

  code_hex := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  raw_code := 'REN-' || substr(code_hex, 1, 8) || '-' ||
              substr(code_hex, 9, 8) || '-' ||
              substr(code_hex, 17, 8) || '-' ||
              substr(code_hex, 25, 8);

  INSERT INTO public.renanime_users(name, aka, recovery_code_hash)
  VALUES (
    trim(p_name),
    trim(p_aka),
    encode(extensions.digest(raw_code, 'sha256'), 'hex')
  )
  RETURNING * INTO new_user;

  raw_token := public.renanime_issue_session(new_user.id);

  RETURN jsonb_build_object(
    'id', new_user.id,
    'name', new_user.name,
    'aka', new_user.aka,
    'recovery_code', raw_code,
    'session_token', raw_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.renanime_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  found_user public.renanime_users;
BEGIN
  SELECT u.*
  INTO found_user
  FROM public.renanime_sessions s
  JOIN public.renanime_users u ON u.id = s.user_id
  WHERE s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  IF found_user.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.renanime_sessions
  SET last_seen_at = now()
  WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'id', found_user.id,
    'name', found_user.name,
    'aka', found_user.aka,
    'created_at', found_user.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.renanime_recover(p_recovery_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  found_user public.renanime_users;
  raw_token text;
BEGIN
  SELECT *
  INTO found_user
  FROM public.renanime_users
  WHERE recovery_code_hash =
    encode(extensions.digest(upper(trim(p_recovery_code)), 'sha256'), 'hex')
  LIMIT 1;

  IF found_user.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_RECOVERY_CODE';
  END IF;

  raw_token := public.renanime_issue_session(found_user.id);

  RETURN jsonb_build_object(
    'id', found_user.id,
    'name', found_user.name,
    'aka', found_user.aka,
    'session_token', raw_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.renanime_profile(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  found_user public.renanime_users;
  library jsonb;
BEGIN
  SELECT u.*
  INTO found_user
  FROM public.renanime_sessions s
  JOIN public.renanime_users u ON u.id = s.user_id
  WHERE s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  IF found_user.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SESSION';
  END IF;

  UPDATE public.renanime_sessions
  SET last_seen_at = now()
  WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'animeId', anime_id,
        'format', format,
        'franchiseId', franchise_id,
        'state', state
      )
      ORDER BY updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO library
  FROM public.renanime_library
  WHERE user_id = found_user.id;

  RETURN jsonb_build_object(
    'id', found_user.id,
    'name', found_user.name,
    'aka', found_user.aka,
    'created_at', found_user.created_at,
    'library', library
  );
END;
$function$;

-- Remove obsolete overloads no longer used by the application.
DROP FUNCTION IF EXISTS public.renanime_register(text, text);
DROP FUNCTION IF EXISTS public.renanime_recover(text, text);

-- Remove the plaintext copy only after all live functions have stopped referencing it.
ALTER TABLE public.renanime_users DROP COLUMN IF EXISTS recovery_code;

COMMIT;
