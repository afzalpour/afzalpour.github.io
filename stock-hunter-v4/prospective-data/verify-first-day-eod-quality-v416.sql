-- Stock Hunter 4.1.6 first prospective trading-day EOD quality verifier.
-- State-aware before and after the first eligible day.
-- Expected final row: stock-hunter-prospective-eod-quality-v416: PASS

do $$
declare
  v_trade_date date := date '2026-09-19';
  v_start timestamptz := timestamptz '2026-09-19 05:30:00+00';
  v_eod_deadline timestamptz := timestamptz '2026-09-19 14:55:00+00';
  v_now timestamptz := now();
  v_shadow bigint;
  v_events bigint;
  v_shadow_outcomes bigint;
  v_hunt_outcomes bigint;
  v_bad_shadow bigint;
  v_bad_events bigint;
  v_bad_outcomes bigint;
  v_latest_cron_bad bigint;
  v_capture_job_coverage bigint;
  v_downstream_job_coverage bigint;
  v_candidate_runs bigint;
  v_calibration_rows bigint;
  v_oos_manifest bigint;
  v_promotions bigint;
  v_reviews bigint;
  v_release_pins bigint;
  c public.stock_hunter_capture_state_v416%rowtype;
  o public.stock_hunter_outcome_control_v416%rowtype;
  a public.stock_hunter_activation_status_v417%rowtype;
  m public.stock_hunter_maturity_status_v416%rowtype;
  cs public.stock_hunter_candidate_evaluator_status_v416%rowtype;
  cc public.stock_hunter_candidate_eval_control_v416%rowtype;
