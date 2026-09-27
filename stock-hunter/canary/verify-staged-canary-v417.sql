-- Read-only verifier for Stock Hunter 4.1.7 staged Canary 5 -> 10 -> 25 -> 50.
-- Expected final row: stock-hunter-staged-canary-v417: PASS

do $$
declare
  ap public.stock_hunter_activation_policy_v417%rowtype;
  adm public.stock_hunter_canary_admission_policy_v417%rowtype;
  hp public.stock_hunter_canary_hold_rollback_policy_v417%rowtype;
  rp public.stock_hunter_canary_recovery_policy_v417%rowtype;
  s public.stock_hunter_activation_status_v417%rowtype;
  r public.stock_hunter_canary_admission_readiness_v417%rowtype;
  v_count integer;
begin
  select * into strict ap from public.stock_hunter_activation_policy_v417 where policy_id='default';
  select * into strict adm from public.stock_hunter_canary_admission_policy_v417 where policy_id='default';
  select * into strict hp from public.stock_hunter_canary_hold_rollback_policy_v417 where policy_id='default';
  select * into strict rp from public.stock_hunter_canary_recovery_policy_v417 where policy_id='default';
  select * into strict s from public.stock_hunter_activation_status_v417 where status_id='default';
  select * into strict r from public.stock_hunter_canary_admission_readiness_v417 limit 1;

  if ap.canary_steps is distinct from array[5,10,25,50]::integer[]
     or ap.initial_canary_percent<>5
     or ap.require_pre_full_canary_percent<>50
     or not ap.require_activation_review
     or not ap.require_manual_authorization
     or not ap.runtime_routing_enabled
     or ap.auto_activate
     or ap.auto_expand then
    raise exception 'activation policy staged/manual contract mismatch';
  end if;

  if adm.min_pairs_per_mode<>100
     or adm.min_symbols_per_mode<>30
     or adm.min_buckets_per_mode<>3
     or adm.max_telemetry_age_minutes<>20
     or adm.required_recommendation<>'PASS'
     or adm.auto_start then
    raise exception 'initial Canary admission policy mismatch';
  end if;

  select count(*) into v_count
  from public.stock_hunter_canary_expansion_policy_v417
  where policy_id='default'
    and (
      (from_percent=5 and to_percent=10 and min_stage_minutes=30 and min_routed_pairs_per_mode=30 and min_routed_symbols_per_mode=10 and min_routed_buckets_per_mode=3)
      or (from_percent=10 and to_percent=25 and min_stage_minutes=45 and min_routed_pairs_per_mode=60 and min_routed_symbols_per_mode=15 and min_routed_buckets_per_mode=4)
      or (from_percent=25 and to_percent=50 and min_stage_minutes=60 and min_routed_pairs_per_mode=100 and min_routed_symbols_per_mode=25 and min_routed_buckets_per_mode=6)
    )
    and max_telemetry_age_minutes=20
    and required_recommendation='PASS'
    and not auto_expand;
  if v_count<>3 or (select count(*) from public.stock_hunter_canary_expansion_policy_v417 where policy_id='default')<>3 then
    raise exception 'staged Canary expansion sequence/policy mismatch';
  end if;

  if hp.auto_rollback or not hp.hold_on_capture_error or not hp.rollback_on_severe_breach
     or rp.auto_recover or not rp.block_same_review_after_rollback then
    raise exception 'hold/rollback/recovery manual safety contract mismatch';
  end if;

  if to_regclass('private.stock_hunter_activation_authorization_consumptions_v417') is null then
    raise exception 'initial Canary authorization consumption ledger missing';
  end if;
  if has_table_privilege('anon','private.stock_hunter_activation_authorization_consumptions_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','private.stock_hunter_activation_authorization_consumptions_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','private.stock_hunter_activation_authorization_consumptions_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'initial authorization consumption ledger exposed to API/service roles';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_activation_authorization_consumptions_v417'::regclass
      and tgname='stock_hunter_activation_authorization_consumption_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_canary_expansion_authorizations_v417'::regclass
      and tgname='stock_hunter_canary_expansion_authorization_recovery_guard_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'one-shot/recovery trigger contract missing';
  end if;

  if has_function_privilege('anon','private.authorize_stock_hunter_canary_v417(bigint,text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.authorize_stock_hunter_canary_v417(bigint,text,text)','EXECUTE')
     or has_function_privilege('service_role','private.authorize_stock_hunter_canary_v417(bigint,text,text)','EXECUTE')
     or has_function_privilege('anon','private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)','EXECUTE')
     or has_function_privilege('authenticated','private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)','EXECUTE')
     or has_function_privilege('service_role','private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)','EXECUTE')
     or has_function_privilege('anon','private.authorize_stock_hunter_canary_expansion_v417(bigint,bigint,integer,text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.authorize_stock_hunter_canary_expansion_v417(bigint,bigint,integer,text,text)','EXECUTE')
     or has_function_privilege('service_role','private.authorize_stock_hunter_canary_expansion_v417(bigint,bigint,integer,text,text)','EXECUTE')
     or has_function_privilege('anon','private.advance_stock_hunter_canary_v417(bigint,integer,text)','EXECUTE')
     or has_function_privilege('authenticated','private.advance_stock_hunter_canary_v417(bigint,integer,text)','EXECUTE')
     or has_function_privilege('service_role','private.advance_stock_hunter_canary_v417(bigint,integer,text)','EXECUTE') then
    raise exception 'Canary mutation function unexpectedly executable by API/service role';
  end if;

  if not has_function_privilege('postgres','private.authorize_stock_hunter_canary_v417(bigint,text,text)','EXECUTE')
     or not has_function_privilege('postgres','private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)','EXECUTE')
     or not has_function_privilege('postgres','private.authorize_stock_hunter_canary_expansion_v417(bigint,bigint,integer,text,text)','EXECUTE')
     or not has_function_privilege('postgres','private.advance_stock_hunter_canary_v417(bigint,integer,text)','EXECUTE') then
    raise exception 'manual postgres control-plane execution contract missing';
  end if;

  if position('stock_hunter_activation_authorization_consumptions_v417' in pg_get_functiondef('private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)'::regprocedure))=0
     or position('v_authorized_state_version is distinct from v_status.state_version' in pg_get_functiondef('private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)'::regprocedure))=0
     or position('canary admission gate recheck blocked start' in pg_get_functiondef('private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)'::regprocedure))=0 then
    raise exception 'initial Canary start one-shot/state/admission recheck contract missing';
  end if;

  if exists (
    select 1
    from private.stock_hunter_activation_authorization_consumptions_v417 c
    left join private.stock_hunter_activation_events_v417 e
      on e.authorization_id=c.authorization_id and e.review_id=c.review_id and e.event_type='CANARY_STARTED'
    where e.event_id is null
  ) then
    raise exception 'authorization consumption exists without CANARY_STARTED audit event';
  end if;

  if s.activation_review_id is null then
    if s.routing_mode<>'CHAMPION_ONLY' or s.challenger_traffic_percent<>0 or not s.kill_switch_engaged
       or r.admission_ready or r.admission_reason<>'NO_ACTIVATION_REVIEW_BOUND' then
      raise exception 'pre-review Canary state is not fail-closed';
    end if;
  end if;
end $$;

select 'stock-hunter-staged-canary-v417: PASS' as result;
