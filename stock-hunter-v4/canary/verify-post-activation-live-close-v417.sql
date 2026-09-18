-- Stock Hunter 4.1.7 post-activation monitoring / stability live-close verifier.
-- Safe before Full Activation and during later stability monitoring.
-- Expected final row: stock-hunter-post-activation-live-close-v417: PASS

do $$
declare
  p public.stock_hunter_post_activation_policy_v417%rowtype;
  m public.stock_hunter_post_activation_monitor_v417%rowtype;
  s public.stock_hunter_activation_status_v417%rowtype;
  d text;
  rollback_def text;
  capture_def text;
  release_def text;
  v_bad_cron integer;
begin
  select * into strict p
  from public.stock_hunter_post_activation_policy_v417
  where policy_id='default';

  if p.protocol_version<>'4.1.7-post-activation-v1'
     or p.min_stability_trade_dates<>5
     or p.min_pairs_per_mode<>500
     or p.min_symbols_per_mode<>75
     or p.min_buckets_per_mode<>8
     or p.max_telemetry_age_minutes<>15
     or p.required_recommendation<>'PASS'
     or p.auto_rollback
     or p.auto_finalize then
    raise exception 'post-activation frozen policy mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_post_activation_policy_v417'::regclass
      and tgname='stock_hunter_post_activation_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'post-activation policy immutability trigger missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.stock_hunter_post_activation_policy_v417'::regclass
      and conname='stock_hunter_post_activation_policy_v417_frozen_contract'
  ) then
    raise exception 'post-activation frozen policy CHECK missing';
  end if;

  if has_table_privilege('anon','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'post-activation policy unexpectedly writable by API role';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_post_activation_monitor_v417'::regclass
      and relkind='v'
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'post-activation monitor must be security_invoker';
  end if;

  if (select count(*) from pg_attribute
      where attrelid='public.stock_hunter_post_activation_monitor_v417'::regclass
        and attnum>0 and not attisdropped)<>54 then
    raise exception 'post-activation monitor output contract drifted';
  end if;

  if has_table_privilege('anon','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or not has_table_privilege('anon','public.stock_hunter_post_activation_monitor_v417','SELECT')
     or not has_table_privilege('authenticated','public.stock_hunter_post_activation_monitor_v417','SELECT')
     or not has_table_privilege('service_role','public.stock_hunter_post_activation_monitor_v417','SELECT') then
    raise exception 'post-activation monitor is not SELECT-only';
  end if;

  select pg_get_viewdef('public.stock_hunter_post_activation_monitor_v417'::regclass,true)
    into d;

  if position('t.activation_review_id = s1.activation_review_id' in replace(d,'s_1','s1'))=0
     or position('t.state_version = s1.state_version' in replace(d,'s_1','s1'))=0
     or position('t.observed_at >= s1.last_transition_at' in replace(d,'s_1','s1'))=0 then
    raise exception 'post-activation telemetry provenance is not current-state prospective';
  end if;

  if position('recommendation = ''STABLE''' in d)=0
     or position('THEN ''PASS''' in d)=0 then
    raise exception 'healthy STABLE telemetry is not normalized to post-activation PASS';
  end if;

  if position('min_mode_last_observed_at' in d)=0
     or position('min_recommendation_observed_at' in d)=0
     or position('POST_ACTIVATION_ROUTED_EVIDENCE_STALE' in d)=0
     or position('POST_ACTIVATION_RECOMMENDATION_EVIDENCE_STALE' in d)=0 then
    raise exception 'post-activation two-mode evidence freshness contract is incomplete';
  end if;

  if position('4.1.6-hunt-v2' in d)=0
     or position('pass_rollback_target_preserved' in d)=0
     or position('NOT P.AUTO_ROLLBACK' in upper(d))=0
     or position('NOT RB.AUTO_ROLLBACK' in upper(d))=0
     or position('NOT P.AUTO_FINALIZE' in upper(d))=0 then
    raise exception 'rollback-target/manual-only stability contract mismatch';
  end if;

  select pg_get_functiondef(
    'private.rollback_stock_hunter_canary_v417(bigint,text)'::regprocedure
  ) into rollback_def;

  if position('CHALLENGER_ONLY' in rollback_def)=0
     or position('state_version <> p_expected_state_version' in rollback_def)=0
     or position('routing_mode=''ROLLED_BACK''' in rollback_def)=0
     or position('challenger_traffic_percent=0' in rollback_def)=0
     or position('kill_switch_engaged=true' in rollback_def)=0 then
    raise exception 'manual post-activation rollback path does not restore Champion-only safe routing';
  end if;

  if has_function_privilege('anon','private.rollback_stock_hunter_canary_v417(bigint,text)','EXECUTE')
     or has_function_privilege('authenticated','private.rollback_stock_hunter_canary_v417(bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.rollback_stock_hunter_canary_v417(bigint,text)','EXECUTE')
     or not has_function_privilege('postgres','private.rollback_stock_hunter_canary_v417(bigint,text)','EXECUTE') then
    raise exception 'manual rollback function ACL mismatch';
  end if;

  select pg_get_functiondef('public.capture_stock_hunter_canary_telemetry_v417()'::regprocedure)
    into capture_def;

  if position('s.activation_review_id' in capture_def)=0
     or position('s.state_version' in capture_def)=0
     or position('s.observed_at >= v_reviewed_at' in capture_def)=0
     or position('routing_mode' in lower(capture_def))>0 then
    raise exception 'telemetry capture cannot safely continue through 100 percent post-activation monitoring';
  end if;

  select pg_get_functiondef(
    'private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text,text)'::regprocedure
  ) into release_def;

  if position('stock_hunter_post_activation_monitor_v417' in release_def)=0
     or position('stabilization_ready_for_version_promotion' in release_def)=0
     or position('post-activation stabilization blocked release preparation' in release_def)=0 then
    raise exception 'release-pin consumer is not bound to post-activation stability';
  end if;

  select count(*) into v_bad_cron
  from cron.job
  where active and (
       lower(command) like '%rollback_stock_hunter%'
    or lower(command) like '%kill_switch_stock_hunter%'
    or lower(command) like '%prepare_stock_hunter_release_pin%'
    or lower(command) like '%finalize%'
  );

  if v_bad_cron<>0 then
    raise exception 'automatic rollback/finalization/release-pin cron detected';
  end if;

  select * into strict m
  from public.stock_hunter_post_activation_monitor_v417;

  if m.rollback_target_engine_version<>'4.1.6-hunt-v2'
     or not m.pass_rollback_target_preserved
     or not m.pass_automatic_rollback_off
     or m.auto_rollback
     or m.auto_finalize
     or m.automatic_action_taken then
    raise exception 'post-activation rollback/manual-only live state mismatch';
  end if;

  select * into strict s
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if s.routing_mode<>'CHALLENGER_ONLY' or s.challenger_traffic_percent<>100 then
    if m.stabilization_ready_for_version_promotion
       or m.stabilization_reason<>'NOT_AT_FULL_ACTIVATION' then
      raise exception 'pre-full-activation post-monitor does not fail closed';
    end if;
  end if;

  if s.state_version=1 and s.activation_review_id is null then
    if exists(select 1 from private.stock_hunter_activation_events_v417) then
      raise exception 'unexpected activation-event residue before real lifecycle progression';
    end if;
  end if;
end $$;

select 'stock-hunter-post-activation-live-close-v417: PASS' as result;
