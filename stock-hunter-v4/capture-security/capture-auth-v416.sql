-- Stock Hunter 4.1.6 capture auth contract.
-- Target project: summnepwuziwulzvpcms
-- This file intentionally contains no secret value.
-- Review before applying; it documents and enforces the security boundary audited on 2026-09-17.

CREATE OR REPLACE FUNCTION public.stock_hunter_validate_capture_token_v416(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select length(coalesce(p_token,'')) >= 32
     and exists (
       select 1
       from vault.decrypted_secrets v
       where v.name = 'stock_hunter_capture_token_v416'
         and v.decrypted_secret = p_token
     );
$function$;

REVOKE ALL ON FUNCTION public.stock_hunter_validate_capture_token_v416(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_hunter_validate_capture_token_v416(text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_stock_hunter_capture_v416() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stock_hunter_capture_v416() TO service_role;

REVOKE ALL ON FUNCTION public.finish_stock_hunter_capture_v416(integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_stock_hunter_capture_v416(integer,text) TO service_role;

ALTER TABLE public.stock_hunter_capture_state_v416 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_hunter_capture_state_v416 FROM PUBLIC, anon, authenticated;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'stock_hunter_capture_token_v416'
  ) THEN
    RAISE EXCEPTION 'capture auth contract failed: Vault secret metadata missing';
  END IF;

  IF has_function_privilege('anon', 'public.stock_hunter_validate_capture_token_v416(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stock_hunter_validate_capture_token_v416(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'capture auth contract failed: public roles can validate capture token';
  END IF;

  IF has_function_privilege('anon', 'public.claim_stock_hunter_capture_v416()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_stock_hunter_capture_v416()', 'EXECUTE') THEN
    RAISE EXCEPTION 'capture auth contract failed: public roles can claim capture';
  END IF;

  IF has_function_privilege('anon', 'public.finish_stock_hunter_capture_v416(integer,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finish_stock_hunter_capture_v416(integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'capture auth contract failed: public roles can finish capture';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.stock_hunter_validate_capture_token_v416(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.claim_stock_hunter_capture_v416()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.finish_stock_hunter_capture_v416(integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'capture auth contract failed: service_role missing required execute privilege';
  END IF;

  IF has_table_privilege('anon', 'public.stock_hunter_capture_state_v416', 'SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated', 'public.stock_hunter_capture_state_v416', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'capture auth contract failed: public role has capture-state DML privilege';
  END IF;
END;
$verify$;
