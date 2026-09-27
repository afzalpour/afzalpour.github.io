-- Stock Hunter 4.1.7 security advisor verification contract.
-- Read-only assertions: this script must not mutate production state.

DO $$
DECLARE
  normalize_oid oid := 'public.stock_hunter_normalize_fa_v4(text)'::regprocedure;
  feed_oid oid := 'public.stock_hunter_feed_status_v4()'::regprocedure;
  sync_oid oid := 'public.stock_hunter_sync_signal_to_universe_v4()'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.oid = normalize_oid
      AND NOT p.prosecdef
      AND p.proconfig IS NOT NULL
      AND 'search_path=pg_catalog' = ANY (p.proconfig)
  ) THEN
    RAISE EXCEPTION 'stock_hunter_normalize_fa_v4 must be SECURITY INVOKER with search_path=pg_catalog';
  END IF;

  IF has_function_privilege('anon', feed_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', feed_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'stock_hunter_feed_status_v4 must not be executable by anon/authenticated';
  END IF;

  IF has_function_privilege('anon', sync_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', sync_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'stock_hunter_sync_signal_to_universe_v4 must not be executable by anon/authenticated';
  END IF;

  IF NOT has_function_privilege('service_role', feed_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', sync_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must retain execute on internal Stock Hunter functions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'stock_hunter%'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'a public Stock Hunter SECURITY DEFINER function is executable by anon/authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT tg.tgisinternal
      AND tg.tgname = 'trg_stock_hunter_sync_signal_to_universe_v4'
      AND p.oid = sync_oid
      AND n.nspname = 'public'
      AND c.relname = 'stock_hunter_signals_v4'
  ) THEN
    RAISE EXCEPTION 'signal-to-universe trigger dependency is missing';
  END IF;
END
$$;

SELECT 'stock-hunter-security-advisor-cleanup-v417: PASS' AS result;
