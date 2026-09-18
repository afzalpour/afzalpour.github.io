-- Stock Hunter 4.1.7 post-activation monitoring / stability live closure.
-- Scope: monitoring after CHALLENGER_ONLY / 100%.
-- No activation, rollback, reset, finalization, or version promotion is performed here.

create or replace view public.stock_hunter_post_activation_monitor_v417
with (security_invoker=true)
as
with s as (
  select *
  from public.stock_hunter_activation_status_v417
  where status_id='default'
),
ap as (
  select *
  from public.stock_hunter_activation_policy_v417
  where policy_id='default'
),
p as (
  select *
  from public.stock_hunter_post_activation_policy_v417
  where policy_id='default'
),
h as (
  select *
  from public.stock_hunter_canary_telemetry_health_v417
  where health_id='default'
),
r as (
  select *
  from public.stock_hunter_canary_recovery_status_v417
  where status_id='default'
),
rb as (
  select auto_rollback
  from public.stock_hunter_canary_hold_rollback_policy_v417
  where policy_id='default'
),
per_mode as (
  select
    t.activation_review_id,
    t.state_version,
    t.hunt_mode,
    count(*) as pair_count,
    count(distinct t.symbol_id) as symbol_count,
    count(distinct t.bucket_minute) as bucket_count,
    count(distinct t.trade_date) as trade_date_count,
    min(t.observed_at) as first_observed_at,
    max(t.observed_at) as last_observed_at
  from public.stock_hunter_canary_telemetry_v417 t
  cross join s s1
  where t.activation_review_id=s1.activation_review_id
    and t.state_version=s1.state_version
    and t.observed_at>=s1.last_transition_at
    and t.hunt_mode in ('reversal','acceleration')
  group by t.activation_review_id,t.state_version,t.hunt_mode
),
cov as (
  select
    activation_review_id,
    state_version,
    count(*)::integer as mode_count,
    coalesce(min(pair_count),0::bigint) as min_pairs_observed,
    coalesce(min(symbol_count),0::bigint) as min_symbols_observed,
    coalesce(min(bucket_count),0::bigint) as min_buckets_observed,
    coalesce(min(trade_date_count),0::bigint) as min_trade_dates_observed,
    min(first_observed_at) as first_observed_at,
    max(last_observed_at) as last_observed_at,
    min(last_observed_at) as min_mode_last_observed_at
  from per_mode
  group by activation_review_id,state_version
),
ranked_rec as (
  select
    q.activation_review_id,
    q.state_version,
    q.hunt_mode,
    q.trade_date,
    q.last_observed_at,
    case
      when q.recommendation='STABLE' then 'PASS'
      else q.recommendation
    end as normalized_recommendation,
    row_number() over (
      partition by q.activation_review_id,q.state_version,q.hunt_mode
      order by q.trade_date desc,q.last_observed_at desc nulls last
    ) as rn
  from public.stock_hunter_canary_telemetry_recommendation_v417 q
  cross join s s1
  where q.activation_review_id=s1.activation_review_id
    and q.state_version=s1.state_version
),
rec as (
  select
    activation_review_id,
    state_version,
    count(*) filter(where rn=1)::integer as recommendation_mode_count,
    count(*) filter(where rn=1 and normalized_recommendation='PASS')::integer as pass_mode_count,
    array_agg(normalized_recommendation order by hunt_mode) filter(where rn=1) as latest_recommendations,
    min(last_observed_at) filter(where rn=1) as min_recommendation_observed_at
  from ranked_rec
  group by activation_review_id,state_version
)
select
  p.protocol_version,
  s.activation_review_id,
  s.state_version,
  s.routing_mode,
  s.challenger_traffic_percent,
  s.kill_switch_engaged,
  s.champion_engine_version as rollback_target_engine_version,
  s.challenger_engine_version as active_challenger_engine_version,
  s.last_transition_at as full_activation_started_at,
  p.min_stability_trade_dates,
  p.min_pairs_per_mode,
  p.min_symbols_per_mode,
  p.min_buckets_per_mode,
  p.max_telemetry_age_minutes,
  p.required_recommendation,
  p.auto_rollback,
  p.auto_finalize,
  h.config_state as telemetry_config_state,
  h.last_success_at as telemetry_last_success_at,
  h.last_activation_review_id as telemetry_review_id,
  h.last_error as telemetry_last_error,
  coalesce(cov.mode_count,0) as mode_count,
  coalesce(cov.min_pairs_observed,0::bigint) as min_pairs_observed,
  coalesce(cov.min_symbols_observed,0::bigint) as min_symbols_observed,
  coalesce(cov.min_buckets_observed,0::bigint) as min_buckets_observed,
  coalesce(cov.min_trade_dates_observed,0::bigint) as min_trade_dates_observed,
  cov.first_observed_at,
  cov.last_observed_at,
  coalesce(rec.recommendation_mode_count,0) as recommendation_mode_count,
  coalesce(rec.pass_mode_count,0) as pass_recommendation_mode_count,
  rec.latest_recommendations,
  r.recovery_state,
  r.incident_started_at,
  r.last_incident_at,
  r.last_incident_gate_state,
  r.last_retired_review_id,
  r.last_retired_at,
  r.last_retired_reason,
  s.routing_mode='CHALLENGER_ONLY'
    and s.challenger_traffic_percent=100
    and not s.kill_switch_engaged as pass_full_activation_state,
  s.activation_review_id is not null as pass_review_bound,
  s.champion_engine_version=ap.champion_engine_version
    and s.champion_engine_version='4.1.6-hunt-v2'
    and s.champion_engine_version<>s.challenger_engine_version as pass_rollback_target_preserved,
  h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id
    and h.last_error is null as pass_telemetry_bound,
  h.last_success_at is not null
    and cov.min_mode_last_observed_at is not null
    and rec.min_recommendation_observed_at is not null
    and h.last_success_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and cov.min_mode_last_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and rec.min_recommendation_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and cov.min_mode_last_observed_at>=s.last_transition_at
    and rec.min_recommendation_observed_at>=s.last_transition_at as pass_freshness,
  coalesce(cov.mode_count,0)>=2 as pass_modes,
  coalesce(cov.min_trade_dates_observed,0::bigint)>=p.min_stability_trade_dates as pass_stability_trade_dates,
  coalesce(cov.min_pairs_observed,0::bigint)>=p.min_pairs_per_mode as pass_pairs,
  coalesce(cov.min_symbols_observed,0::bigint)>=p.min_symbols_per_mode as pass_symbols,
  coalesce(cov.min_buckets_observed,0::bigint)>=p.min_buckets_per_mode as pass_buckets,
  coalesce(rec.recommendation_mode_count,0)>=2
    and coalesce(rec.pass_mode_count,0)>=2 as pass_recommendations,
  r.activation_review_id=s.activation_review_id
    and r.state_version=s.state_version
    and r.recovery_state in ('MONITORING','RECOVERED')
    and r.incident_started_at is null
    and r.last_retired_review_id is distinct from s.activation_review_id as pass_no_unresolved_recovery_incident,
  not p.auto_rollback and not rb.auto_rollback as pass_automatic_rollback_off,
  (
    s.routing_mode='CHALLENGER_ONLY'
    and s.challenger_traffic_percent=100
    and not s.kill_switch_engaged
    and s.activation_review_id is not null
    and s.champion_engine_version=ap.champion_engine_version
    and s.champion_engine_version='4.1.6-hunt-v2'
    and s.champion_engine_version<>s.challenger_engine_version
    and h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id
    and h.last_error is null
    and h.last_success_at is not null
    and h.last_success_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and cov.activation_review_id=s.activation_review_id
    and cov.state_version=s.state_version
    and cov.min_mode_last_observed_at is not null
    and cov.min_mode_last_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and cov.min_mode_last_observed_at>=s.last_transition_at
    and coalesce(cov.mode_count,0)>=2
    and coalesce(cov.min_trade_dates_observed,0::bigint)>=p.min_stability_trade_dates
    and coalesce(cov.min_pairs_observed,0::bigint)>=p.min_pairs_per_mode
    and coalesce(cov.min_symbols_observed,0::bigint)>=p.min_symbols_per_mode
    and coalesce(cov.min_buckets_observed,0::bigint)>=p.min_buckets_per_mode
    and rec.activation_review_id=s.activation_review_id
    and rec.state_version=s.state_version
    and rec.min_recommendation_observed_at is not null
    and rec.min_recommendation_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and rec.min_recommendation_observed_at>=s.last_transition_at
    and coalesce(rec.recommendation_mode_count,0)>=2
    and coalesce(rec.pass_mode_count,0)>=2
    and r.activation_review_id=s.activation_review_id
    and r.state_version=s.state_version
    and r.recovery_state in ('MONITORING','RECOVERED')
    and r.incident_started_at is null
    and r.last_retired_review_id is distinct from s.activation_review_id
    and not p.auto_rollback
    and not rb.auto_rollback
    and not p.auto_finalize
  ) as stabilization_ready_for_version_promotion,
  case
    when s.routing_mode<>'CHALLENGER_ONLY'
      or s.challenger_traffic_percent<>100
      or s.kill_switch_engaged
      then 'NOT_AT_FULL_ACTIVATION'
    when s.activation_review_id is null then 'NO_ACTIVATION_REVIEW_BOUND'
    when s.champion_engine_version<>ap.champion_engine_version
      or s.champion_engine_version<>'4.1.6-hunt-v2'
      or s.champion_engine_version=s.challenger_engine_version
      then 'ROLLBACK_TARGET_NOT_PRESERVED'
    when h.config_state<>'READY'
      or h.last_activation_review_id is distinct from s.activation_review_id
      or h.last_error is not null
      then 'POST_ACTIVATION_TELEMETRY_NOT_READY'
    when h.last_success_at is null
      or h.last_success_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      then 'POST_ACTIVATION_TELEMETRY_STALE'
    when cov.activation_review_id is distinct from s.activation_review_id
      or cov.state_version is distinct from s.state_version
      then 'NO_POST_ACTIVATION_PAIRED_DATA_FOR_CURRENT_STATE'
    when coalesce(cov.mode_count,0)<2 then 'BOTH_MODES_REQUIRED'
    when coalesce(cov.min_trade_dates_observed,0::bigint)<p.min_stability_trade_dates
      then 'STABILITY_TRADE_DATES_NOT_MET'
    when coalesce(cov.min_pairs_observed,0::bigint)<p.min_pairs_per_mode
      then 'POST_ACTIVATION_PAIRS_NOT_MET'
    when coalesce(cov.min_symbols_observed,0::bigint)<p.min_symbols_per_mode
      then 'POST_ACTIVATION_SYMBOLS_NOT_MET'
    when coalesce(cov.min_buckets_observed,0::bigint)<p.min_buckets_per_mode
      then 'POST_ACTIVATION_BUCKETS_NOT_MET'
    when cov.min_mode_last_observed_at is null
      or cov.min_mode_last_observed_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      or cov.min_mode_last_observed_at<s.last_transition_at
      then 'POST_ACTIVATION_ROUTED_EVIDENCE_STALE'
    when rec.activation_review_id is distinct from s.activation_review_id
      or rec.state_version is distinct from s.state_version
      or coalesce(rec.recommendation_mode_count,0)<2
      then 'POST_ACTIVATION_RECOMMENDATIONS_MISSING'
    when rec.min_recommendation_observed_at is null
      or rec.min_recommendation_observed_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      or rec.min_recommendation_observed_at<s.last_transition_at
      then 'POST_ACTIVATION_RECOMMENDATION_EVIDENCE_STALE'
    when coalesce(rec.pass_mode_count,0)<2
      then 'POST_ACTIVATION_RECOMMENDATION_NOT_PASS'
    when r.activation_review_id is distinct from s.activation_review_id
      or r.state_version is distinct from s.state_version
      or r.recovery_state not in ('MONITORING','RECOVERED')
      or r.incident_started_at is not null
      or r.last_retired_review_id is not distinct from s.activation_review_id
      then 'UNRESOLVED_RECOVERY_OR_ROLLBACK_INCIDENT'
    when p.auto_rollback or rb.auto_rollback
      then 'AUTOMATIC_ROLLBACK_MUST_REMAIN_OFF'
    when p.auto_finalize
      then 'AUTOMATIC_FINALIZATION_MUST_REMAIN_OFF'
    else 'READY_FOR_MANUAL_VERSION_PROMOTION_REVIEW'
  end as stabilization_reason,
  false as automatic_action_taken
from s
cross join ap
cross join p
cross join h
cross join r
cross join rb
left join cov
  on cov.activation_review_id=s.activation_review_id
 and cov.state_version=s.state_version
left join rec
  on rec.activation_review_id=s.activation_review_id
 and rec.state_version=s.state_version;

-- Explicitly retain this as a read-only observability surface.
revoke all on public.stock_hunter_post_activation_monitor_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_post_activation_monitor_v417
  to anon,authenticated,service_role;
