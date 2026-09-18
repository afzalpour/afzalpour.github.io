-- Stock Hunter 4.1.7 staged Canary live-close hardening.
-- Scope: 5 -> 10 -> 25 -> 50 only.
-- No authorization/start/advance/rollback is performed by this migration.

create or replace view public.stock_hunter_canary_expansion_stage_metrics_v417
with (security_invoker=true)
as
with s as (
  select
    activation_review_id,
    state_version,
    routing_mode,
    challenger_traffic_percent,
    kill_switch_engaged,
    last_transition_at
  from public.stock_hunter_activation_status_v417
  where status_id='default'
),
src as (
  select
    t.*,
    public.stock_hunter_route_bucket_v417(t.trade_date,t.symbol_id) as route_bucket
  from public.stock_hunter_canary_telemetry_v417 t
  cross join s
  where s.activation_review_id is not null
    and t.activation_review_id=s.activation_review_id
    and t.state_version=s.state_version
    and t.observed_at>=s.last_transition_at
    and t.hunt_mode in ('reversal','acceleration')
    and public.stock_hunter_route_bucket_v417(t.trade_date,t.symbol_id)
        < s.challenger_traffic_percent
)
select
  s.activation_review_id,
  s.state_version,
  s.challenger_traffic_percent as stage_percent,
  s.last_transition_at as stage_started_at,
  src.hunt_mode,
  count(*) as routed_pair_count,
  count(distinct src.symbol_id) as routed_symbol_count,
  count(distinct src.bucket_minute) as routed_bucket_count,
  min(src.observed_at) as first_observed_at,
  max(src.observed_at) as last_observed_at,
  avg(src.hunt_score_delta) as avg_score_delta,
  avg(abs(src.hunt_score_delta)) as avg_abs_score_delta,
  percentile_cont(0.95) within group (order by abs(src.hunt_score_delta)::double precision)::numeric as p95_abs_score_delta,
  max(abs(src.hunt_score_delta)) as max_abs_score_delta,
  avg(src.status_disagreement::integer) as status_disagreement_ratio,
  avg(src.strong_state_disagreement::integer) as strong_disagreement_ratio,
  avg(src.extreme_status_jump::integer) as extreme_status_jump_ratio
from src
cross join s
group by
  s.activation_review_id,
  s.state_version,
  s.challenger_traffic_percent,
  s.last_transition_at,
  src.hunt_mode;

