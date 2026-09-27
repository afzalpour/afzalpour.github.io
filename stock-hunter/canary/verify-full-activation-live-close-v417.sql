-- Stock Hunter 4.1.7 independent Full Activation live-close verifier.
-- Safe before and after staged Canary; performs no mutation.
-- Expected final row: stock-hunter-full-activation-live-close-v417: PASS

do $$
declare
  p public.stock_hunter_full_activation_policy_v417%rowtype;
  s public.stock_hunter_activation_status_v417%rowtype;
  d text;
  auth_def text;
  activate_def text;
  v_bad_exec integer;
  v_bad_cron integer;
  v_auth_acl integer;
begin
  select * into strict p
  from public.stock_hunter_full_activation_policy_v417
  where policy_id='default';

  if p.protocol_version<>'4.1.7-full-activation-v1'
     or p.required_from_percent<>50
     or p.min_stage_minutes<>120
     or p.min_routed_pairs_per_mode<>250
     or p.min_routed_symbols_per_mode<>50
     or p.min_routed_buckets_per_mode<>8
     or p.max_telemetry_age_minutes<>15
     or p.required_recommendation<>'PASS'
     or p.auto_activate then
    raise exception 'frozen Full Activation policy mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_full_activation_policy_v417'::regclass
      and tgname='stock_hunter_full_activation_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'Full Activation policy immutability trigger missing';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_full_activation_readiness_v417'::regclass
      and relkind='v'
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'Full Activation readiness must be a security_invoker view';
  end if;

  if (select count(*) from pg_attribute
      where attrelid='public.stock_hunter_full_activation_readiness_v417'::regclass
        and attnum>0 and not attisdropped)<>49 then
    raise exception 'Full Activation readiness output contract drifted';
  end if;

  select pg_get_viewdef('public.stock_hunter_full_activation_readiness_v417'::regclass,true)
    into d;

  if position('recommendation = ''STABLE''' in d)=0
     or position('THEN ''PASS''' in d)=0 then
    raise exception 'STABLE telemetry is not normalized to the Full Activation PASS contract';
  end if;

  if position('last_routed_observed_at' in d)=0
     or position('ROUTED_EVIDENCE_STALE' in d)=0
     or position('min_recommendation_observed_at' in d)=0
     or position('RECOMMENDATION_EVIDENCE_STALE' in d)=0
     or position('max_telemetry_age_minutes' in d)=0 then
    raise exception 'Full Activation evidence freshness contract is incomplete';
  end if;

  if position('st.state_version = s.state_version' in d)=0
     or position('st.stage_percent = p.required_from_percent' in d)=0
     or position('rec.state_version = s.state_version' in d)=0 then
    raise exception 'Full Activation evidence is not bound to current exact-50 state';
  end if;

  if position('rr.recommendation = ''PASS''' in d)>0 then
    raise exception 'legacy unreachable PASS comparison remains in Full Activation readiness';
  end if;

  if has_table_privilege('anon','public.stock_hunter_full_activation_readiness_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_full_activation_readiness_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_full_activation_readiness_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or not has_table_privilege('anon','public.stock_hunter_full_activation_readiness_v417','SELECT')
     or not has_table_privilege('authenticated','public.stock_hunter_full_activation_readiness_v417','SELECT')
     or not has_table_privilege('service_role','public.stock_hunter_full_activation_readiness_v417','SELECT') then
    raise exception 'Full Activation readiness ACL is not SELECT-only';
  end if;

  select count(*) into v_auth_acl
  from (values ('anon'::name),('authenticated'::name),('service_role'::name)) r(role_name)
  where has_table_privilege(role_name,'private.stock_hunter_full_activation_authorizations_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE');

  if v_auth_acl<>0 then
    raise exception 'private Full Activation authorization table exposed to API role';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_full_activation_authorizations_v417'::regclass
      and tgname='stock_hunter_full_activation_authorization_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'Full Activation authorization one-shot immutability trigger missing';
  end if;

  select pg_get_functiondef(
    'private.authorize_stock_hunter_full_activation_v417(bigint,text)'::regprocedure
  ) into auth_def;

  select pg_get_functiondef(
    'private.activate_stock_hunter_challenger_v417(bigint,text)'::regprocedure
  ) into activate_def;

  if position('challenger_traffic_percent<>50' in auth_def)=0
     or position('state_version<>p_expected_state_version' in auth_def)=0
     or position('full_activation_ready' in auth_def)=0
     or position('full activation readiness is not bound to the current exact 50 percent state' in auth_def)=0 then
    raise exception 'separate Full Activation authorization contract mismatch';
  end if;

  if position('challenger_traffic_percent<>50' in activate_def)=0
     or position('state_version<>p_expected_state_version' in activate_def)=0
     or position('full activation gate recheck blocked activation' in activate_def)=0
     or position('consumed_at is null' in activate_def)=0
     or position('challenger_traffic_percent=100' in activate_def)=0
     or position('routing_mode=''CHALLENGER_ONLY''' in activate_def)=0 then
    raise exception '50->100 activation/recheck/one-shot contract mismatch';
  end if;

  select count(*) into v_bad_exec
  from pg_proc q
  join pg_namespace n on n.oid=q.pronamespace
  where n.nspname='private'
    and q.proname in (
      'authorize_stock_hunter_full_activation_v417',
      'activate_stock_hunter_challenger_v417'
    )
    and (
      not q.prosecdef
      or q.proconfig is null
      or not (q.proconfig @> array['search_path=pg_catalog']::text[])
      or has_function_privilege('anon',q.oid,'EXECUTE')
      or has_function_privilege('authenticated',q.oid,'EXECUTE')
      or has_function_privilege('service_role',q.oid,'EXECUTE')
      or not has_function_privilege('postgres',q.oid,'EXECUTE')
    );

  if v_bad_exec<>0 then
    raise exception 'Full Activation mutator function security/ACL mismatch';
  end if;

  select count(*) into v_bad_cron
  from cron.job
  where active and (
    lower(command) like '%authorize_stock_hunter_full_activation%'
    or lower(command) like '%activate_stock_hunter_challenger%'
    or lower(command) like '%challenger_traffic_percent%100%'
  );

  if v_bad_cron<>0 then
    raise exception 'automatic Full Activation cron detected';
  end if;

  select * into strict s
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if s.state_version=1 and s.activation_review_id is null then
    if s.routing_mode<>'CHAMPION_ONLY'
       or s.challenger_traffic_percent<>0
       or not s.kill_switch_engaged then
      raise exception 'pre-review activation state is not fail-closed';
    end if;

    if exists(select 1 from private.stock_hunter_full_activation_authorizations_v417)
       or exists(select 1 from private.stock_hunter_activation_events_v417) then
      raise exception 'Full Activation authorization/event residue exists in initial state';
    end if;

    if (select full_activation_ready from public.stock_hunter_full_activation_readiness_v417 limit 1)
       or (select full_activation_reason from public.stock_hunter_full_activation_readiness_v417 limit 1)
          <>'NO_ACTIVATION_REVIEW_BOUND' then
      raise exception 'Full Activation readiness does not fail closed before Review';
    end if;
  end if;
end $$;

select 'stock-hunter-full-activation-live-close-v417: PASS' as result;
