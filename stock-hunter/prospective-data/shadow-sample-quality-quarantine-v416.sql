-- Stock Hunter 4.1.6 prospective sample-quality quarantine.
-- Applied after the 2026-09-21 pre-v7 feed/capture freshness incident.
-- No source Shadow Sample is deleted or rewritten. Quarantine is additive and immutable.

create table if not exists public.stock_hunter_shadow_sample_exclusions_v416 (
  sample_id bigint primary key
    references public.stock_hunter_shadow_samples_v416(sample_id),
  reason_code text not null,
  reason_detail text not null,
  evidence_observed_at timestamptz not null,
  exclusion_protocol text not null default '4.1.6-quality-quarantine-v1',
  excluded_at timestamptz not null default now(),
  constraint stock_hunter_shadow_sample_exclusion_protocol_v416_ck
    check (exclusion_protocol='4.1.6-quality-quarantine-v1'),
  constraint stock_hunter_shadow_sample_exclusion_reason_v416_ck
    check (reason_code in (
      'PROVEN_STALE_OVER_180_ALL_ROWS',
      'MIXED_PRE_FIX_CAPTURE_CONSERVATIVE_QUARANTINE'
    ))
);

alter table public.stock_hunter_shadow_sample_exclusions_v416 enable row level security;

revoke all on public.stock_hunter_shadow_sample_exclusions_v416
  from public,anon,authenticated;
grant select on public.stock_hunter_shadow_sample_exclusions_v416
  to anon,authenticated,service_role;

drop policy if exists stock_hunter_shadow_sample_exclusions_read_v416
  on public.stock_hunter_shadow_sample_exclusions_v416;
create policy stock_hunter_shadow_sample_exclusions_read_v416
  on public.stock_hunter_shadow_sample_exclusions_v416
  for select to anon,authenticated
  using (true);

create or replace function private.reject_stock_hunter_shadow_sample_exclusion_mutation_v416()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'shadow sample quality exclusions are immutable';
end;
$$;

revoke all on function private.reject_stock_hunter_shadow_sample_exclusion_mutation_v416()
  from public,anon,authenticated,service_role;

drop trigger if exists stock_hunter_shadow_sample_exclusions_immutable_v416
  on public.stock_hunter_shadow_sample_exclusions_v416;
create trigger stock_hunter_shadow_sample_exclusions_immutable_v416
before update or delete or truncate
on public.stock_hunter_shadow_sample_exclusions_v416
for each statement
execute function private.reject_stock_hunter_shadow_sample_exclusion_mutation_v416();

insert into public.stock_hunter_shadow_sample_exclusions_v416(
  sample_id,reason_code,reason_detail,evidence_observed_at
)
select
  s.sample_id,
  'PROVEN_STALE_OVER_180_ALL_ROWS',
  '2026-09-21 06:15 capture: all 146 rows were independently proven older than the 180-second source freshness limit before v7',
  timestamptz '2026-09-21 06:15:06.620+00'
from public.stock_hunter_shadow_samples_v416 s
where s.trade_date=date '2026-09-21'
  and s.observed_at>=timestamptz '2026-09-21 06:15:06+00'
  and s.observed_at<timestamptz '2026-09-21 06:15:07+00'
on conflict(sample_id) do nothing;

insert into public.stock_hunter_shadow_sample_exclusions_v416(
  sample_id,reason_code,reason_detail,evidence_observed_at
)
select
  s.sample_id,
  'MIXED_PRE_FIX_CAPTURE_CONSERVATIVE_QUARANTINE',
  '2026-09-21 07:34 pre-v7 capture: 74 of 292 rows were independently proven older than 180 seconds, but the exact stale subset was not durably recorded; quarantine the complete capture burst to avoid false-clean evidence',
  timestamptz '2026-09-21 07:34:39.902+00'
from public.stock_hunter_shadow_samples_v416 s
where s.trade_date=date '2026-09-21'
  and s.observed_at>=timestamptz '2026-09-21 07:34:39+00'
  and s.observed_at<timestamptz '2026-09-21 07:34:40+00'
on conflict(sample_id) do nothing;

