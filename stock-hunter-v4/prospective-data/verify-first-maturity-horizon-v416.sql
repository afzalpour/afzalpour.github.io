-- Stock Hunter 4.1.6 first prospective maturity-horizon verifier.
-- First cohort: trade_date 2026-09-19.
-- Three future sessions: 2026-09-20, 2026-09-21, 2026-09-22.
-- Expected final row: stock-hunter-first-maturity-horizon-v416: PASS

do $$
declare
  v_first_trade_date date := date '2026-09-19';
  v_horizon_deadline timestamptz := timestamptz '2026-09-22 14:55:00+00';
  v_now timestamptz := now();
  v_cal_rows bigint;
  v_expected_mature bigint;
  v_bad_cal bigint;
  v_bad_future_dates bigint;
  v_later_cohort_leak bigint;
  v_downstream_coverage bigint;
  v_candidate_runs bigint;
  v_oos bigint;
  v_promotions bigint;
  v_reviews bigint;
  v_release_pins bigint;
  m public.stock_hunter_maturity_status_v416%rowtype;
  a public.stock_hunter_activation_status_v417%rowtype;
begin
  select * into strict m
  from public.stock_hunter_maturity_status_v416;

  select * into strict a
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if a.routing_mode<>'CHAMPION_ONLY'
     or a.challenger_traffic_percent<>0
     or not a.kill_switch_engaged
     or a.activation_review_id is not null then
    raise exception 'control plane escaped champion-only lock before first maturity horizon';
  end if;

  select count(*) into v_cal_rows
  from public.stock_hunter_calibration_dataset_v416
  where trade_date=v_first_trade_date;

  select count(*) into v_expected_mature
  from public.stock_hunter_shadow_outcomes_v416 o
  join public.stock_hunter_shadow_samples_v416 s using(sample_id)
  cross join public.stock_hunter_calibration_policy_v416 p
  where p.policy_id='default'
    and o.trade_date=v_first_trade_date
    and o.future_sessions_observed>=3
    and o.gate_reason=''
    and s.observed_at>=p.prospective_start_at
    and s.trade_date=(s.observed_at at time zone 'Asia/Tehran')::date
    and s.created_at>=s.observed_at-interval '2 minutes'
    and s.created_at<=s.observed_at + p.max_capture_lag_seconds * interval '1 second';

  if v_cal_rows<>v_expected_mature then
    raise exception 'calibration first-cohort count mismatch: dataset %, expected mature %',
      v_cal_rows,v_expected_mature;
  end if;

  select count(*) into v_bad_cal
  from public.stock_hunter_calibration_dataset_v416 c
  where c.trade_date=v_first_trade_date
    and (
      c.future_sessions_observed<3
      or c.source_version<>'4.1.6-shadow-v2-parity'
      or c.gate_reason<>''
      or c.observed_at<timestamptz '2026-09-19 05:30:00+00'
      or (c.observed_at at time zone 'Asia/Tehran')::date<>c.trade_date
      or c.return_3d_pct is null
    );

  if v_bad_cal<>0 then
    raise exception 'first-cohort calibration contains % premature/invalid rows',v_bad_cal;
  end if;

  select count(*) into v_bad_future_dates
  from public.stock_hunter_calibration_dataset_v416 c
  where c.trade_date=v_first_trade_date
    and (
      not exists (
        select 1
        from public.stock_hunter_shadow_outcome_observations_v416 o
        where o.sample_id=c.sample_id
          and o.observation_date=date '2026-09-20'
      )
      or not exists (
        select 1
        from public.stock_hunter_shadow_outcome_observations_v416 o
        where o.sample_id=c.sample_id
          and o.observation_date=date '2026-09-21'
      )
      or not exists (
        select 1
        from public.stock_hunter_shadow_outcome_observations_v416 o
        where o.sample_id=c.sample_id
          and o.observation_date=date '2026-09-22'
      )
    );

  if v_bad_future_dates<>0 then
    raise exception '% first-cohort mature rows are missing one of the three required future sessions',
      v_bad_future_dates;
  end if;

  -- Before the 2026-09-22 close, no 2026-09-19 cohort row may mature.
  if v_now < v_horizon_deadline and v_cal_rows<>0 then
    raise exception 'first cohort matured before third future-session close';
  end if;

  -- At the first horizon, later cohorts cannot yet have three future sessions.
  select count(*) into v_later_cohort_leak
  from public.stock_hunter_calibration_dataset_v416
  where trade_date>v_first_trade_date;

  if v_now <= v_horizon_deadline + interval '6 hours'
     and v_later_cohort_leak<>0 then
    raise exception 'later prospective cohort leaked into calibration at first maturity horizon';
  end if;

  select count(*) into v_candidate_runs
  from public.stock_hunter_candidate_evaluation_runs_v416;
  select count(*) into v_oos
  from public.stock_hunter_oos_release_manifest_v416;
  select count(*) into v_promotions
  from public.stock_hunter_promotion_proposals_v416;
  select count(*) into v_reviews
  from public.stock_hunter_activation_reviews_v417;
  select count(*) into v_release_pins
  from private.stock_hunter_release_pin_manifests_v417;

  if v_now <= v_horizon_deadline + interval '6 hours' then
    if m.trade_dates>1
       or m.calibration_ready
       or m.oos_unlocked
       or m.can_unlock_oos
       or v_candidate_runs<>0
       or v_oos<>0
       or v_promotions<>0
       or v_reviews<>0
       or v_release_pins<>0 then
      raise exception 'first maturity horizon prematurely advanced downstream lifecycle state';
    end if;
  end if;

  if v_now >= v_horizon_deadline then
    -- Every downstream close/evaluator job must have succeeded on each of the
    -- three future sessions so the maturity horizon is operationally complete.
    select count(*) into v_downstream_coverage
    from (
      select j.jobname,
             (d.start_time at time zone 'Asia/Tehran')::date as run_date
      from cron.job j
      join cron.job_run_details d using(jobid)
      where j.jobname in (
        'stock-hunter-outcomes-v416-close-a',
        'stock-hunter-outcomes-v416-close-b',
        'stock-hunter-shadow-outcomes-v416-close-a',
        'stock-hunter-shadow-outcomes-v416-close-b',
        'stock-hunter-candidate-evaluator-v416'
      )
        and d.status='succeeded'
        and (d.start_time at time zone 'Asia/Tehran')::date
            in (date '2026-09-20',date '2026-09-21',date '2026-09-22')
      group by j.jobname,(d.start_time at time zone 'Asia/Tehran')::date
    ) q;

    if v_downstream_coverage<>15 then
      raise exception 'maturity horizon missing downstream cron coverage: got % of 15 job/day successes',
        v_downstream_coverage;
    end if;

    if v_expected_mature=0 then
      -- Zero is allowed only as an empirical result of zero eligible first-day
      -- rows reaching three complete future sessions. Do not fabricate maturity.
      if exists (
        select 1
        from public.stock_hunter_shadow_samples_v416 s
        join public.stock_hunter_shadow_outcomes_v416 o using(sample_id)
        where s.trade_date=v_first_trade_date
          and s.gate_reason=''
          and o.future_sessions_observed>=3
      ) then
        raise exception 'eligible completed first-cohort rows exist but expected mature count is zero';
      end if;
    end if;

    if m.maturity_state<>'COLLECTING' then
      raise exception 'first horizon should remain COLLECTING, got %',m.maturity_state;
    end if;
  end if;
end $$;

select 'stock-hunter-first-maturity-horizon-v416: PASS' as result;
