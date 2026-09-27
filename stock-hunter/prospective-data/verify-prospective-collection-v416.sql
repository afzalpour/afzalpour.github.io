-- Stock Hunter 4.1.6 prospective real-data collection verification.
-- Read-only: raises if the collection/calibration boundary drifts.

do $$
declare
  v_start timestamptz;
  v_lag integer;
  v_cron_count integer;
  v_bad_prestart integer;
  v_bad_trade_date integer;
  v_bad_lag integer;
  v_def text;
begin
  select prospective_start_at,max_capture_lag_seconds
    into v_start,v_lag
    from public.stock_hunter_calibration_policy_v416
   where policy_id='default';

  if v_start is distinct from timestamptz '2026-09-19 05:30:00+00' then
    raise exception 'unexpected prospective_start_at: %',v_start;
  end if;
  if v_lag <> 600 then
    raise exception 'unexpected max_capture_lag_seconds: %',v_lag;
  end if;

  select count(*) into v_cron_count
    from cron.job
   where jobname in (
     'stock-hunter-capture-v416-open',
     'stock-hunter-capture-v416-mid',
     'stock-hunter-capture-v416-close'
   )
     and active
     and command like '%X-Stock-Hunter-Capture-Token%'
     and command like '%stock_hunter_capture_token_v416%'
     and command like '%stock_hunter_project_url_v416%';

  if v_cron_count <> 3 then
    raise exception 'capture cron contract mismatch: expected 3 Vault-backed active jobs, got %',v_cron_count;
  end if;

  select pg_get_viewdef('public.stock_hunter_calibration_dataset_v416'::regclass,true)
    into v_def;
  if position('prospective_start_at' in v_def)=0
     or position('max_capture_lag_seconds' in v_def)=0
     or position('Asia/Tehran' in v_def)=0 then
    raise exception 'calibration dataset is missing prospective provenance predicates';
  end if;

  select count(*) into v_bad_prestart
    from public.stock_hunter_calibration_dataset_v416 d
    join public.stock_hunter_shadow_samples_v416 s using(sample_id)
   where s.observed_at < v_start;
  if v_bad_prestart <> 0 then
    raise exception 'pre-start samples leaked into calibration: %',v_bad_prestart;
  end if;

  select count(*) into v_bad_trade_date
    from public.stock_hunter_calibration_dataset_v416 d
    join public.stock_hunter_shadow_samples_v416 s using(sample_id)
   where s.trade_date <> (s.observed_at at time zone 'Asia/Tehran')::date;
  if v_bad_trade_date <> 0 then
    raise exception 'trade_date/observed_at mismatch leaked into calibration: %',v_bad_trade_date;
  end if;

  select count(*) into v_bad_lag
    from public.stock_hunter_calibration_dataset_v416 d
    join public.stock_hunter_shadow_samples_v416 s using(sample_id)
   where s.created_at < s.observed_at - interval '2 minutes'
      or s.created_at > s.observed_at + (v_lag * interval '1 second');
  if v_bad_lag <> 0 then
    raise exception 'out-of-window capture lag leaked into calibration: %',v_bad_lag;
  end if;
end $$;

select 'stock-hunter-prospective-collection-v416: PASS' as result;
