-- Stock Hunter 4.1.7 Promotion / Forward Shadow / Activation Review live-close verifier.
-- Safe before real OOS release and after the downstream lifecycle starts.
-- Expected final row: stock-hunter-promotion-forward-shadow-live-close-v417: PASS

do $$
declare
  v_integrity text;
  v_release_id bigint;
  v_fingerprint text;
  v_gate_state text;
  v_shadow_def text;
  v_bad_pairs bigint;
  v_bad_proposals bigint;
  v_bad_reviews bigint;
  v_mutation_cron bigint;
  v_api_mutators bigint;
  v_auto_promote boolean;
  v_auto_activate boolean;
  v_days integer;
  v_selected integer;
  v_status public.stock_hunter_activation_status_v417%rowtype;
begin
  if to_regclass('public.stock_hunter_promotion_forward_shadow_gate_v417') is null then
    raise exception 'promotion-forward-shadow lifecycle view missing';
  end if;

  select integrity_state,release_id,dataset_fingerprint
    into v_integrity,v_release_id,v_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;

  select auto_promote
    into v_auto_promote
  from public.stock_hunter_promotion_policy_v416
  where policy_id='default';

  select auto_activate,min_fresh_trade_dates,min_selected_per_mode
    into v_auto_activate,v_days,v_selected
  from public.stock_hunter_rollout_policy_v417
  where policy_id='default';

  if v_auto_promote
     or v_auto_activate
     or v_days<>10
     or v_selected<>30 then
    raise exception 'Promotion/Forward Shadow frozen policy mismatch';
  end if;

  if not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_promotion_proposals_v416'::regclass
        and tgname='stock_hunter_promotion_proposal_oos_guard_v417'
        and tgenabled='O' and not tgisinternal
    )
    or not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_activation_reviews_v417'::regclass
        and tgname='stock_hunter_activation_review_gate_v417'
        and tgenabled='O' and not tgisinternal
    ) then
    raise exception 'Proposal/Activation Review guard trigger missing';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_challenger_shadow_samples_v417'::regclass
      and relkind='v'
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'Forward Shadow must remain security_invoker view';
  end if;

  if (select count(*) from pg_attribute
      where attrelid='public.stock_hunter_challenger_shadow_samples_v417'::regclass
        and attnum>0 and not attisdropped)<>20 then
    raise exception 'Forward Shadow output contract drifted';
  end if;

  select pg_get_viewdef('public.stock_hunter_challenger_shadow_samples_v417'::regclass,true)
    into v_shadow_def;

  if position('stock_hunter_shadow_outcomes_v416' in v_shadow_def)=0
     or position('stock_hunter_shadow_samples_v416' in v_shadow_def)=0
     or position('o.observed_at > p.created_at' in v_shadow_def)=0
     or position('4.1.6-shadow-v2-parity' in v_shadow_def)=0
     or position('stock_hunter_oos_release_results_v416' in v_shadow_def)=0
     or position('stock_hunter_candidate_library_v416' in v_shadow_def)=0 then
    raise exception 'Forward Shadow prospective raw-source contract mismatch';
  end if;

  if position('stock_hunter_calibration_dataset_v416' in v_shadow_def)>0
     or position('stock_hunter_candidate_scores_v416' in v_shadow_def)>0 then
    raise exception 'Forward Shadow is deadlocked on frozen Calibration/Candidate Scores';
  end if;

  select count(*) into v_bad_pairs
  from (
    select proposal_id,sample_id,hunt_mode,
           count(*) as n,
           count(*) filter(where model_role='champion') as champions,
           count(*) filter(where model_role='challenger') as challengers
    from public.stock_hunter_challenger_shadow_samples_v417
    group by proposal_id,sample_id,hunt_mode
    having count(*)<>2
       or count(*) filter(where model_role='champion')<>1
       or count(*) filter(where model_role='challenger')<>1
  ) q;

  if v_bad_pairs<>0 then
    raise exception 'Forward Shadow pairing mismatch: % sample/mode groups',v_bad_pairs;
  end if;

  if exists (
    select 1
    from public.stock_hunter_challenger_shadow_samples_v417
    where observed_at<=proposal_created_at
       or model_role not in ('champion','challenger')
  ) then
    raise exception 'non-prospective or invalid-role Forward Shadow row exists';
  end if;

  select count(*) into v_bad_proposals
  from public.stock_hunter_promotion_proposals_v416 p
  where v_integrity is distinct from 'FROZEN_PASS'
     or p.release_id is distinct from v_release_id
     or p.dataset_fingerprint is distinct from v_fingerprint
     or p.protocol_version<>'4.1.6-promotion-v1'
     or p.source_engine_version<>'4.1.6-hunt-v2'
     or p.target_engine_version<>'4.1.7-proposed';

  if v_bad_proposals<>0 then
    raise exception 'Promotion Proposal binding/version mismatch: %',v_bad_proposals;
  end if;

  select count(*) into v_bad_reviews
  from public.stock_hunter_activation_reviews_v417 r
  left join public.stock_hunter_promotion_proposals_v416 p
    on p.proposal_id=r.proposal_id
  where p.proposal_id is null
     or v_integrity is distinct from 'FROZEN_PASS'
     or r.release_id is distinct from p.release_id
     or r.dataset_fingerprint is distinct from p.dataset_fingerprint
     or r.protocol_version<>'4.1.7-activation-review-v1'
     or r.champion_engine_version<>'4.1.6-hunt-v2'
     or r.challenger_engine_version<>'4.1.7-proposed'
     or coalesce(r.production_activated,false);

  if v_bad_reviews<>0 then
    raise exception 'Activation Review binding/non-activation mismatch: %',v_bad_reviews;
  end if;

  if has_table_privilege('anon','public.stock_hunter_promotion_proposals_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_promotion_proposals_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_promotion_proposals_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('anon','public.stock_hunter_activation_reviews_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_activation_reviews_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_activation_reviews_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Proposal/Review audit tables unexpectedly writable by API roles';
  end if;

  if has_function_privilege('anon','private.create_stock_hunter_promotion_proposal_v416(text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.create_stock_hunter_promotion_proposal_v416(text,text)','EXECUTE')
     or has_function_privilege('service_role','private.create_stock_hunter_promotion_proposal_v416(text,text)','EXECUTE')
     or has_function_privilege('anon','private.create_stock_hunter_activation_review_v417(text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.create_stock_hunter_activation_review_v417(text,text)','EXECUTE')
     or has_function_privilege('service_role','private.create_stock_hunter_activation_review_v417(text,text)','EXECUTE') then
    raise exception 'manual Proposal/Review functions exposed to API roles';
  end if;

  select count(*) into v_mutation_cron
  from cron.job
  where active and (
       lower(command) like '%create_stock_hunter_promotion_proposal%'
    or lower(command) like '%create_stock_hunter_activation_review%'
    or lower(command) like '%insert%promotion_proposals%'
    or lower(command) like '%insert%activation_reviews%'
    or lower(command) like '%challenger_traffic_percent%'
  );

  if v_mutation_cron<>0 then
    raise exception 'automatic Proposal/Review/traffic mutation path exists in cron';
  end if;

  select count(*) into v_api_mutators
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f'
    and n.nspname in ('public','private')
    and (
      pg_get_functiondef(p.oid) ilike '%insert into public.stock_hunter_promotion_proposals_v416%'
      or pg_get_functiondef(p.oid) ilike '%insert into public.stock_hunter_activation_reviews_v417%'
    )
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
    );

  if v_api_mutators<>0 then
    raise exception 'Proposal/Review mutator executable by API role: %',v_api_mutators;
  end if;

  if has_table_privilege('anon','public.stock_hunter_promotion_forward_shadow_gate_v417','SELECT')
     or has_table_privilege('authenticated','public.stock_hunter_promotion_forward_shadow_gate_v417','SELECT')
     or not has_table_privilege('service_role','public.stock_hunter_promotion_forward_shadow_gate_v417','SELECT') then
    raise exception 'unified lifecycle gate ACL mismatch';
  end if;

  select gate_state into v_gate_state
  from public.stock_hunter_promotion_forward_shadow_gate_v417
  limit 1;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if v_integrity is distinct from 'FROZEN_PASS' then
    if v_gate_state<>'BLOCKED_OOS_NOT_FROZEN' then
      raise exception 'pre-OOS lifecycle gate does not fail closed: %',v_gate_state;
    end if;

    if exists(select 1 from public.stock_hunter_promotion_proposals_v416)
       or exists(select 1 from public.stock_hunter_challenger_shadow_samples_v417)
       or exists(select 1 from public.stock_hunter_activation_reviews_v417) then
      raise exception 'downstream artifacts exist before OOS FROZEN_PASS';
    end if;

    if v_status.routing_mode<>'CHAMPION_ONLY'
       or v_status.challenger_traffic_percent<>0
       or not v_status.kill_switch_engaged
       or v_status.activation_review_id is not null then
      raise exception 'activation state advanced before OOS FROZEN_PASS';
    end if;
  end if;
end $$;

select 'stock-hunter-promotion-forward-shadow-live-close-v417: PASS' as result;