create or replace view public.stock_hunter_calibration_dataset_v416
with (security_invoker=true)
as
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
    and s.created_at<=s.observed_at+(p.max_capture_lag_seconds * interval '1 second')
    and not exists (
      select 1
      from public.stock_hunter_shadow_sample_exclusions_v416 q
      where q.sample_id=s.sample_id
    )
), dates as (
  select trade_date,
         dense_rank() over(order by trade_date) as date_rank,
         count(*) over() as date_count
  from (select distinct trade_date from mature) d
), live_base as (
  select m.*,
         d.date_rank,d.date_count,
         case
           when d.date_count=0 then 'insufficient'
           when d.date_rank<=ceil(d.date_count*0.60) then 'train'
           when d.date_rank<=ceil(d.date_count*0.80) then 'validation'
           else 'oos'
         end as split,
         1.0 / count(*) over(partition by m.trade_date,m.symbol_id)::numeric as cluster_weight
  from mature m
  join dates d using(trade_date)
), freeze_state as (
  select exists(select 1 from public.stock_hunter_oos_release_dataset_v416) as frozen
), rows_union as (
  select
    b.sample_id,b.trade_date,b.symbol_id,b.symbol,b.company_name,b.hunt_mode,b.observed_at,b.bucket_minute,
    b.price,b.day_change,b.order_pressure,b.impulse,b.feasibility,b.flow_volume,b.market_context,b.continuation12,
    b.risk_score,b.cancellation_ratio,b.evidence_count,b.dynamic_evidence_count,b.baseline_today_opportunity,
    b.baseline_hunt_score,b.baseline_state,b.gate_reason,b.source_version,b.return_1d_pct,b.return_2d_pct,
    b.return_3d_pct,b.mfe_1d_pct,b.mae_1d_pct,b.mfe_3d_pct,b.mae_3d_pct,b.future_sessions_observed,
    b.positive_1d,b.hit_plus_1pct_1d,b.hit_minus_1pct_3d,b.date_rank,b.date_count,b.split,b.cluster_weight
  from live_base b
  cross join freeze_state s
  where not s.frozen

  union all

  select
    f.sample_id,f.trade_date,f.symbol_id,f.symbol,f.company_name,f.hunt_mode,f.observed_at,f.bucket_minute,
    f.price,f.day_change,f.order_pressure,f.impulse,f.feasibility,f.flow_volume,f.market_context,f.continuation12,
    f.risk_score,f.cancellation_ratio,f.evidence_count,f.dynamic_evidence_count,f.baseline_today_opportunity,
    f.baseline_hunt_score,f.baseline_state,f.gate_reason,f.source_version,f.return_1d_pct,f.return_2d_pct,
    f.return_3d_pct,f.mfe_1d_pct,f.mae_1d_pct,f.mfe_3d_pct,f.mae_3d_pct,f.future_sessions_observed,
    f.positive_1d,f.hit_plus_1pct_1d,f.hit_minus_1pct_3d,f.date_rank,f.date_count,f.split,f.cluster_weight
  from public.stock_hunter_oos_release_dataset_v416 f
  cross join freeze_state s
  where s.frozen
)
select * from rows_union;

grant select on public.stock_hunter_calibration_dataset_v416 to anon,authenticated,service_role;

-- Guardrails: expected incident quarantine size is deterministic.
do $$
declare
  v_total bigint;
  v_proven bigint;
  v_mixed bigint;
begin
  select count(*),
         count(*) filter(where reason_code='PROVEN_STALE_OVER_180_ALL_ROWS'),
         count(*) filter(where reason_code='MIXED_PRE_FIX_CAPTURE_CONSERVATIVE_QUARANTINE')
  into v_total,v_proven,v_mixed
  from public.stock_hunter_shadow_sample_exclusions_v416;

  if v_total<>438 or v_proven<>146 or v_mixed<>292 then
    raise exception 'unexpected shadow quality quarantine cardinality: total %, proven %, mixed %',
      v_total,v_proven,v_mixed;
  end if;

  if exists (
    select 1
    from public.stock_hunter_calibration_dataset_v416 d
    join public.stock_hunter_shadow_sample_exclusions_v416 q using(sample_id)
  ) then
    raise exception 'quarantined Shadow Sample leaked into calibration dataset';
  end if;
end $$;