create or replace view public.stock_hunter_canary_expansion_readiness_v417
with (security_invoker=true)
as
with s as (
  select *
  from public.stock_hunter_activation_status_v417
  where status_id='default'
),
h as (
  select *
  from public.stock_hunter_canary_telemetry_health_v417
  where health_id='default'
),
m as (
  select *
  from public.stock_hunter_canary_expansion_monitor_v417
  limit 1
)
select
  coalesce(m.protocol_version,'4.1.7-canary-expansion-v1') as protocol_version,
  s.activation_review_id,
  s.state_version,
  s.routing_mode,
  s.challenger_traffic_percent as current_percent,
  m.target_percent,
  s.kill_switch_engaged,
  s.last_transition_at as stage_started_at,
  m.stage_elapsed_minutes,
  m.min_stage_minutes,
  h.config_state as telemetry_config_state,
  h.last_success_at as telemetry_last_success_at,
  h.last_activation_review_id as telemetry_review_id,
  m.mode_count,
  m.min_routed_pairs_observed,
  m.min_routed_symbols_observed,
  m.min_routed_buckets_observed,
  m.min_routed_pairs_per_mode,
  m.min_routed_symbols_per_mode,
  m.min_routed_buckets_per_mode,
  m.max_telemetry_age_minutes,
  coalesce(m.recommendation,'IDLE_NO_ACTIVE_CANARY') as stage_recommendation,
  coalesce(m.required_recommendation,'PASS') as required_recommendation,
  coalesce(m.auto_expand,false) as auto_expand,
  s.activation_review_id is not null as pass_review_bound,
  s.routing_mode='CANARY'
    and s.challenger_traffic_percent between 1 and 99
    and not s.kill_switch_engaged as pass_active_canary,
  m.target_percent is not null as pass_has_next_step,
  h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id as pass_capture_ready,
  m.min_stage_minutes is not null
    and m.stage_elapsed_minutes>=m.min_stage_minutes as pass_stage_duration,
  m.mode_count>=2 as pass_modes,
  m.mode_count>=2
    and m.min_routed_pairs_observed>=m.min_routed_pairs_per_mode as pass_routed_pairs,
  m.mode_count>=2
    and m.min_routed_symbols_observed>=m.min_routed_symbols_per_mode as pass_routed_symbols,
  m.mode_count>=2
    and m.min_routed_buckets_observed>=m.min_routed_buckets_per_mode as pass_routed_buckets,
  h.last_success_at is not null
    and m.last_routed_observed_at is not null
    and m.max_telemetry_age_minutes is not null
    and h.last_success_at>=now()-make_interval(mins=>m.max_telemetry_age_minutes)
    and m.last_routed_observed_at>=now()-make_interval(mins=>m.max_telemetry_age_minutes)
    and m.last_routed_observed_at>=s.last_transition_at as pass_freshness,
  coalesce(m.recommendation,'')=coalesce(m.required_recommendation,'PASS') as pass_recommendation,
  (
    s.activation_review_id is not null
    and s.routing_mode='CANARY'
    and s.challenger_traffic_percent between 1 and 99
    and not s.kill_switch_engaged
    and m.target_percent is not null
    and h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id
    and m.min_stage_minutes is not null
    and m.stage_elapsed_minutes>=m.min_stage_minutes
    and m.mode_count>=2
    and m.min_routed_pairs_observed>=m.min_routed_pairs_per_mode
    and m.min_routed_symbols_observed>=m.min_routed_symbols_per_mode
    and m.min_routed_buckets_observed>=m.min_routed_buckets_per_mode
    and h.last_success_at is not null
    and m.last_routed_observed_at is not null
    and m.max_telemetry_age_minutes is not null
    and h.last_success_at>=now()-make_interval(mins=>m.max_telemetry_age_minutes)
    and m.last_routed_observed_at>=now()-make_interval(mins=>m.max_telemetry_age_minutes)
    and m.last_routed_observed_at>=s.last_transition_at
    and m.recommendation=m.required_recommendation
  ) as expansion_ready,
  case
    when s.activation_review_id is null then 'NO_ACTIVATION_REVIEW_BOUND'
    when s.routing_mode<>'CANARY' or s.kill_switch_engaged then 'NOT_IN_ACTIVE_CANARY'
    when m.target_percent is null then 'NO_FURTHER_CANARY_STEP'
    when h.config_state<>'READY'
      or h.last_activation_review_id is distinct from s.activation_review_id
      then 'TELEMETRY_NOT_READY_FOR_STAGE'
    when m.stage_elapsed_minutes<m.min_stage_minutes
      then 'STAGE_OBSERVATION_WINDOW_NOT_MET'
    when m.mode_count<2 then 'BOTH_MODES_REQUIRED'
    when m.min_routed_pairs_observed<m.min_routed_pairs_per_mode
      then 'INSUFFICIENT_ROUTED_PAIRS'
    when m.min_routed_symbols_observed<m.min_routed_symbols_per_mode
      then 'INSUFFICIENT_ROUTED_SYMBOL_DIVERSITY'
    when m.min_routed_buckets_observed<m.min_routed_buckets_per_mode
      then 'INSUFFICIENT_ROUTED_TIME_BUCKETS'
    when h.last_success_at is null
      or h.last_success_at<now()-make_interval(mins=>m.max_telemetry_age_minutes)
      then 'TELEMETRY_STALE'
    when m.last_routed_observed_at is null
      or m.last_routed_observed_at<now()-make_interval(mins=>m.max_telemetry_age_minutes)
      or m.last_routed_observed_at<s.last_transition_at
      then 'ROUTED_EVIDENCE_STALE'
    when m.recommendation<>m.required_recommendation
      then 'STAGE_RECOMMENDATION_NOT_PASS'
    else 'READY_FOR_MANUAL_EXPANSION_AUTHORIZATION'
  end as expansion_reason
from s
cross join h
cross join m;

-- These are read-only observability surfaces. Remove inherited/legacy DML ACLs.
revoke all on public.stock_hunter_canary_expansion_stage_metrics_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_canary_expansion_stage_metrics_v417
  to anon,authenticated,service_role;

revoke all on public.stock_hunter_canary_expansion_readiness_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_canary_expansion_readiness_v417
  to anon,authenticated,service_role;

revoke all on public.stock_hunter_canary_expansion_monitor_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_canary_expansion_monitor_v417
  to anon,authenticated,service_role;

revoke all on public.stock_hunter_canary_hold_rollback_gate_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_canary_hold_rollback_gate_v417
  to anon,authenticated,service_role;

revoke all on public.stock_hunter_canary_recovery_gate_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_canary_recovery_gate_v417
  to anon,authenticated,service_role;
