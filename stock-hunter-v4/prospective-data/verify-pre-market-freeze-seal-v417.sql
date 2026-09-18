-- Stock Hunter 4.1.7 pre-market freeze seal.
-- Read-only. Proves live state remains frozen until the first natural prospective market window.
do $$
declare
  v_start timestamptz;
  v_state text;
  v_capture_last_run timestamptz;
  v_capture_last_success timestamptz;
  v_capture_last_error text;
  v_shadow bigint;
  v_events bigint;
  v_mature bigint;
  v_capture_jobs integer;
  v_downstream_jobs integer;
  v_v417_callers integer;
  v_vault_names integer;
  v_oos integer;
  v_promotion integer;
  v_reviews integer;
  v_release_pin integer;
  v_routing text;
  v_traffic integer;
  v_kill boolean;
  v_state_version bigint;
  v_review_id bigint;
begin
  select prospective_start_at,collection_state,capture_last_run_at,capture_last_success_at,capture_last_error,
         shadow_samples_total,events_total,calibration_mature_samples
    into strict v_start,v_state,v_capture_last_run,v_capture_last_success,v_capture_last_error,v_shadow,v_events,v_mature
  from public.stock_hunter_prospective_collection_status_v416;

  if v_start is distinct from timestamptz '2026-09-19 05:30:00+00' then
    raise exception 'prospective start drifted: %',v_start;
  end if;
  if now() >= v_start then
    raise exception 'pre-market freeze verifier expired; use launch/incident verifier';
  end if;
  if v_state <> 'ARMED_AWAITING_FIRST_MARKET_WINDOW' then
    raise exception 'pre-market collection state drifted: %',v_state;
  end if;
  if v_capture_last_run is not null or v_capture_last_success is not null or nullif(v_capture_last_error,'') is not null then
    raise exception 'capture state mutated before prospective start';
  end if;
  if v_shadow<>0 or v_events<>0 or v_mature<>0 then
    raise exception 'prospective data appeared before prospective start';
  end if;

  select count(*) into v_capture_jobs
  from cron.job
  where active
    and (
      (jobname='stock-hunter-capture-v416-open' and schedule='30-59 5 * * 0-3,6')
      or (jobname='stock-hunter-capture-v416-mid' and schedule='* 6-12 * * 0-3,6')
      or (jobname='stock-hunter-capture-v416-close' and schedule='0-30 13 * * 0-3,6')
    )
    and command ilike '%/functions/v1/stock-hunter-capture-v416%'
    and command ilike '%stock_hunter_project_url_v416%'
    and command ilike '%stock_hunter_capture_token_v416%'
    and command ilike '%X-Stock-Hunter-Capture-Token%';
  if v_capture_jobs<>3 then raise exception 'capture scheduler freeze drifted'; end if;

  select count(*) into v_downstream_jobs
  from cron.job
  where active and (
    (jobname='stock-hunter-outcomes-v416-close-a' and schedule='45 13 * * 0-3,6')
    or (jobname='stock-hunter-outcomes-v416-close-b' and schedule='15 14 * * 0-3,6')
    or (jobname='stock-hunter-shadow-outcomes-v416-close-a' and schedule='50 13 * * 0-3,6')
    or (jobname='stock-hunter-shadow-outcomes-v416-close-b' and schedule='20 14 * * 0-3,6')
    or (jobname='stock-hunter-candidate-evaluator-v416' and schedule='45 14 * * 0-3,6')
  );
  if v_downstream_jobs<>5 then raise exception 'downstream scheduler freeze drifted'; end if;

  select count(*) into v_v417_callers from cron.job
  where active and command ilike '%/functions/v1/stock-hunter-capture-v417%';
  if v_v417_callers<>0 then raise exception 'dark capture-v417 gained active caller(s)'; end if;

  select count(distinct name) into v_vault_names
  from vault.decrypted_secrets
  where name in ('stock_hunter_project_url_v416','stock_hunter_capture_token_v416');
  if v_vault_names<>2 then raise exception 'capture Vault dependency names incomplete'; end if;

  if not exists(select 1 from pg_stat_activity where application_name ilike 'pg_cron scheduler') then
    raise exception 'pg_cron scheduler worker is not alive';
  end if;
  if not exists(select 1 from pg_stat_activity where backend_type ilike '%pg_net%') then
    raise exception 'pg_net worker is not alive';
  end if;

  select routing_mode,challenger_traffic_percent,kill_switch_engaged,state_version,activation_review_id
    into strict v_routing,v_traffic,v_kill,v_state_version,v_review_id
  from public.stock_hunter_activation_status_v417 where status_id='default';

  if v_routing<>'CHAMPION_ONLY' or v_traffic<>0 or v_kill is distinct from true or v_state_version<>1 or v_review_id is not null then
    raise exception 'activation control plane drifted before launch';
  end if;

  select count(*) into v_oos from public.stock_hunter_oos_release_manifest_v416;
  select count(*) into v_promotion from public.stock_hunter_promotion_proposals_v416;
  select count(*) into v_reviews from public.stock_hunter_activation_reviews_v417;
  select count(*) into v_release_pin from private.stock_hunter_release_pin_manifests_v417;
  if v_oos<>0 or v_promotion<>0 or v_reviews<>0 or v_release_pin<>0 then
    raise exception 'downstream lifecycle advanced before prospective launch';
  end if;
end $$;

select 'stock-hunter-pre-market-freeze-seal-v417' as verifier,'PASS' as result,now() as checked_at,
       prospective_start_at,collection_state,capture_last_run_at,capture_last_success_at,capture_last_error,
       shadow_samples_total,events_total,calibration_mature_samples,
       'NO_MUTATION_UNTIL_FIRST_NATURAL_MARKET_WINDOW' as freeze_rule
from public.stock_hunter_prospective_collection_status_v416;