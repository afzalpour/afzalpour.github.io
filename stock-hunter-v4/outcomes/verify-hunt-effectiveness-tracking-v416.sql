-- Stock Hunter Frozen Hunt 4.1.6 effectiveness tracking live verifier
-- Read-only except for calling internal status functions; no synthetic rows are created.

do $$
declare
  v_start date;
  v_retention integer;
  v_count integer;
begin
  select prospective_start_date,tape_retention_days
    into v_start,v_retention
  from public.stock_hunter_hunt_effectiveness_control_v416
  where singleton=true;

  if v_start is distinct from date '2026-09-26' then
    raise exception 'prospective_start_mismatch:%',v_start;
  end if;
  if v_retention is distinct from 30 then
    raise exception 'tape_retention_mismatch:%',v_retention;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'stock_hunter_hunt_effectiveness_control_v416',
      'stock_hunter_hunt_market_tape_v416',
      'stock_hunter_hunt_effectiveness_v416'
    )
    and c.relrowsecurity=true;
  if v_count<>3 then raise exception 'rls_table_count:%',v_count; end if;

  if has_table_privilege('anon','public.stock_hunter_hunt_effectiveness_control_v416','select')
     or has_table_privilege('anon','public.stock_hunter_hunt_market_tape_v416','select')
     or has_table_privilege('anon','public.stock_hunter_hunt_effectiveness_v416','select')
     or has_table_privilege('authenticated','public.stock_hunter_hunt_effectiveness_v416','select')
  then
    raise exception 'public_table_grant_leak';
  end if;

  if to_regprocedure('private.capture_stock_hunter_hunt_market_tape_v416()') is null
     or to_regprocedure('private.refresh_stock_hunter_hunt_effectiveness_v416()') is null
  then
    raise exception 'internal_function_missing';
  end if;

  if has_function_privilege('anon','private.capture_stock_hunter_hunt_market_tape_v416()','execute')
     or has_function_privilege('authenticated','private.refresh_stock_hunter_hunt_effectiveness_v416()','execute')
  then
    raise exception 'public_function_execute_leak';
  end if;

  select count(*) into v_count
  from cron.job
  where active
    and jobname in (
      'stock-hunter-hunt-tape-v416-open',
      'stock-hunter-hunt-tape-v416-mid',
      'stock-hunter-hunt-tape-v416-close',
      'stock-hunter-hunt-effectiveness-v416-close-a',
      'stock-hunter-hunt-effectiveness-v416-close-b'
    );
  if v_count<>5 then raise exception 'cron_count:%',v_count; end if;

  select
    (select count(*) from public.stock_hunter_hunt_events_v416 where symbol_id='__HUNT_EFFECTIVENESS_PROBE__')
    +(select count(*) from public.stock_hunter_hunt_market_tape_v416 where symbol_id='__HUNT_EFFECTIVENESS_PROBE__')
    +(select count(*) from public.stock_hunter_hunt_effectiveness_v416 where symbol_id='__HUNT_EFFECTIVENESS_PROBE__')
  into v_count;
  if v_count<>0 then raise exception 'probe_residue:%',v_count; end if;
end $$;

select
  singleton,prospective_start_date,tape_retention_days,
  last_tape_capture_at,last_tape_capture_count,
  last_refresh_at,last_refresh_count,last_error
from public.stock_hunter_hunt_effectiveness_control_v416;

select jobid,jobname,schedule,active
from cron.job
where jobname like 'stock-hunter-hunt-%v416%'
order by jobname;

select *
from public.stock_hunter_hunt_effectiveness_summary_v416
order by channel,hunt_mode,hunt_state,asset_type;
