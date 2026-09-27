-- Mirror of applied Supabase migration:
-- stock_hunter_prospective_collection_guard_v416_20260917
-- Applied 2026-09-17 to the Stock Hunter capture/calibration project.

alter table public.stock_hunter_calibration_policy_v416
  add column if not exists prospective_start_at timestamptz,
  add column if not exists max_capture_lag_seconds integer not null default 600;

update public.stock_hunter_calibration_policy_v416
set prospective_start_at=timestamptz '2026-09-19 05:30:00+00',updated_at=now()
where policy_id='default' and prospective_start_at is null;

alter table public.stock_hunter_calibration_policy_v416
  alter column prospective_start_at set not null;

create or replace view public.stock_hunter_calibration_dataset_v416
with (security_invoker=true) as
with p as (
  select prospective_start_at,max_capture_lag_seconds
  from public.stock_hunter_calibration_policy_v416
  where policy_id='default'
), mature as (
  select
    o.sample_id,o.trade_date,o.symbol_id,o.symbol,o.company_name,o.hunt_mode,o.observed_at,o.bucket_minute,
    o.price,o.day_change,o.order_pressure,o.impulse,o.feasibility,o.flow_volume,o.market_context,o.continuation12,
    o.risk_score,o.cancellation_ratio,o.evidence_count,o.dynamic_evidence_count,o.baseline_today_opportunity,
    o.baseline_hunt_score,o.baseline_state,o.gate_reason,o.source_version,o.return_1d_pct,o.return_2d_pct,
    o.return_3d_pct,o.mfe_1d_pct,o.mae_1d_pct,o.mfe_3d_pct,o.mae_3d_pct,o.future_sessions_observed,
    o.positive_1d,o.hit_plus_1pct_1d,o.hit_minus_1pct_3d
  from public.stock_hunter_shadow_outcomes_v416 o
  join public.stock_hunter_shadow_samples_v416 s on s.sample_id=o.sample_id
  cross join p
  where o.future_sessions_observed>=3
    and o.gate_reason=''
    and s.observed_at>=p.prospective_start_at
    and s.trade_date=(s.observed_at at time zone 'Asia/Tehran')::date
    and s.created_at>=s.observed_at-interval '2 minutes'
    and s.created_at<=s.observed_at+(p.max_capture_lag_seconds*interval '1 second')
), dates as (
  select d.trade_date,dense_rank() over(order by d.trade_date) date_rank,count(*) over() date_count
  from (select distinct trade_date from mature) d
), base as (
  select m.*,d.date_rank,d.date_count,
    case when d.date_count=0 then 'insufficient'
         when d.date_rank<=ceil(d.date_count*0.60) then 'train'
         when d.date_rank<=ceil(d.date_count*0.80) then 'validation'
         else 'oos' end split,
    1.0/count(*) over(partition by m.trade_date,m.symbol_id) cluster_weight
  from mature m join dates d using(trade_date)
)
select sample_id,trade_date,symbol_id,symbol,company_name,hunt_mode,observed_at,bucket_minute,price,day_change,
       order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,
       evidence_count,dynamic_evidence_count,baseline_today_opportunity,baseline_hunt_score,baseline_state,gate_reason,
       source_version,return_1d_pct,return_2d_pct,return_3d_pct,mfe_1d_pct,mae_1d_pct,mfe_3d_pct,mae_3d_pct,
       future_sessions_observed,positive_1d,hit_plus_1pct_1d,hit_minus_1pct_3d,date_rank,date_count,split,cluster_weight
from base;

grant select on public.stock_hunter_calibration_dataset_v416 to anon,authenticated;

create or replace view public.stock_hunter_prospective_collection_status_v416
with (security_invoker=true) as
with p as (
  select prospective_start_at,max_capture_lag_seconds
  from public.stock_hunter_calibration_policy_v416 where policy_id='default'
), c as (
  select last_run_at,last_success_at,last_event_count,last_error,updated_at
  from public.stock_hunter_capture_state_v416 where singleton=true
), s as (
  select count(*)::bigint shadow_samples_total,
         count(*) filter(where hunt_mode='reversal')::bigint reversal_shadow_samples,
         count(*) filter(where hunt_mode='acceleration')::bigint acceleration_shadow_samples,
         min(observed_at) first_shadow_at,max(observed_at) last_shadow_at
  from public.stock_hunter_shadow_samples_v416
), e as (
  select count(*)::bigint events_total,
         count(*) filter(where hunt_state='شکار ویژه')::bigint special_events,
         count(*) filter(where hunt_state='هشدار فوری')::bigint urgent_events
  from public.stock_hunter_hunt_events_v416
), d as (
  select count(*)::bigint calibration_mature_samples,
         count(*) filter(where hunt_mode='reversal')::bigint calibration_reversal_samples,
         count(*) filter(where hunt_mode='acceleration')::bigint calibration_acceleration_samples
  from public.stock_hunter_calibration_dataset_v416
)
select now() checked_at,p.prospective_start_at,p.max_capture_lag_seconds,
       c.last_run_at capture_last_run_at,c.last_success_at capture_last_success_at,
       c.last_event_count capture_last_event_count,c.last_error capture_last_error,
       s.shadow_samples_total,s.reversal_shadow_samples,s.acceleration_shadow_samples,s.first_shadow_at,s.last_shadow_at,
       e.events_total,e.special_events,e.urgent_events,
       d.calibration_mature_samples,d.calibration_reversal_samples,d.calibration_acceleration_samples,
       case when now()<p.prospective_start_at then 'ARMED_AWAITING_FIRST_MARKET_WINDOW'
            when c.last_run_at is null then 'NO_CAPTURE_AFTER_START'
            when c.last_error is not null then 'CAPTURE_ERROR'
            else 'COLLECTING' end collection_state
from p cross join c cross join s cross join e cross join d;

revoke all on public.stock_hunter_prospective_collection_status_v416 from public,anon,authenticated;
grant select on public.stock_hunter_prospective_collection_status_v416 to service_role;

-- The applied migration also unschedules/recreates the three capture pg_cron jobs
-- (`open`, `mid`, `close`) with the same schedules, reading both the project URL
-- and `stock_hunter_capture_token_v416` from Supabase Vault at run time and sending
-- the secret only through `X-Stock-Hunter-Capture-Token`.
-- Secret values are intentionally not present in this repository mirror.
