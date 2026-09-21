-- Stock Hunter 4.1.6 rolling prospective maturity verifier.
-- Read-only and state-aware across COLLECTING -> Calibration ready.
-- Expected final row: stock-hunter-rolling-maturity-watch-v416: PASS

do $$
declare
  p public.stock_hunter_calibration_policy_v416%rowtype;
  r public.stock_hunter_calibration_readiness_v416%rowtype;
  m public.stock_hunter_maturity_status_v416%rowtype;
  cp public.stock_hunter_candidate_evaluator_status_v416%rowtype;
  cc public.stock_hunter_candidate_eval_control_v416%rowtype;
  rp public.stock_hunter_robustness_policy_v416%rowtype;
  a public.stock_hunter_activation_status_v417%rowtype;
  v_raw bigint;
  v_total bigint;
  v_reversal bigint;
  v_acceleration bigint;
  v_oos bigint;
  v_dates bigint;
  v_bad bigint;
  v_excluded_leak bigint;
  v_expected_ready boolean;
  v_candidate_runs bigint;
  v_oos_manifest bigint;
  v_promotions bigint;
  v_reviews bigint;
  v_release_pins bigint;
begin
  select * into strict p
  from public.stock_hunter_calibration_policy_v416
  where policy_id='default';

  select * into strict r
  from public.stock_hunter_calibration_readiness_v416;

  select * into strict m
  from public.stock_hunter_maturity_status_v416;

  select * into strict cp
  from public.stock_hunter_candidate_evaluator_status_v416;

  select * into strict cc
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true;

  select * into strict rp
  from public.stock_hunter_robustness_policy_v416
  where policy_id='default';

  select * into strict a
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if p.engine_version<>'4.1.6-hunt-v2'
     or p.min_total_samples<>120
     or p.min_mode_samples<>40
     or p.min_oos_samples<>30
     or p.min_trade_dates<>20
     or p.train_share<>0.6
     or p.validation_share<>0.2
     or p.oos_share<>0.2
     or p.auto_promote
     or p.prospective_start_at is distinct from timestamptz '2026-09-19 05:30:00+00'
     or p.max_capture_lag_seconds<>600 then
    raise exception 'frozen calibration policy mismatch';
  end if;

  if rp.auto_unlock_oos
     or not rp.require_both_modes
     or cc.auto_promote then
    raise exception 'automatic maturity/OOS promotion control unexpectedly enabled';
  end if;

  select count(*) into v_raw
  from public.stock_hunter_calibration_dataset_v416;

  select
    count(*)::bigint,
    count(*) filter (where hunt_mode='reversal')::bigint,
    count(*) filter (where hunt_mode='acceleration')::bigint,
    count(*) filter (where split='oos')::bigint,
    count(distinct trade_date)::bigint
  into v_total,v_reversal,v_acceleration,v_oos,v_dates
  from public.stock_hunter_calibration_dataset_v416
  where future_sessions_observed>=3
    and return_1d_pct is not null
    and return_3d_pct is not null;

  if r.raw_samples<>v_raw
     or r.total_samples<>v_total
     or r.reversal_samples<>v_reversal
     or r.acceleration_samples<>v_acceleration
     or r.oos_samples<>v_oos
     or r.trade_dates<>v_dates then
    raise exception
      'calibration readiness counters drift from dataset: raw %/% total %/% rev %/% acc %/% oos %/% dates %/%',
      r.raw_samples,v_raw,r.total_samples,v_total,r.reversal_samples,v_reversal,
      r.acceleration_samples,v_acceleration,r.oos_samples,v_oos,r.trade_dates,v_dates;
  end if;

  if cp.raw_samples<>r.raw_samples
     or cp.total_samples<>r.total_samples
     or cp.reversal_samples<>r.reversal_samples
     or cp.acceleration_samples<>r.acceleration_samples
     or cp.oos_samples<>r.oos_samples
     or cp.trade_dates<>r.trade_dates
     or cp.calibration_ready is distinct from r.calibration_ready then
    raise exception 'candidate evaluator status drift from calibration readiness';
  end if;

  select count(*) into v_bad
  from public.stock_hunter_calibration_dataset_v416 c
  join public.stock_hunter_shadow_samples_v416 s using(sample_id)
  cross join public.stock_hunter_calibration_policy_v416 pol
  where pol.policy_id='default'
    and (
      c.future_sessions_observed<3
      or c.return_1d_pct is null
      or c.return_3d_pct is null
      or c.source_version<>'4.1.6-shadow-v2-parity'
      or c.gate_reason<>''
      or c.hunt_mode not in ('reversal','acceleration')
      or c.split not in ('train','validation','oos')
      or c.cluster_weight<=0
      or c.cluster_weight>1
      or s.observed_at<pol.prospective_start_at
      or s.trade_date<>(s.observed_at at time zone 'Asia/Tehran')::date
      or s.created_at<s.observed_at-interval '2 minutes'
      or s.created_at>s.observed_at + pol.max_capture_lag_seconds * interval '1 second'
    );

  if v_bad<>0 then
    raise exception '% invalid/premature rows detected in rolling calibration dataset',v_bad;
  end if;

  select count(*) into v_excluded_leak
  from public.stock_hunter_calibration_dataset_v416 c
  join public.stock_hunter_shadow_sample_exclusions_v416 q using(sample_id);

  if v_excluded_leak<>0 then
    raise exception '% quarantined Shadow Samples leaked into rolling calibration dataset',v_excluded_leak;
  end if;

  v_expected_ready :=
       v_total>=p.min_total_samples
   and v_reversal>=p.min_mode_samples
   and v_acceleration>=p.min_mode_samples
   and v_oos>=p.min_oos_samples
   and v_dates>=p.min_trade_dates;

  if r.calibration_ready is distinct from v_expected_ready then
    raise exception 'calibration_ready boolean does not match frozen threshold conjunction';
  end if;

  if m.total_samples<>r.total_samples
     or m.reversal_samples<>r.reversal_samples
     or m.acceleration_samples<>r.acceleration_samples
     or m.oos_samples<>r.oos_samples
     or m.trade_dates<>r.trade_dates
     or m.calibration_ready is distinct from r.calibration_ready then
    raise exception 'maturity status drift from calibration readiness';
  end if;

  select count(*) into v_candidate_runs
  from public.stock_hunter_candidate_evaluation_runs_v416;
  select count(*) into v_oos_manifest
  from public.stock_hunter_oos_release_manifest_v416;
  select count(*) into v_promotions
  from public.stock_hunter_promotion_proposals_v416;
  select count(*) into v_reviews
  from public.stock_hunter_activation_reviews_v417;
  select count(*) into v_release_pins
  from private.stock_hunter_release_pin_manifests_v417;

  if not r.calibration_ready then
    if m.maturity_state<>'COLLECTING'
       or m.oos_unlocked
       or m.can_unlock_oos
       or cc.oos_unlocked
       or v_candidate_runs<>0
       or v_oos_manifest<>0
       or v_promotions<>0
       or v_reviews<>0
       or v_release_pins<>0 then
      raise exception 'downstream lifecycle advanced before calibration maturity';
    end if;

    if a.routing_mode<>'CHAMPION_ONLY'
       or a.challenger_traffic_percent<>0
       or not a.kill_switch_engaged
       or a.activation_review_id is not null then
      raise exception 'production control plane advanced before calibration maturity';
    end if;
  end if;

  if m.oos_unlocked and v_oos_manifest<>1 then
    raise exception 'OOS unlocked without exactly one OOS release manifest';
  end if;

  if v_oos_manifest>0 and not m.oos_unlocked then
    raise exception 'OOS release manifest exists while maturity status is not unlocked';
  end if;
end $$;

select 'stock-hunter-rolling-maturity-watch-v416: PASS' as result;
