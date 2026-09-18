-- Stock Hunter 4.1.7 independent Full Activation 50 -> 100 live closure.
-- No authorization or activation is performed by this migration.

create or replace view public.stock_hunter_full_activation_readiness_v417
with (security_invoker=true)
as
with s as (
  select *
  from public.stock_hunter_activation_status_v417
  where status_id='default'
),
p as (
  select *
  from public.stock_hunter_full_activation_policy_v417
  where policy_id='default'
),
h as (
  select *
  from public.stock_hunter_canary_telemetry_health_v417
  where health_id='default'
),
st as (
  select
    activation_review_id,
    state_version,
    stage_percent,
    count(distinct hunt_mode)::integer as mode_count,
    coalesce(min(routed_pair_count),0::bigint) as min_routed_pairs_observed,
    coalesce(min(routed_symbol_count),0::bigint) as min_routed_symbols_observed,
    coalesce(min(routed_bucket_count),0::bigint) as min_routed_buckets_observed,
    max(last_observed_at) as last_routed_observed_at
  from public.stock_hunter_canary_expansion_stage_metrics_v417
  group by activation_review_id,state_version,stage_percent
),
rr as (
  select
    r.activation_review_id,
    r.state_version,
    r.hunt_mode,
    r.last_observed_at,
    case
      when r.recommendation='STABLE' then 'PASS'
      else r.recommendation
    end as normalized_recommendation,
    row_number() over (
      partition by r.activation_review_id,r.state_version,r.hunt_mode
      order by r.trade_date desc,r.last_observed_at desc nulls last
    ) as rn
  from public.stock_hunter_canary_telemetry_recommendation_v417 r
),
rec as (
  select
    activation_review_id,
    state_version,
    count(*) filter(where rn=1)::integer as recommendation_mode_count,
    count(*) filter(where rn=1 and normalized_recommendation='PASS')::integer as pass_recommendation_mode_count,
    min(last_observed_at) filter(where rn=1) as min_recommendation_observed_at
  from rr
  group by activation_review_id,state_version
),
hg as (
  select *
  from public.stock_hunter_canary_hold_rollback_gate_v417
  limit 1
),
rg as (
  select *
  from public.stock_hunter_canary_recovery_gate_v417
  limit 1
)
select
  p.protocol_version,
  s.activation_review_id,
  s.state_version,
  s.routing_mode,
  s.challenger_traffic_percent as current_percent,
  s.kill_switch_engaged,
  s.last_transition_at as stage_started_at,
  floor(extract(epoch from now()-s.last_transition_at)/60::numeric)::integer as stage_elapsed_minutes,
  p.required_from_percent,
  p.min_stage_minutes,
  p.min_routed_pairs_per_mode,
  p.min_routed_symbols_per_mode,
  p.min_routed_buckets_per_mode,
  p.max_telemetry_age_minutes,
  p.required_recommendation,
  p.auto_activate,
  h.config_state as telemetry_config_state,
  h.last_success_at as telemetry_last_success_at,
  h.last_activation_review_id as telemetry_review_id,
  coalesce(st.mode_count,0) as mode_count,
  coalesce(st.min_routed_pairs_observed,0::bigint) as min_routed_pairs_observed,
  coalesce(st.min_routed_symbols_observed,0::bigint) as min_routed_symbols_observed,
  coalesce(st.min_routed_buckets_observed,0::bigint) as min_routed_buckets_observed,
  st.last_routed_observed_at,
  coalesce(rec.recommendation_mode_count,0) as recommendation_mode_count,
  coalesce(rec.pass_recommendation_mode_count,0) as pass_recommendation_mode_count,
  hg.gate_state as hold_rollback_gate_state,
  coalesce(hg.expansion_blocked,true) as expansion_blocked,
  coalesce(hg.rollback_recommended,true) as rollback_recommended,
  coalesce(hg.kill_switch_recommended,true) as kill_switch_recommended,
  coalesce(hg.automatic_action_taken,false) as hold_automatic_action_taken,
  rg.recovery_state,
  coalesce(rg.recovery_state_matches_stage,false) as recovery_state_matches_stage,
  coalesce(rg.same_review_reentry_blocked,true) as same_review_reentry_blocked,
  coalesce(rg.automatic_action_taken,false) as recovery_automatic_action_taken,
  s.routing_mode='CANARY'
    and s.challenger_traffic_percent=p.required_from_percent
    and not s.kill_switch_engaged as pass_exact_50_stage,
  s.activation_review_id is not null as pass_review_bound,
  floor(extract(epoch from now()-s.last_transition_at)/60::numeric)::integer>=p.min_stage_minutes as pass_stage_duration,
  h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id as pass_telemetry_bound,
  h.last_success_at is not null
    and st.last_routed_observed_at is not null
    and rec.min_recommendation_observed_at is not null
    and h.last_success_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and st.last_routed_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and rec.min_recommendation_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and st.last_routed_observed_at>=s.last_transition_at
    and rec.min_recommendation_observed_at>=s.last_transition_at as pass_freshness,
  coalesce(st.mode_count,0)>=2 as pass_modes,
  coalesce(st.min_routed_pairs_observed,0::bigint)>=p.min_routed_pairs_per_mode as pass_routed_pairs,
  coalesce(st.min_routed_symbols_observed,0::bigint)>=p.min_routed_symbols_per_mode as pass_routed_symbols,
  coalesce(st.min_routed_buckets_observed,0::bigint)>=p.min_routed_buckets_per_mode as pass_routed_buckets,
  coalesce(rec.recommendation_mode_count,0)>=2
    and coalesce(rec.pass_recommendation_mode_count,0)>=2 as pass_recommendations,
  not coalesce(hg.expansion_blocked,true)
    and not coalesce(hg.rollback_recommended,true)
    and not coalesce(hg.kill_switch_recommended,true)
    and not coalesce(hg.automatic_action_taken,false) as pass_hold_rollback,
  coalesce(rg.recovery_state_matches_stage,false)
    and not coalesce(rg.same_review_reentry_blocked,true)
    and coalesce(rg.recovery_state,'') in ('MONITORING','RECOVERED')
    and not coalesce(rg.automatic_action_taken,false) as pass_recovery,
  (
    s.routing_mode='CANARY'
    and s.challenger_traffic_percent=p.required_from_percent
    and not s.kill_switch_engaged
    and s.activation_review_id is not null
    and floor(extract(epoch from now()-s.last_transition_at)/60::numeric)::integer>=p.min_stage_minutes
    and h.config_state='READY'
    and h.last_activation_review_id=s.activation_review_id
    and h.last_success_at is not null
    and h.last_success_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and st.activation_review_id=s.activation_review_id
    and st.state_version=s.state_version
    and st.stage_percent=p.required_from_percent
    and st.last_routed_observed_at is not null
    and st.last_routed_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and st.last_routed_observed_at>=s.last_transition_at
    and coalesce(st.mode_count,0)>=2
    and coalesce(st.min_routed_pairs_observed,0::bigint)>=p.min_routed_pairs_per_mode
    and coalesce(st.min_routed_symbols_observed,0::bigint)>=p.min_routed_symbols_per_mode
    and coalesce(st.min_routed_buckets_observed,0::bigint)>=p.min_routed_buckets_per_mode
    and rec.activation_review_id=s.activation_review_id
    and rec.state_version=s.state_version
    and rec.min_recommendation_observed_at is not null
    and rec.min_recommendation_observed_at>=now()-make_interval(mins=>p.max_telemetry_age_minutes)
    and rec.min_recommendation_observed_at>=s.last_transition_at
    and coalesce(rec.recommendation_mode_count,0)>=2
    and coalesce(rec.pass_recommendation_mode_count,0)>=2
    and not coalesce(hg.expansion_blocked,true)
    and not coalesce(hg.rollback_recommended,true)
    and not coalesce(hg.kill_switch_recommended,true)
    and not coalesce(hg.automatic_action_taken,false)
    and coalesce(rg.recovery_state_matches_stage,false)
    and not coalesce(rg.same_review_reentry_blocked,true)
    and coalesce(rg.recovery_state,'') in ('MONITORING','RECOVERED')
    and not coalesce(rg.automatic_action_taken,false)
  ) as full_activation_ready,
  case
    when s.activation_review_id is null then 'NO_ACTIVATION_REVIEW_BOUND'
    when s.routing_mode<>'CANARY' or s.kill_switch_engaged then 'NOT_IN_ACTIVE_CANARY'
    when s.challenger_traffic_percent<>p.required_from_percent then 'FULL_ACTIVATION_REQUIRES_EXACT_50_PERCENT'
    when floor(extract(epoch from now()-s.last_transition_at)/60::numeric)::integer<p.min_stage_minutes
      then 'FULL_OBSERVATION_WINDOW_NOT_MET'
    when h.config_state<>'READY'
      or h.last_activation_review_id is distinct from s.activation_review_id
      then 'TELEMETRY_NOT_BOUND_TO_REVIEW'
    when h.last_success_at is null
      or h.last_success_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      then 'TELEMETRY_STALE'
    when st.activation_review_id is distinct from s.activation_review_id
      or st.state_version is distinct from s.state_version
      or st.stage_percent is distinct from p.required_from_percent
      then 'STAGE_METRICS_NOT_BOUND_TO_CURRENT_STATE'
    when coalesce(st.mode_count,0)<2 then 'BOTH_MODES_REQUIRED'
    when coalesce(st.min_routed_pairs_observed,0::bigint)<p.min_routed_pairs_per_mode
      then 'INSUFFICIENT_ROUTED_PAIRS'
    when coalesce(st.min_routed_symbols_observed,0::bigint)<p.min_routed_symbols_per_mode
      then 'INSUFFICIENT_ROUTED_SYMBOLS'
    when coalesce(st.min_routed_buckets_observed,0::bigint)<p.min_routed_buckets_per_mode
      then 'INSUFFICIENT_ROUTED_BUCKETS'
    when st.last_routed_observed_at is null
      or st.last_routed_observed_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      or st.last_routed_observed_at<s.last_transition_at
      then 'ROUTED_EVIDENCE_STALE'
    when rec.activation_review_id is distinct from s.activation_review_id
      or rec.state_version is distinct from s.state_version
      or coalesce(rec.recommendation_mode_count,0)<2
      then 'CURRENT_MODE_RECOMMENDATIONS_MISSING'
    when rec.min_recommendation_observed_at is null
      or rec.min_recommendation_observed_at<now()-make_interval(mins=>p.max_telemetry_age_minutes)
      or rec.min_recommendation_observed_at<s.last_transition_at
      then 'RECOMMENDATION_EVIDENCE_STALE'
    when coalesce(rec.pass_recommendation_mode_count,0)<2
      then 'RECOMMENDATION_NOT_PASS_FOR_BOTH_MODES'
    when coalesce(hg.expansion_blocked,true)
      or coalesce(hg.rollback_recommended,true)
      or coalesce(hg.kill_switch_recommended,true)
      or coalesce(hg.automatic_action_taken,false)
      then 'HOLD_OR_ROLLBACK_GUARD_NOT_CLEAR'
    when not coalesce(rg.recovery_state_matches_stage,false)
      or coalesce(rg.same_review_reentry_blocked,true)
      or coalesce(rg.recovery_state,'') not in ('MONITORING','RECOVERED')
      or coalesce(rg.automatic_action_taken,false)
      then 'RECOVERY_STATE_NOT_CLEAR'
    else 'READY_FOR_SEPARATE_FULL_ACTIVATION_AUTHORIZATION'
  end as full_activation_reason
from s
cross join p
cross join h
left join st
  on st.activation_review_id=s.activation_review_id
 and st.state_version=s.state_version
 and st.stage_percent=s.challenger_traffic_percent
left join rec
  on rec.activation_review_id=s.activation_review_id
 and rec.state_version=s.state_version
cross join hg
cross join rg;

-- Explicitly preserve the Full Activation observability surface as read-only Data API.
revoke all on public.stock_hunter_full_activation_readiness_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_full_activation_readiness_v417
  to anon,authenticated,service_role;
