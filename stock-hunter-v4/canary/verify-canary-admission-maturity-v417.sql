-- Read-only verifier for Stock Hunter 4.1.7 Shadow Canary Telemetry / Admission.
-- Expected final row: stock-hunter-canary-admission-maturity-v417: PASS

do $$
declare
  tp public.stock_hunter_canary_telemetry_policy_v417%rowtype;
  ap public.stock_hunter_canary_admission_policy_v417%rowtype;
  ar public.stock_hunter_canary_admission_readiness_v417%rowtype;
  fn text;
  rls_qual text;
begin
  select * into strict tp from public.stock_hunter_canary_telemetry_policy_v417 where policy_id='default';
  select * into strict ap from public.stock_hunter_canary_admission_policy_v417 where policy_id='default';
  select * into strict ar from public.stock_hunter_canary_admission_readiness_v417 limit 1;

  if tp.protocol_version <> '4.1.7-canary-telemetry-v1'
     or tp.min_pairs_per_mode <> 100
     or tp.auto_kill then
    raise exception 'telemetry policy mismatch';
  end if;

  if ap.protocol_version <> '4.1.7-canary-admission-v1'
     or ap.min_pairs_per_mode <> 100
     or ap.min_symbols_per_mode <> 30
     or ap.min_buckets_per_mode <> 3
     or ap.max_telemetry_age_minutes <> 20
     or ap.required_recommendation <> 'PASS'
     or not ap.require_safe_champion_state
     or ap.auto_start then
    raise exception 'admission policy mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_canary_telemetry_policy_v417'::regclass
      and tgname='stock_hunter_canary_telemetry_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'telemetry policy immutability trigger missing';
  end if;

  if has_table_privilege('anon','public.stock_hunter_canary_telemetry_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_canary_telemetry_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_canary_telemetry_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'telemetry policy has unexpected write privilege';
  end if;

  if has_table_privilege('anon','public.stock_hunter_canary_monitor_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_canary_monitor_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'canary monitor view is not read-only';
  end if;

  if not has_table_privilege('anon','public.stock_hunter_canary_monitor_v417','SELECT')
     or not has_table_privilege('authenticated','public.stock_hunter_canary_monitor_v417','SELECT') then
    raise exception 'canary monitor SELECT contract missing';
  end if;

  if has_function_privilege('anon','public.capture_stock_hunter_canary_telemetry_v417()','EXECUTE')
     or has_function_privilege('authenticated','public.capture_stock_hunter_canary_telemetry_v417()','EXECUTE')
     or not has_function_privilege('service_role','public.capture_stock_hunter_canary_telemetry_v417()','EXECUTE') then
    raise exception 'canary capture function EXECUTE ACL mismatch';
  end if;

  select pg_get_functiondef('public.capture_stock_hunter_canary_telemetry_v417()'::regprocedure) into fn;
  if fn not like '%security invoker%'
     or fn not like '%SET search_path TO ''''%'
     or fn not like '%stock_hunter_shadow_samples_v416%'
     or fn not like '%s.observed_at >= v_reviewed_at%'
     or fn not like '%v_review_id is null%'
     or fn not like '%IDLE_NO_CHALLENGER%' then
    raise exception 'canary capture provenance/fail-closed contract mismatch';
  end if;

  select qual into rls_qual
  from pg_policies
  where schemaname='public' and tablename='stock_hunter_canary_telemetry_v417'
    and policyname='canary telemetry public read';
  if rls_qual is null or rls_qual not like '%activation_review_id%' then
    raise exception 'telemetry public-read RLS is not review-bound';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname='stock-hunter-canary-telemetry-v417'
      and active
      and command='select public.capture_stock_hunter_canary_telemetry_v417();'
  ) then
    raise exception 'canary telemetry cron missing/inactive';
  end if;

  if ar.activation_review_id is null then
    if ar.admission_ready
       or ar.admission_reason <> 'NO_ACTIVATION_REVIEW_BOUND'
       or ar.min_pairs_observed <> 0
       or ar.min_symbols_observed <> 0
       or ar.min_buckets_observed <> 0
       or ar.telemetry_recommendation <> 'IDLE_NO_CHALLENGER' then
      raise exception 'pre-review Canary state is not fail-closed/zero-natural';
    end if;
  end if;
end $$;

select 'stock-hunter-canary-admission-maturity-v417: PASS' as result;
