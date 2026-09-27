-- Read-only verification for Stock Hunter 4.1.7 Promotion -> Forward Shadow -> Activation Review.
-- Safe before the real OOS release: it expects all write paths to stay locked until FROZEN_PASS.

do $$
declare
  v_integrity text;
  v_manifest_release bigint;
  v_manifest_fp text;
  v_bad_proposals integer;
  v_bad_shadow integer;
  v_bad_reviews integer;
  v_auto_promote boolean;
  v_auto_activate boolean;
  v_days integer;
  v_selected integer;
  v_mutation_cron integer;
  v_public_mutators integer;
  v_gate_state text;
  v_gate_reason text;
begin
  if to_regclass('public.stock_hunter_promotion_forward_shadow_gate_v417') is null then
    raise exception 'promotion/forward-shadow gate view missing';
  end if;

  select integrity_state,release_id,dataset_fingerprint
    into v_integrity,v_manifest_release,v_manifest_fp
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;

  select auto_promote into v_auto_promote
  from public.stock_hunter_promotion_policy_v416 where policy_id='default';
  select auto_activate,min_fresh_trade_dates,min_selected_per_mode
    into v_auto_activate,v_days,v_selected
  from public.stock_hunter_rollout_policy_v417 where policy_id='default';

  if v_auto_promote is distinct from false then
    raise exception 'auto_promote must remain false';
  end if;
  if v_auto_activate is distinct from false then
    raise exception 'auto_activate must remain false';
  end if;
  if v_days is distinct from 10 then
    raise exception 'min_fresh_trade_dates drifted from 10: %',v_days;
  end if;
  if v_selected is distinct from 30 then
    raise exception 'min_selected_per_mode drifted from 30: %',v_selected;
  end if;

  -- Any recorded Proposal must be bound to the one immutable OOS release and fingerprint.
  select count(*) into v_bad_proposals
  from public.stock_hunter_promotion_proposals_v416 p
  where v_integrity is distinct from 'FROZEN_PASS'
     or p.release_id is distinct from v_manifest_release
     or p.dataset_fingerprint is distinct from v_manifest_fp;
  if v_bad_proposals<>0 then
    raise exception 'invalid Promotion Proposal rows relative to frozen OOS: %',v_bad_proposals;
  end if;

  -- Every Forward Shadow row must be prospective relative to its Proposal, have same-day
  -- Tehran provenance, remain within capture lag, and use one of the two hunt modes.
  select count(*) into v_bad_shadow
  from public.stock_hunter_challenger_shadow_samples_v417 s
  left join public.stock_hunter_promotion_proposals_v416 p on p.proposal_id=s.proposal_id
  where p.proposal_id is null
     or v_integrity is distinct from 'FROZEN_PASS'
     or s.observed_at<=p.created_at
     or s.trade_date is distinct from (s.observed_at at time zone 'Asia/Tehran')::date
     or s.created_at<s.observed_at-interval '2 minutes'
     or s.created_at>s.observed_at+interval '10 minutes'
     or s.hunt_mode not in ('reversal','acceleration');
  if v_bad_shadow<>0 then
    raise exception 'non-prospective or unbound Forward Shadow rows: %',v_bad_shadow;
  end if;

  -- One paired sample key must map to at most one row.
  if exists (
    select 1
    from public.stock_hunter_challenger_shadow_samples_v417
    group by proposal_id,trade_date,symbol_id,bucket_minute,hunt_mode
    having count(*)>1
  ) then
    raise exception 'duplicate Forward Shadow pair key detected';
  end if;

  -- Activation Review is audit-only: it requires a Proposal and must never carry an
  -- activation side effect.
  select count(*) into v_bad_reviews
  from public.stock_hunter_activation_reviews_v417 r
  left join public.stock_hunter_promotion_proposals_v416 p on p.proposal_id=r.proposal_id
  where p.proposal_id is null
     or v_integrity is distinct from 'FROZEN_PASS'
     or coalesce(r.production_activated,false);
  if v_bad_reviews<>0 then
    raise exception 'invalid Activation Review rows: %',v_bad_reviews;
  end if;

  if exists (
    select 1 from public.stock_hunter_activation_reviews_v417
    group by proposal_id having count(*)>1
  ) then
    raise exception 'more than one Activation Review exists for a Proposal';
  end if;

  -- No scheduler is allowed to create a Promotion Proposal, record an Activation Review,
  -- or mutate activation as part of this protocol.
  select count(*) into v_mutation_cron
  from cron.job
  where active and (
       lower(command) like '%promotion_proposals_v416%'
    or lower(command) like '%activation_reviews_v417%'
    or lower(command) like '%production_activated%'
    or lower(command) like '%challenger_traffic_percent%'
  );
  if v_mutation_cron<>0 then
    raise exception 'unexpected automatic Promotion/Review/Activation cron paths: %',v_mutation_cron;
  end if;

  -- Search privileged functions that write Proposal/Review tables. None may be executable
  -- through the public Data API roles.
  select count(*) into v_public_mutators
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f'
    and (
      pg_get_functiondef(p.oid) ilike '%stock_hunter_promotion_proposals_v416%'
      or pg_get_functiondef(p.oid) ilike '%stock_hunter_activation_reviews_v417%'
    )
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
    );
  if v_public_mutators<>0 then
    raise exception 'Promotion/Activation Review mutator functions are public: %',v_public_mutators;
  end if;

  select gate_state,gate_reason into v_gate_state,v_gate_reason
  from public.stock_hunter_promotion_forward_shadow_gate_v417
  limit 1;

  if v_integrity is distinct from 'FROZEN_PASS' then
    if v_gate_state is distinct from 'BLOCKED_OOS_NOT_FROZEN' then
      raise exception 'gate must fail closed before OOS FROZEN_PASS; state=% reason=%',v_gate_state,v_gate_reason;
    end if;
    if exists(select 1 from public.stock_hunter_promotion_proposals_v416)
       or exists(select 1 from public.stock_hunter_challenger_shadow_samples_v417)
       or exists(select 1 from public.stock_hunter_activation_reviews_v417) then
      raise exception 'downstream artifacts exist before OOS freeze PASS';
    end if;
  end if;
end $$;

select 'stock-hunter-promotion-forward-shadow-v417: PASS' as result;
