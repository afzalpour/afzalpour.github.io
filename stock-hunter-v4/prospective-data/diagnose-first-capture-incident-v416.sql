-- Stock Hunter 4.1.6 first-capture incident diagnostics.
-- Read-only. No retries, capture calls, backfills, cron edits, traffic changes, or lifecycle mutations.
-- Structural contract violations raise; operational conditions are classified in the final row.

do $$
declare
  v_start timestamptz;
  v_lag integer;
  v_capture_jobs integer;
  v_v417_callers integer;
  v_vault_names integer;
begin
  select prospective_start_at,max_capture_lag_seconds
    into strict v_start,v_lag
  from public.stock_hunter_prospective_collection_status_v416;

  if v_start is distinct from timestamptz '2026-09-19 05:30:00+00'
     or v_lag<>600 then
    raise exception 'frozen prospective boundary/lag contract drifted';
  end if;

  select count(*) into v_capture_jobs
  from cron.job
  where active
    and jobname in (
      'stock-hunter-capture-v416-open',
      'stock-hunter-capture-v416-mid',
      'stock-hunter-capture-v416-close'
    )
    and command ilike '%/functions/v1/stock-hunter-capture-v416%'
    and command ilike '%stock_hunter_project_url_v416%'
    and command ilike '%stock_hunter_capture_token_v416%'
    and command ilike '%X-Stock-Hunter-Capture-Token%';

  if v_capture_jobs<>3 then
    raise exception 'first-capture scheduler contract drifted: expected 3 valid v416 jobs, got %',
      v_capture_jobs;
  end if;

  select count(*) into v_v417_callers
  from cron.job
  where active and command ilike '%/functions/v1/stock-hunter-capture-v417%';

  if v_v417_callers<>0 then
    raise exception 'dark capture-v417 has % active cron caller(s)',v_v417_callers;
  end if;

  select count(distinct name) into v_vault_names
  from vault.decrypted_secrets
  where name in ('stock_hunter_project_url_v416','stock_hunter_capture_token_v416');

  if v_vault_names<>2 then
    raise exception 'capture Vault dependency names are incomplete';
  end if;

  if has_function_privilege('anon','public.claim_stock_hunter_capture_v416()','EXECUTE')
     or has_function_privilege('authenticated','public.claim_stock_hunter_capture_v416()','EXECUTE')
     or has_function_privilege('anon','public.finish_stock_hunter_capture_v416(integer,text)','EXECUTE')
     or has_function_privilege('authenticated','public.finish_stock_hunter_capture_v416(integer,text)','EXECUTE')
     or has_function_privilege('anon','public.stock_hunter_validate_capture_token_v416(text)','EXECUTE')
     or has_function_privilege('authenticated','public.stock_hunter_validate_capture_token_v416(text)','EXECUTE') then
    raise exception 'capture internal RPC unexpectedly exposed to anon/authenticated';
  end if;
end $$;

