-- Stock Hunter 4.1.7 staged Canary live-close verifier.
-- No traffic mutation. Safe before the real Activation Review and during later staged Canary.
-- Expected final row: stock-hunter-staged-canary-live-close-v417: PASS

do $$
declare
  ap public.stock_hunter_activation_policy_v417%rowtype;
  st public.stock_hunter_activation_status_v417%rowtype;
  hp public.stock_hunter_canary_hold_rollback_policy_v417%rowtype;
  rp public.stock_hunter_canary_recovery_policy_v417%rowtype;
  rd text;
  md text;
  start_def text;
  advance_def text;
  expand_auth_def text;
  v_steps integer;
  v_api_exec integer;
  v_mutator_cron integer;
  v_bad_view_acl integer;
begin
  select * into strict ap
  from public.stock_hunter_activation_policy_v417
  where policy_id='default';

  select * into strict st
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if ap.protocol_version<>'4.1.7-production-activation-v1'
     or ap.champion_engine_version<>'4.1.6-hunt-v2'
     or ap.challenger_engine_version<>'4.1.7-proposed'
     or ap.initial_canary_percent<>5
     or ap.canary_steps is distinct from array[5,10,25,50]::integer[]
     or not ap.require_activation_review
     or not ap.require_manual_authorization
     or ap.require_pre_full_canary_percent<>50
     or ap.auto_activate
     or ap.auto_expand
     or not ap.runtime_routing_enabled then
    raise exception 'frozen staged Canary activation policy mismatch';
  end if;

  select count(*) into v_steps
  from public.stock_hunter_canary_expansion_policy_v417 p
  where p.policy_id='default'
    and p.protocol_version='4.1.7-canary-expansion-v1'
    and not p.auto_expand
    and p.required_recommendation='PASS'
    and p.max_telemetry_age_minutes=20
    and (
      (p.from_percent=5 and p.to_percent=10 and p.min_stage_minutes=30
       and p.min_routed_pairs_per_mode=30 and p.min_routed_symbols_per_mode=10 and p.min_routed_buckets_per_mode=3)
      or
      (p.from_percent=10 and p.to_percent=25 and p.min_stage_minutes=45
       and p.min_routed_pairs_per_mode=60 and p.min_routed_symbols_per_mode=15 and p.min_routed_buckets_per_mode=4)
      or
      (p.from_percent=25 and p.to_percent=50 and p.min_stage_minutes=60
       and p.min_routed_pairs_per_mode=100 and p.min_routed_symbols_per_mode=25 and p.min_routed_buckets_per_mode=6)
    );

  if v_steps<>3
     or (select count(*) from public.stock_hunter_canary_expansion_policy_v417 where policy_id='default')<>3 then
    raise exception 'frozen staged Canary expansion policy mismatch';
  end if;

  select * into strict hp
  from public.stock_hunter_canary_hold_rollback_policy_v417
  where policy_id='default';

  if hp.protocol_version<>'4.1.7-canary-hold-rollback-v1'
     or hp.hold_stale_after_minutes<>20
     or hp.rollback_stale_after_minutes<>40
     or hp.min_pairs_per_mode_for_rollback<>30
     or not hp.hold_on_capture_error
     or not hp.rollback_on_severe_breach
     or hp.auto_rollback then
    raise exception 'Hold/Rollback frozen policy mismatch';
  end if;

  select * into strict rp
  from public.stock_hunter_canary_recovery_policy_v417
  where policy_id='default';

  if rp.protocol_version<>'4.1.7-canary-recovery-v1'
     or rp.cooldown_minutes<>15
     or rp.required_consecutive_pass_captures<>3
     or rp.max_healthy_capture_gap_minutes<>10
     or not rp.block_same_review_after_rollback
     or rp.auto_recover then
    raise exception 'Recovery frozen policy mismatch';
  end if;

  select pg_get_viewdef('public.stock_hunter_canary_expansion_stage_metrics_v417'::regclass,true)
    into md;
  select pg_get_viewdef('public.stock_hunter_canary_expansion_readiness_v417'::regclass,true)
    into rd;

  if position('t.state_version = s_1.state_version' in md)=0
     or position('t.observed_at >= s_1.last_transition_at' in md)=0
     or position('stock_hunter_route_bucket_v417' in md)=0 then
    raise exception 'stage metrics are not bound to current state/stage/routing';
  end if;

  if position('last_routed_observed_at' in rd)=0
     or position('ROUTED_EVIDENCE_STALE' in rd)=0
     or position('last_success_at' in rd)=0
     or position('m.last_routed_observed_at >= s.last_transition_at' in rd)=0 then
    raise exception 'Expansion freshness is not bound to fresh routed evidence';
  end if;

  select pg_get_functiondef(
    'private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)'::regprocedure
  ) into start_def;
  select pg_get_functiondef(
    'private.advance_stock_hunter_canary_v417(bigint,integer,text)'::regprocedure
  ) into advance_def;
  select pg_get_functiondef(
    'private.authorize_stock_hunter_canary_expansion_v417(bigint,bigint,integer,text,text)'::regprocedure
  ) into expand_auth_def;

  if position('p_percent <> v_policy.initial_canary_percent' in start_def)=0
     or position('array[5,10,25,50]' in start_def)=0
     or position('canary admission gate recheck blocked start' in start_def)=0
     or position('authorization has already been consumed' in start_def)=0 then
    raise exception 'initial 5%% Canary/start authorization contract mismatch';
  end if;

  if position('from_percent=v_status.challenger_traffic_percent' in advance_def)=0
     or position('to_percent=p_percent' in advance_def)=0
     or position('canary expansion gate recheck blocked advance' in advance_def)=0
     or position('consumed_at is null' in advance_def)=0 then
    raise exception 'strict staged advance/one-shot authorization contract mismatch';
  end if;

  if position('requested expansion target does not match frozen next step' in expand_auth_def)=0
     or position('expansion readiness does not match current canary stage' in expand_auth_def)=0 then
    raise exception 'expansion authorization stage binding mismatch';
  end if;

  if not exists (
      select 1 from pg_trigger
      where tgrelid='private.stock_hunter_canary_expansion_authorizations_v417'::regclass
        and tgname='stock_hunter_canary_expansion_authorization_recovery_guard_v417'
        and tgenabled='O' and not tgisinternal
    )
    or not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_activation_status_v417'::regclass
        and tgname='stock_hunter_activation_recovery_guard_v417'
        and tgenabled='O' and not tgisinternal
    ) then
    raise exception 'Recovery gate is not enforced on expansion authorization/activation state';
  end if;

  select count(*) into v_api_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private'
    and p.proname in (
      'authorize_stock_hunter_canary_v417',
      'start_stock_hunter_canary_v417',
      'authorize_stock_hunter_canary_expansion_v417',
      'advance_stock_hunter_canary_v417',
      'rollback_stock_hunter_canary_v417'
    )
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
    );

  if v_api_exec<>0 then
    raise exception 'staged Canary mutator function exposed to API role';
  end if;

  select count(*) into v_mutator_cron
  from cron.job
  where active and (
       lower(command) like '%authorize_stock_hunter_canary%'
    or lower(command) like '%start_stock_hunter_canary%'
    or lower(command) like '%advance_stock_hunter_canary%'
    or lower(command) like '%rollback_stock_hunter_canary%'
    or lower(command) like '%activate_stock_hunter_challenger%'
  );

  if v_mutator_cron<>0 then
    raise exception 'automatic staged Canary mutator cron detected';
  end if;

  select count(*) into v_bad_view_acl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'stock_hunter_canary_expansion_stage_metrics_v417',
      'stock_hunter_canary_expansion_readiness_v417',
      'stock_hunter_canary_expansion_monitor_v417',
      'stock_hunter_canary_hold_rollback_gate_v417',
      'stock_hunter_canary_recovery_gate_v417'
    )
    and (
      not (coalesce(c.reloptions,'{}'::text[]) @> array['security_invoker=true']::text[])
      or has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
      or not has_table_privilege('anon',c.oid,'SELECT')
      or not has_table_privilege('authenticated',c.oid,'SELECT')
      or not has_table_privilege('service_role',c.oid,'SELECT')
    );

  if v_bad_view_acl<>0 then
    raise exception 'Canary observability views are not security-invoker SELECT-only';
  end if;

  if public.stock_hunter_route_bucket_v417(date '2026-09-19','1')<>65
     or public.stock_hunter_route_bucket_v417(date '2026-09-19','12345')<>49
     or public.stock_hunter_route_bucket_v417(date '2026-09-20','12345')<>97
     or public.stock_hunter_route_bucket_v417(date '2026-10-01','987654321')<>82
     or public.stock_hunter_route_bucket_v417(date '2026-09-19','ABC') is not null then
    raise exception 'SQL deterministic routing fixture mismatch';
  end if;

  -- Before any real Review is bound, the system must remain completely inactive.
  if st.activation_review_id is null then
    if st.routing_mode<>'CHAMPION_ONLY'
       or st.challenger_traffic_percent<>0
       or not st.kill_switch_engaged then
      raise exception 'pre-review activation state is not fail-closed';
    end if;

    if exists(select 1 from private.stock_hunter_activation_authorizations_v417)
       or exists(select 1 from private.stock_hunter_canary_expansion_authorizations_v417)
       or exists(select 1 from private.stock_hunter_activation_events_v417) then
      raise exception 'authorization/event residue exists before first real Activation Review';
    end if;

    if (select expansion_ready from public.stock_hunter_canary_expansion_readiness_v417 limit 1) then
      raise exception 'Expansion is unexpectedly ready before first Activation Review';
    end if;
  end if;
end $$;

select 'stock-hunter-staged-canary-live-close-v417: PASS' as result;
