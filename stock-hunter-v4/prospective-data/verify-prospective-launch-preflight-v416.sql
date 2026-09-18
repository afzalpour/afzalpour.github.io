-- Stock Hunter 4.1.6 prospective collection launch preflight.
-- State-aware around the first eligible market window.
-- Expected row: stock-hunter-prospective-launch-preflight-v416: PASS

do $$
declare
  p public.stock_hunter_calibration_policy_v416%rowtype;
  s public.stock_hunter_prospective_collection_status_v416%rowtype;
  c public.stock_hunter_capture_state_v416%rowtype;
  a public.stock_hunter_activation_status_v417%rowtype;
  active_capture_jobs integer;
  valid_capture_jobs integer;
  outcome_jobs integer;
  now_utc timestamptz := now();
begin
  select * into strict p
  from public.stock_hunter_calibration_policy_v416
  where policy_id='default';

  select * into strict s
  from public.stock_hunter_prospective_collection_status_v416;

  select * into strict c
  from public.stock_hunter_capture_state_v416
  where singleton=true;

  select * into strict a
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if p.prospective_start_at is distinct from timestamptz '2026-09-19 05:30:00+00'
     or p.max_capture_lag_seconds<>600
     or p.engine_version<>'4.1.6-hunt-v2' then
    raise exception 'prospective launch policy mismatch';
  end if;

  select
    count(*) filter (where active),
    count(*) filter (
      where active
        and command ilike '%X-Stock-Hunter-Capture-Token%'
        and command ilike '%stock_hunter_capture_token_v416%'
        and command ilike '%stock_hunter_project_url_v416%'
        and command ilike '%stock-hunter-capture-v416%'
    )
  into active_capture_jobs,valid_capture_jobs
  from cron.job
  where jobname in (
    'stock-hunter-capture-v416-open',
    'stock-hunter-capture-v416-mid',
    'stock-hunter-capture-v416-close'
  );

  if active_capture_jobs<>3 or valid_capture_jobs<>3 then
    raise exception 'capture cron/Vault contract mismatch';
  end if;

  if not exists (
       select 1 from cron.job
       where jobname='stock-hunter-capture-v416-open'
         and active and schedule='30-59 5 * * 0-3,6'
     )
     or not exists (
       select 1 from cron.job
       where jobname='stock-hunter-capture-v416-mid'
         and active and schedule='* 6-12 * * 0-3,6'
     )
     or not exists (
       select 1 from cron.job
       where jobname='stock-hunter-capture-v416-close'
         and active and schedule='0-30 13 * * 0-3,6'
     ) then
    raise exception 'capture schedule mismatch';
  end if;

  if not exists (
       select 1 from vault.decrypted_secrets
       where name='stock_hunter_capture_token_v416'
     )
     or not exists (
       select 1 from vault.decrypted_secrets
       where name='stock_hunter_project_url_v416'
     ) then
    raise exception 'required capture Vault secret reference missing';
  end if;

  select count(*) into outcome_jobs
  from cron.job
  where active and jobname in (
    'stock-hunter-outcomes-v416-close-a',
    'stock-hunter-outcomes-v416-close-b',
    'stock-hunter-shadow-outcomes-v416-close-a',
    'stock-hunter-shadow-outcomes-v416-close-b',
    'stock-hunter-candidate-evaluator-v416'
  );

  if outcome_jobs<>5 then
    raise exception 'outcome/evaluator cron contract mismatch';
  end if;

  if c.last_error is not null then
    raise exception 'capture state has live error: %',c.last_error;
  end if;

  if a.routing_mode<>'CHAMPION_ONLY'
     or a.challenger_traffic_percent<>0
     or not a.kill_switch_engaged
     or a.activation_review_id is not null then
    raise exception 'activation control plane is not locked during prospective launch';
  end if;

  if now_utc < p.prospective_start_at then
    if s.collection_state<>'ARMED_AWAITING_FIRST_MARKET_WINDOW'
       or c.last_run_at is not null
       or c.last_success_at is not null
       or exists(select 1 from public.stock_hunter_hunt_events_v416)
       or exists(select 1 from public.stock_hunter_shadow_samples_v416)
       or exists(select 1 from public.stock_hunter_calibration_dataset_v416) then
      raise exception 'pre-launch state is not clean/armed';
    end if;
  elsif now_utc >= p.prospective_start_at + interval '10 minutes' then
    if c.last_run_at is null or c.last_run_at < p.prospective_start_at then
      raise exception 'first eligible capture did not run within launch grace window';
    end if;
    if s.collection_state not in ('COLLECTING','CAPTURE_ERROR') then
      raise exception 'unexpected post-launch collection state: %',s.collection_state;
    end if;
    if s.collection_state='CAPTURE_ERROR' or c.last_error is not null then
      raise exception 'first-window capture failed: %',coalesce(c.last_error,'unknown');
    end if;
  end if;
end $$;

select 'stock-hunter-prospective-launch-preflight-v416: PASS' as result;
