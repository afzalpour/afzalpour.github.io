-- Read-only verifier for Stock Hunter 4.1.7 Post-Activation Monitoring.
-- Expected final row: stock-hunter-post-activation-monitoring-v417: PASS

do $$
declare
  p public.stock_hunter_post_activation_policy_v417%rowtype;
  m public.stock_hunter_post_activation_monitor_v417%rowtype;
  view_def text;
begin
  select * into strict p
  from public.stock_hunter_post_activation_policy_v417
  where policy_id='default';

  select * into strict m
  from public.stock_hunter_post_activation_monitor_v417;

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
    select 1
    from pg_trigger
    where tgrelid='public.stock_hunter_post_activation_policy_v417'::regclass
      and tgname='stock_hunter_post_activation_policy_immutable_v417'
      and tgenabled='O'
      and not tgisinternal
  ) then
    raise exception 'post-activation policy immutability trigger missing';
  end if;

  if has_table_privilege('anon','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_post_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'post-activation policy has unexpected API write privilege';
  end if;

  if not has_table_privilege('anon','public.stock_hunter_post_activation_monitor_v417','SELECT')
     or not has_table_privilege('authenticated','public.stock_hunter_post_activation_monitor_v417','SELECT')
     or has_table_privilege('anon','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.stock_hunter_post_activation_monitor_v417','INSERT,UPDATE,DELETE') then
    raise exception 'post-activation monitor is not read-only';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid='public.stock_hunter_post_activation_monitor_v417'::regclass
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'post-activation monitor is not security_invoker';
  end if;

  select pg_get_viewdef('public.stock_hunter_post_activation_monitor_v417'::regclass,true)
  into view_def;

  if position('activation_review_id' in view_def)=0
     or position('state_version' in view_def)=0
     or position('observed_at >= ' in view_def)=0
     or position('last_transition_at' in view_def)=0
     or position('min_stability_trade_dates' in view_def)=0
     or position('min_pairs_per_mode' in view_def)=0
     or position('min_symbols_per_mode' in view_def)=0
     or position('min_buckets_per_mode' in view_def)=0
     or position('pass_rollback_target_preserved' in view_def)=0
     or position('auto_rollback' in view_def)=0
     or position('auto_finalize' in view_def)=0
     or position('incident_started_at' in view_def)=0
     or position('READY_FOR_MANUAL_VERSION_PROMOTION_REVIEW' in view_def)=0
     or position('min_mode_last_observed_at' in view_def)=0
     or position('min_recommendation_observed_at' in view_def)=0 then
    raise exception 'post-activation provenance/stability contract mismatch';
  end if;

  if m.rollback_target_engine_version<>'4.1.6-hunt-v2'
     or not m.pass_rollback_target_preserved
     or not m.pass_automatic_rollback_off
     or m.automatic_action_taken then
    raise exception 'rollback target / manual-only contract mismatch';
  end if;

  if m.routing_mode<>'CHALLENGER_ONLY' or m.challenger_traffic_percent<>100 then
    if m.stabilization_ready_for_version_promotion
       or m.stabilization_reason<>'NOT_AT_FULL_ACTIVATION' then
      raise exception 'pre-full-activation state is not fail-closed';
    end if;
  end if;
end $$;

select 'stock-hunter-post-activation-monitoring-v417: PASS' as result;
