-- Read-only verifier for the independent Stock Hunter 4.1.7 50% -> 100% gate.
-- Expected final row: stock-hunter-full-activation-gate-v417: PASS

do $$
declare
  fp public.stock_hunter_full_activation_policy_v417%rowtype;
  ep public.stock_hunter_canary_expansion_policy_v417%rowtype;
  st public.stock_hunter_activation_status_v417%rowtype;
  rd public.stock_hunter_full_activation_readiness_v417%rowtype;
  auth_def text;
  activate_def text;
begin
  select * into strict fp from public.stock_hunter_full_activation_policy_v417 where policy_id='default';
  select * into strict ep from public.stock_hunter_canary_expansion_policy_v417 where policy_id='default' and from_percent=25 and to_percent=50;
  select * into strict st from public.stock_hunter_activation_status_v417 where status_id='default';
  select * into strict rd from public.stock_hunter_full_activation_readiness_v417;

  if fp.protocol_version<>'4.1.7-full-activation-v1'
     or fp.required_from_percent<>50
     or fp.min_stage_minutes<120
     or fp.min_routed_pairs_per_mode<250
     or fp.min_routed_symbols_per_mode<50
     or fp.min_routed_buckets_per_mode<8
     or fp.max_telemetry_age_minutes>15
     or fp.required_recommendation<>'PASS'
     or fp.auto_activate then
    raise exception 'full activation frozen policy mismatch';
  end if;

  if fp.min_stage_minutes<=ep.min_stage_minutes
     or fp.min_routed_pairs_per_mode<=ep.min_routed_pairs_per_mode
     or fp.min_routed_symbols_per_mode<=ep.min_routed_symbols_per_mode
     or fp.min_routed_buckets_per_mode<=ep.min_routed_buckets_per_mode
     or fp.max_telemetry_age_minutes>=ep.max_telemetry_age_minutes then
    raise exception 'full activation gate is not stricter than the final staged expansion gate';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_full_activation_policy_v417'::regclass
      and tgname='stock_hunter_full_activation_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then raise exception 'full activation policy freeze trigger missing'; end if;

  if has_table_privilege('service_role','public.stock_hunter_full_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('anon','public.stock_hunter_full_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_full_activation_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'full activation policy has unexpected API write privilege';
  end if;

  if not has_table_privilege('anon','public.stock_hunter_full_activation_readiness_v417','SELECT')
     or has_table_privilege('anon','public.stock_hunter_full_activation_readiness_v417','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.stock_hunter_full_activation_readiness_v417','INSERT,UPDATE,DELETE') then
    raise exception 'full activation readiness is not read-only';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_full_activation_readiness_v417'::regclass
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then raise exception 'full activation readiness is not security_invoker'; end if;

  if not exists (
    select 1 from pg_trigger where tgrelid='private.stock_hunter_full_activation_authorizations_v417'::regclass
      and tgname='stock_hunter_full_activation_authorization_immutable_v417' and tgenabled='O'
  ) or not exists (
    select 1 from pg_trigger where tgrelid='private.stock_hunter_full_activation_authorizations_v417'::regclass
      and tgname='stock_hunter_full_activation_authorization_truncate_v417' and tgenabled='O'
  ) then raise exception 'full activation authorization immutability triggers missing'; end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='private' and tablename='stock_hunter_full_activation_authorizations_v417'
      and indexname='stock_hunter_full_activation_auth_one_open_v417'
      and indexdef like '%(review_id, state_version)%consumed_at IS NULL%'
  ) then raise exception 'full activation one-open authorization index missing'; end if;

  if has_function_privilege('anon','private.authorize_stock_hunter_full_activation_v417(bigint,text)','EXECUTE')
     or has_function_privilege('authenticated','private.authorize_stock_hunter_full_activation_v417(bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.authorize_stock_hunter_full_activation_v417(bigint,text)','EXECUTE')
     or has_function_privilege('anon','private.activate_stock_hunter_challenger_v417(bigint,text)','EXECUTE')
     or has_function_privilege('authenticated','private.activate_stock_hunter_challenger_v417(bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.activate_stock_hunter_challenger_v417(bigint,text)','EXECUTE') then
    raise exception 'full activation manual functions exposed to API roles';
  end if;

  select pg_get_functiondef('private.authorize_stock_hunter_full_activation_v417(bigint,text)'::regprocedure) into auth_def;
  select pg_get_functiondef('private.activate_stock_hunter_challenger_v417(bigint,text)'::regprocedure) into activate_def;

  if auth_def not like '%challenger_traffic_percent<>50%'
     or auth_def not like '%full_activation_ready%'
     or auth_def not like '%activation_review_id is distinct from v_status.activation_review_id%'
     or auth_def not like '%state_version is distinct from v_status.state_version%' then
    raise exception 'full activation authorization binding contract missing';
  end if;

  if activate_def not like '%from_percent=50%'
     or activate_def not like '%consumed_at is null%'
     or activate_def not like '%full_activation gate recheck blocked activation%'
     or activate_def not like '%authorization snapshot is stale%'
     or activate_def not like '%challenger_traffic_percent=100%'
     or activate_def not like '%full_authorization_consumed%'
     or activate_def not like '%set consumed_at=now()%'
  then raise exception 'full activation one-shot/recheck contract missing';
  end if;

  if st.routing_mode='CHAMPION_ONLY' and st.challenger_traffic_percent=0 then
    if rd.full_activation_ready or rd.pass_exact_50_stage then
      raise exception 'champion-only state must fail closed for full activation';
    end if;
  end if;
end $$;

select 'stock-hunter-full-activation-gate-v417: PASS' as result;