with
cfg as (
  select *
  from public.stock_hunter_prospective_collection_status_v416
),
workers as (
  select
    exists(
      select 1 from pg_stat_activity
      where application_name ilike 'pg_cron scheduler'
    ) as cron_scheduler_alive,
    exists(
      select 1 from pg_stat_activity
      where backend_type ilike '%pg_net%'
    ) as pg_net_worker_alive
),
runs as (
  select
    count(*)::bigint as run_count,
    count(*) filter(where d.status='succeeded')::bigint as success_count,
    count(*) filter(where d.status not in ('succeeded','running'))::bigint as failure_count,
    max(d.start_time) as latest_run_at,
    (array_agg(d.status order by d.start_time desc))[1] as latest_status,
    (array_agg(d.return_message order by d.start_time desc))[1] as latest_return_message
  from cron.job_run_details d
  join cron.job j on j.jobid=d.jobid
  cross join cfg
  where j.jobname in (
    'stock-hunter-capture-v416-open',
    'stock-hunter-capture-v416-mid',
    'stock-hunter-capture-v416-close'
  )
    and d.start_time>=cfg.prospective_start_at
),
net_errors as (
  select
    count(*)::bigint as recent_error_count,
    max(created) as latest_error_at,
    max(status_code) filter(where status_code>=400) as max_error_status
  from net._http_response
  cross join cfg
  where created>=cfg.prospective_start_at
    and (status_code>=400 or error_msg is not null)
),
diag as (
  select
    now() as live_checked_at,
    cfg.*,
    workers.*,
    runs.*,
    net_errors.*,
    case
      when now()<cfg.prospective_start_at
        then 'WAITING_FOR_FIRST_MARKET_WINDOW'
      when now()<cfg.prospective_start_at+interval '10 minutes'
        then 'WITHIN_FIRST_CAPTURE_GRACE'
      when not workers.cron_scheduler_alive
        then 'CRON_SCHEDULER_DOWN'
      when not workers.pg_net_worker_alive
        then 'PG_NET_WORKER_DOWN'
      when runs.run_count=0
        then 'CAPTURE_CRON_NOT_RUN'
      when runs.success_count=0 and runs.failure_count>0
        then 'CAPTURE_CRON_FAILED'
      when cfg.capture_last_run_at is null
        or cfg.capture_last_run_at<cfg.prospective_start_at
        then 'CAPTURE_NOT_CLAIMED'
      when nullif(cfg.capture_last_error,'') is not null
        then 'CAPTURE_REPORTED_ERROR'
      when cfg.capture_last_success_at is null
        or cfg.capture_last_success_at<cfg.prospective_start_at
        then 'CAPTURE_NO_SUCCESS'
      when cfg.capture_last_success_at<cfg.capture_last_run_at-interval '3 minutes'
        then 'CAPTURE_SUCCESS_STALE'
      when cfg.shadow_samples_total=0
        then 'CAPTURE_SUCCESS_ZERO_SHADOW_OBSERVED'
      else 'FIRST_CAPTURE_HEALTHY'
    end as diagnostic_state
  from cfg
  cross join workers
  cross join runs
  cross join net_errors
)
select
  'stock-hunter-first-capture-incident-readiness-v416' as verifier,
  case
    when diagnostic_state in (
      'CRON_SCHEDULER_DOWN','PG_NET_WORKER_DOWN','CAPTURE_CRON_NOT_RUN',
      'CAPTURE_CRON_FAILED','CAPTURE_NOT_CLAIMED','CAPTURE_REPORTED_ERROR',
      'CAPTURE_NO_SUCCESS','CAPTURE_SUCCESS_STALE'
    ) then 'ERROR'
    when diagnostic_state='CAPTURE_SUCCESS_ZERO_SHADOW_OBSERVED' then 'WARN'
    else 'PASS'
  end as severity,
  diagnostic_state,
  live_checked_at as checked_at,
  prospective_start_at,
  collection_state,
  cron_scheduler_alive,
  pg_net_worker_alive,
  run_count as capture_cron_runs_after_start,
  success_count as capture_cron_successes_after_start,
  failure_count as capture_cron_failures_after_start,
  latest_run_at as latest_capture_cron_run_at,
  latest_status as latest_capture_cron_status,
  latest_return_message as latest_capture_cron_message,
  capture_last_run_at,
  capture_last_success_at,
  capture_last_event_count,
  capture_last_error,
  shadow_samples_total,
  reversal_shadow_samples,
  acceleration_shadow_samples,
  events_total,
  recent_error_count as pg_net_errors_after_start,
  latest_error_at as latest_pg_net_error_at,
  max_error_status as max_pg_net_error_status,
  case diagnostic_state
    when 'WAITING_FOR_FIRST_MARKET_WINDOW'
      then 'No action. Preserve the prospective boundary.'
    when 'WITHIN_FIRST_CAPTURE_GRACE'
      then 'No repair yet. Observe until the +10 minute launch grace expires.'
    when 'CRON_SCHEDULER_DOWN'
      then 'Manual incident: verify pg_cron scheduler/instance health before considering a controlled platform restart.'
    when 'PG_NET_WORKER_DOWN'
      then 'Manual incident: verify pg_net worker and platform health; do not backfill observations.'
    when 'CAPTURE_CRON_NOT_RUN'
      then 'Manual incident: inspect cron.job_run_details and scheduler health; do not trigger synthetic/backfilled capture.'
    when 'CAPTURE_CRON_FAILED'
      then 'Manual incident: inspect latest cron return_message and PostgreSQL logs; preserve original timestamps.'
    when 'CAPTURE_NOT_CLAIMED'
      then 'Manual incident: cron invoked but capture state was not claimed; inspect Edge Function/auth/RPC path.'
    when 'CAPTURE_REPORTED_ERROR'
      then 'Manual incident: inspect capture_last_error and Edge Function logs; do not clear the error field manually.'
    when 'CAPTURE_NO_SUCCESS'
      then 'Manual incident: inspect Edge Function/Vault/token/network path; do not fabricate success state.'
    when 'CAPTURE_SUCCESS_STALE'
      then 'Manual incident: capture started but recent success is stale; inspect repeated cron/HTTP execution.'
    when 'CAPTURE_SUCCESS_ZERO_SHADOW_OBSERVED'
      then 'Warning only at first capture. Confirm subsequent real batches before treating zero Shadow as a data-path incident.'
    else 'No remediation. Continue natural prospective collection.'
  end as manual_next_action
from diag;