begin
  select * into strict c
  from public.stock_hunter_capture_state_v416
  where singleton=true;

  select * into strict o
  from public.stock_hunter_outcome_control_v416
  where singleton=true;

  select * into strict a
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  select * into strict m
  from public.stock_hunter_maturity_status_v416;

  select * into strict cs
  from public.stock_hunter_candidate_evaluator_status_v416;

  select * into strict cc
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true;

  if a.routing_mode<>'CHAMPION_ONLY'
     or a.challenger_traffic_percent<>0
     or not a.kill_switch_engaged
     or a.activation_review_id is not null then
    raise exception 'control plane escaped champion-only lock during first prospective day';
  end if;

  select count(*) into v_shadow
  from public.stock_hunter_shadow_samples_v416
  where trade_date=v_trade_date;

  select count(*) into v_events
  from public.stock_hunter_hunt_events_v416
  where trade_date=v_trade_date;

  select count(*) into v_shadow_outcomes
  from public.stock_hunter_shadow_outcome_observations_v416 so
  join public.stock_hunter_shadow_samples_v416 s using(sample_id)
  where s.trade_date=v_trade_date
    and so.observation_date=v_trade_date;

  select count(*) into v_hunt_outcomes
  from public.stock_hunter_hunt_outcome_observations_v416 ho
  join public.stock_hunter_hunt_events_v416 e using(event_id)
  where e.trade_date=v_trade_date
    and ho.observation_date=v_trade_date;

  select count(*) into v_bad_shadow
  from public.stock_hunter_shadow_samples_v416 s
  where s.trade_date=v_trade_date
    and (
      s.source_version<>'4.1.6-shadow-v2-parity'
      or s.hunt_mode not in ('reversal','acceleration')
      or s.observed_at<v_start
      or (s.observed_at at time zone 'Asia/Tehran')::date<>s.trade_date
      or s.created_at < s.observed_at - interval '5 seconds'
      or s.created_at - s.observed_at > interval '10 minutes'
      or (s.hunt_mode='reversal' and coalesce(s.reference_yesterday_price,0)<=0)
    );

  if v_bad_shadow<>0 then
    raise exception 'first-day shadow provenance invariant failed for % rows',v_bad_shadow;
  end if;

  select count(*) into v_bad_events
  from public.stock_hunter_hunt_events_v416 e
  where e.trade_date=v_trade_date
    and (
      e.source_version<>'4.1.6-server-v4-parity'
      or e.hunt_mode not in ('reversal','acceleration')
      or e.first_seen_at<v_start
      or (e.first_seen_at at time zone 'Asia/Tehran')::date<>e.trade_date
      or not coalesce(e.feature_vector_complete,false)
      or (e.hunt_mode='reversal' and coalesce(e.reference_yesterday_price,0)<=0)
    );

  if v_bad_events<>0 then
    raise exception 'first-day hunt-event provenance invariant failed for % rows',v_bad_events;
  end if;

  select count(*) into v_bad_outcomes
  from (
    select so.sample_id
    from public.stock_hunter_shadow_outcome_observations_v416 so
    join public.stock_hunter_shadow_samples_v416 s using(sample_id)
    where s.trade_date=v_trade_date
      and so.observation_date=v_trade_date
      and (
        so.observed_at < s.observed_at
        or so.candle_count<=0
        or so.high_price is null
        or so.low_price is null
        or so.close_price is null
      )
    union all
    select ho.event_id
    from public.stock_hunter_hunt_outcome_observations_v416 ho
    join public.stock_hunter_hunt_events_v416 e using(event_id)
    where e.trade_date=v_trade_date
      and ho.observation_date=v_trade_date
      and (
        ho.observed_at < e.first_seen_at
        or ho.candle_count<=0
        or ho.high_price is null
        or ho.low_price is null
        or ho.close_price is null
      )
  ) q;

  if v_bad_outcomes<>0 then
    raise exception 'first-day same-day outcome integrity failed for % rows',v_bad_outcomes;
  end if;

  -- No pre-prospective rows may appear in raw collection tables.
  if exists (
      select 1 from public.stock_hunter_shadow_samples_v416
      where observed_at<v_start
    )
    or exists (
      select 1 from public.stock_hunter_hunt_events_v416
      where first_seen_at<v_start
    ) then
    raise exception 'pre-prospective raw rows detected';
  end if;

  select count(*) into v_candidate_runs
  from public.stock_hunter_candidate_evaluation_runs_v416;

  select count(*) into v_calibration_rows
  from public.stock_hunter_calibration_dataset_v416;

  select count(*) into v_oos_manifest
  from public.stock_hunter_oos_release_manifest_v416;

  select count(*) into v_promotions
  from public.stock_hunter_promotion_proposals_v416;

  select count(*) into v_reviews
  from public.stock_hunter_activation_reviews_v417;

  select count(*) into v_release_pins
  from private.stock_hunter_release_pin_manifests_v417;

  -- Same-day data must not leak into mature calibration or downstream release state.
  if v_calibration_rows<>0
     or m.total_samples<>0
     or m.trade_dates<>0
     or m.oos_samples<>0
     or m.selected_modes<>0
     or m.robust_modes<>0
     or m.oos_unlocked
     or m.can_unlock_oos
     or cs.calibration_ready
     or cs.total_samples<>0
     or cs.trade_dates<>0
     or cc.oos_unlocked
     or cc.auto_promote
     or v_candidate_runs<>0
     or v_oos_manifest<>0
     or v_promotions<>0
     or v_reviews<>0
     or v_release_pins<>0 then
    raise exception 'same-day prospective data leaked into maturity/OOS/promotion/release state';
  end if;

  if v_now >= v_eod_deadline then
    if c.last_success_at is null or c.last_success_at<v_start or c.last_error is not null then
      raise exception 'first trading-day capture did not finish successfully: %',
        coalesce(c.last_error,'no successful capture after prospective start');
    end if;

    if v_shadow=0 then
      raise exception 'first trading-day capture produced zero shadow samples';
    end if;

    if v_shadow_outcomes=0 then
      raise exception 'first trading-day shadow outcome jobs produced zero same-day observations';
    end if;

    if v_events>0 and v_hunt_outcomes=0 then
      raise exception 'hunt events exist but same-day hunt outcomes are zero';
    end if;

    if o.last_error is not null
       or o.last_success_at is null
       or o.last_success_at < timestamptz '2026-09-19 13:45:00+00' then
      raise exception 'hunt outcome control did not finish cleanly after market close: %',
        coalesce(o.last_error,'missing close-run success');
    end if;

    select count(*) into v_capture_job_coverage
    from (
      select distinct j.jobname
      from cron.job j
      join cron.job_run_details d using(jobid)
      where j.jobname in (
        'stock-hunter-capture-v416-open',
        'stock-hunter-capture-v416-mid',
        'stock-hunter-capture-v416-close'
      )
        and d.status='succeeded'
        and d.start_time>=v_start
        and d.start_time<=v_eod_deadline
    ) q;

    if v_capture_job_coverage<>3 then
      raise exception 'not all three capture cron phases recorded a successful run';
    end if;

    select count(*) into v_downstream_job_coverage
    from (
      select distinct j.jobname
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
        and d.start_time>=timestamptz '2026-09-19 13:40:00+00'
        and d.start_time<=v_eod_deadline
    ) q;

    if v_downstream_job_coverage<>5 then
      raise exception 'not all five close/outcome/evaluator cron jobs recorded a successful run';
    end if;

    -- Latest run of each critical job must not be failed at EOD.
    select count(*) into v_latest_cron_bad
    from (
      select j.jobname,
             (
               select d.status
               from cron.job_run_details d
               where d.jobid=j.jobid
                 and d.start_time>=v_start
                 and d.start_time<=v_eod_deadline
               order by d.start_time desc
               limit 1
             ) as latest_status
      from cron.job j
      where j.jobname in (
        'stock-hunter-capture-v416-open',
        'stock-hunter-capture-v416-mid',
        'stock-hunter-capture-v416-close',
        'stock-hunter-outcomes-v416-close-a',
        'stock-hunter-outcomes-v416-close-b',
        'stock-hunter-shadow-outcomes-v416-close-a',
        'stock-hunter-shadow-outcomes-v416-close-b',
        'stock-hunter-candidate-evaluator-v416'
      )
    ) q
    where latest_status is distinct from 'succeeded';

    if v_latest_cron_bad<>0 then
      raise exception '% critical cron jobs do not have a successful latest EOD run',v_latest_cron_bad;
    end if;
  end if;
end $$;

select 'stock-hunter-prospective-eod-quality-v416: PASS' as result;
