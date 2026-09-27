-- Stock Hunter 4.1.7 Promotion -> Forward Shadow -> Activation Review live closure.
-- Live-adapted 2026-09-18: Forward Shadow is a derived security-invoker view, not a table.
-- This migration fixes its source so post-OOS Forward Shadow stays prospective after
-- Calibration is frozen, and hardens Proposal/Review inserts against the OOS freeze gate.
-- No Proposal, Review, traffic mutation, or production activation is created here.

do $$
declare
  v_days integer;
  v_selected integer;
  v_auto_promote boolean;
  v_auto_activate boolean;
  v_cols integer;
begin
  if to_regclass('public.stock_hunter_oos_release_integrity_v416') is null then
    raise exception 'OOS live-close integrity surface is required';
  end if;

  select auto_promote
    into v_auto_promote
  from public.stock_hunter_promotion_policy_v416
  where policy_id='default';

  select min_fresh_trade_dates,min_selected_per_mode,auto_activate
    into v_days,v_selected,v_auto_activate
  from public.stock_hunter_rollout_policy_v417
  where policy_id='default';

  if v_auto_promote is distinct from false then
    raise exception 'Promotion auto_promote must remain false';
  end if;
  if v_auto_activate is distinct from false then
    raise exception 'Forward Shadow auto_activate must remain false';
  end if;
  if v_days is distinct from 10 or v_selected is distinct from 30 then
    raise exception 'Forward Shadow structural thresholds drifted';
  end if;

  select count(*) into v_cols
  from pg_attribute
  where attrelid='public.stock_hunter_challenger_shadow_samples_v417'::regclass
    and attnum>0 and not attisdropped;

  if v_cols<>20 then
    raise exception 'unexpected live Forward Shadow output contract: % columns',v_cols;
  end if;

  if not exists (
    select 1
    from pg_class
    where oid='public.stock_hunter_challenger_shadow_samples_v417'::regclass
      and relkind='v'
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'Forward Shadow must remain a security_invoker view';
  end if;
end $$;

create or replace function private.guard_stock_hunter_promotion_proposal_live_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_integrity text;
  v_release_id bigint;
  v_fingerprint text;
  v_policy_target text;
  v_ready boolean;
  v_ready_release bigint;
  v_ready_fingerprint text;
  v_passed integer;
  v_modes integer;
begin
  select integrity_state,release_id,dataset_fingerprint
    into v_integrity,v_release_id,v_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;

  if v_integrity is distinct from 'FROZEN_PASS' then
    raise exception 'Promotion Proposal blocked: OOS integrity must be FROZEN_PASS';
  end if;

  if new.release_id is distinct from v_release_id
     or new.dataset_fingerprint is distinct from v_fingerprint then
    raise exception 'Promotion Proposal is not bound to the frozen OOS release';
  end if;

  select target_engine_version
    into v_policy_target
  from public.stock_hunter_promotion_policy_v416
  where policy_id='default';

  if new.protocol_version<>'4.1.6-promotion-v1'
     or new.source_engine_version<>'4.1.6-hunt-v2'
     or new.target_engine_version is distinct from v_policy_target then
    raise exception 'Promotion Proposal version contract mismatch';
  end if;

  select proposal_ready,release_id,dataset_fingerprint,passed_modes,mode_count
    into v_ready,v_ready_release,v_ready_fingerprint,v_passed,v_modes
  from public.stock_hunter_promotion_readiness_v416
  limit 1;

  if not coalesce(v_ready,false)
     or v_ready_release is distinct from new.release_id
     or v_ready_fingerprint is distinct from new.dataset_fingerprint
     or coalesce(v_modes,0)<>2
     or coalesce(v_passed,0)<>2 then
    raise exception 'Promotion Proposal blocked: both frozen OOS modes must pass';
  end if;

  new.created_at:=now();
  return new;
end;
$$;

revoke all on function private.guard_stock_hunter_promotion_proposal_live_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_promotion_proposal_live_v417()
  to postgres;

drop trigger if exists stock_hunter_promotion_proposal_oos_guard_v417
  on public.stock_hunter_promotion_proposals_v416;

create trigger stock_hunter_promotion_proposal_oos_guard_v417
before insert on public.stock_hunter_promotion_proposals_v416
for each row execute function private.guard_stock_hunter_promotion_proposal_live_v417();

-- Replace the deadlocked Forward Shadow source. After the one-time OOS release,
-- Calibration is frozen by design. Forward Shadow must instead score raw prospective
-- Shadow outcomes observed after Proposal creation, while using frozen candidate/baseline
-- definitions from the released OOS artifact.
create or replace view public.stock_hunter_challenger_shadow_samples_v417
with (security_invoker=true)
as
with proposal as (
  select p.proposal_id,p.release_id,p.created_at,p.dataset_fingerprint
  from public.stock_hunter_promotion_proposals_v416 p
  order by p.proposal_id desc
  limit 1
),
models as (
  select
    p.proposal_id,p.release_id,p.created_at as proposal_created_at,p.dataset_fingerprint,
    r.hunt_mode,l.candidate_id,'challenger'::text as model_role,
    l.order_pressure_w,l.impulse_w,l.feasibility_w,l.flow_volume_w,l.market_context_w
  from proposal p
  join public.stock_hunter_oos_release_results_v416 r
    on r.release_id=p.release_id
   and r.result_role='candidate'
   and not r.is_baseline
  join public.stock_hunter_candidate_library_v416 l
    on l.hunt_mode=r.hunt_mode
   and l.candidate_id=r.candidate_id

  union all

  select
    p.proposal_id,p.release_id,p.created_at as proposal_created_at,p.dataset_fingerprint,
    l.hunt_mode,l.candidate_id,'champion'::text as model_role,
    l.order_pressure_w,l.impulse_w,l.feasibility_w,l.flow_volume_w,l.market_context_w
  from proposal p
  join public.stock_hunter_candidate_library_v416 l
    on l.is_baseline=true
),
raw as (
  select
    o.sample_id,o.trade_date,o.symbol_id,o.symbol,o.company_name,o.hunt_mode,o.observed_at,
    o.order_pressure,o.impulse,o.feasibility,o.flow_volume,o.market_context,o.continuation12,
    o.risk_score,o.cancellation_ratio,o.evidence_count,o.gate_reason,
    o.return_1d_pct,o.return_3d_pct,o.mfe_1d_pct,o.mfe_3d_pct,o.mae_1d_pct,o.mae_3d_pct,
    o.future_sessions_observed,
    1.0 / count(*) over(partition by o.trade_date,o.symbol_id)::numeric as cluster_weight,
    greatest(-3::numeric,least(3::numeric,o.return_1d_pct))*0.50
      + greatest(0::numeric,least(3::numeric,o.mfe_1d_pct))*0.20
      + greatest(-4::numeric,least(4::numeric,o.return_3d_pct))*0.20
      + greatest(-3::numeric,least(0::numeric,o.mae_1d_pct))*0.10 as outcome_utility
  from public.stock_hunter_shadow_outcomes_v416 o
  join public.stock_hunter_shadow_samples_v416 s
    on s.sample_id=o.sample_id
  cross join proposal p
  where o.observed_at>p.created_at
    and s.observed_at=o.observed_at
    and s.trade_date=(s.observed_at at time zone 'Asia/Tehran')::date
    and s.created_at>=s.observed_at-interval '2 minutes'
    and s.created_at<=s.observed_at+interval '10 minutes'
    and s.source_version='4.1.6-shadow-v2-parity'
),
scored as (
  select
    m.proposal_id,m.release_id,m.proposal_created_at,m.dataset_fingerprint,m.model_role,
    r.*,
    m.candidate_id,
    greatest(0::numeric,least(100::numeric,
      m.order_pressure_w*r.order_pressure
      + m.impulse_w*r.impulse
      + m.feasibility_w*r.feasibility
      + m.flow_volume_w*r.flow_volume
      + m.market_context_w*r.market_context
      - greatest(0::numeric,r.risk_score-40::numeric)*0.23
      - greatest(0::numeric,r.cancellation_ratio-60::numeric)*0.10
    )) as candidate_today_opportunity
  from raw r
  join models m on m.hunt_mode=r.hunt_mode
),
final as (
  select
    s.*,
    greatest(0::numeric,least(100::numeric,
      s.candidate_today_opportunity*(0.82 + 0.18*s.continuation12/100::numeric)
    )) as candidate_hunt_score
  from scored s
)
select
  f.proposal_id,
  f.release_id,
  f.proposal_created_at,
  f.dataset_fingerprint,
  f.sample_id,
  f.trade_date,
  f.symbol_id,
  f.symbol,
  f.hunt_mode,
  f.observed_at,
  f.future_sessions_observed,
  f.cluster_weight,
  f.outcome_utility,
  f.return_3d_pct,
  f.mfe_3d_pct,
  f.mae_3d_pct,
  f.candidate_id,
  case
    when coalesce(f.gate_reason,'')<>'' then 'عادی'
    when f.candidate_hunt_score>=78 and f.candidate_today_opportunity>=82 and f.risk_score<=45 and f.evidence_count>=4 then 'شکار ویژه'
    when f.candidate_hunt_score>=68 and f.candidate_today_opportunity>=74 and f.risk_score<=55 and f.evidence_count>=3 then 'هشدار فوری'
    when f.candidate_hunt_score>=58 and f.candidate_today_opportunity>=64 and f.risk_score<=62 and f.evidence_count>=3 then 'شکار زودهنگام'
    when f.candidate_hunt_score>=50 and f.candidate_today_opportunity>=55 then 'رصد'
    else 'عادی'
  end as candidate_state,
  coalesce(f.gate_reason,'')=''
    and (
      (f.candidate_hunt_score>=78 and f.candidate_today_opportunity>=82 and f.risk_score<=45 and f.evidence_count>=4)
      or
      (f.candidate_hunt_score>=68 and f.candidate_today_opportunity>=74 and f.risk_score<=55 and f.evidence_count>=3)
    ) as selected_special_urgent,
  f.model_role
from final f;

revoke all on public.stock_hunter_challenger_shadow_samples_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_challenger_shadow_samples_v417
  to anon,authenticated,service_role;

create or replace function private.guard_stock_hunter_activation_review_live_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_integrity text;
  v_release_id bigint;
  v_fingerprint text;
  v_ready boolean;
  v_ready_proposal bigint;
  v_ready_release bigint;
  v_ready_fingerprint text;
  v_proposal public.stock_hunter_promotion_proposals_v416%rowtype;
  v_status public.stock_hunter_activation_status_v417%rowtype;
begin
  select integrity_state,release_id,dataset_fingerprint
    into v_integrity,v_release_id,v_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;

  if v_integrity is distinct from 'FROZEN_PASS' then
    raise exception 'Activation Review blocked: OOS integrity must be FROZEN_PASS';
  end if;

  select * into strict v_proposal
  from public.stock_hunter_promotion_proposals_v416
  where proposal_id=new.proposal_id;

  if new.release_id is distinct from v_proposal.release_id
     or new.dataset_fingerprint is distinct from v_proposal.dataset_fingerprint
     or new.release_id is distinct from v_release_id
     or new.dataset_fingerprint is distinct from v_fingerprint then
    raise exception 'Activation Review is not bound to the frozen Proposal/OOS release';
  end if;

  if new.protocol_version<>'4.1.7-activation-review-v1'
     or new.champion_engine_version<>'4.1.6-hunt-v2'
     or new.challenger_engine_version<>'4.1.7-proposed'
     or coalesce(new.production_activated,false) then
    raise exception 'Activation Review version/non-activation contract mismatch';
  end if;

  select can_record_review,proposal_id,release_id,dataset_fingerprint
    into v_ready,v_ready_proposal,v_ready_release,v_ready_fingerprint
  from public.stock_hunter_activation_review_readiness_v417
  limit 1;

  if not coalesce(v_ready,false)
     or v_ready_proposal is distinct from new.proposal_id
     or v_ready_release is distinct from new.release_id
     or v_ready_fingerprint is distinct from new.dataset_fingerprint then
    raise exception 'Activation Review blocked: Forward Shadow readiness is not bound/pass';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if v_status.routing_mode<>'CHAMPION_ONLY'
     or v_status.challenger_traffic_percent<>0
     or not v_status.kill_switch_engaged
     or v_status.activation_review_id is not null then
    raise exception 'Activation Review blocked: activation control is not unbound champion-only safe';
  end if;

  new.reviewed_at:=now();
  return new;
end;
$$;

revoke all on function private.guard_stock_hunter_activation_review_live_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_activation_review_live_v417()
  to postgres;

drop trigger if exists stock_hunter_activation_review_gate_v417
  on public.stock_hunter_activation_reviews_v417;

create trigger stock_hunter_activation_review_gate_v417
before insert on public.stock_hunter_activation_reviews_v417
for each row execute function private.guard_stock_hunter_activation_review_live_v417();

create or replace view public.stock_hunter_promotion_forward_shadow_gate_v417
with (security_invoker=true)
as
with oi as (
  select integrity_state,release_id,dataset_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1
),
pp as (
  select proposal_ready,passed_modes,mode_count,readiness_reason
  from public.stock_hunter_promotion_readiness_v416
  limit 1
),
p as (
  select proposal_id,release_id,target_engine_version,dataset_fingerprint,created_at
  from public.stock_hunter_promotion_proposals_v416
  order by proposal_id desc
  limit 1
),
rr as (
  select min_fresh_trade_dates_observed,min_challenger_selected_observed,
         passed_modes,mode_count,activation_review_ready,readiness_reason
  from public.stock_hunter_rollout_readiness_v417
  limit 1
),
ar as (
  select can_record_review,review_reason
  from public.stock_hunter_activation_review_readiness_v417
  limit 1
),
rv as (
  select review_id,proposal_id,production_activated,reviewed_at
  from public.stock_hunter_activation_reviews_v417
  order by review_id desc
  limit 1
)
select
  oi.integrity_state as oos_integrity_state,
  oi.release_id as oos_release_id,
  oi.dataset_fingerprint as oos_dataset_fingerprint,
  p.proposal_id,
  p.target_engine_version,
  p.created_at as proposal_created_at,
  coalesce(rr.min_fresh_trade_dates_observed,0) as fresh_trade_dates,
  coalesce(rr.min_challenger_selected_observed,0) as min_challenger_selected,
  coalesce(rr.passed_modes,0) as forward_passed_modes,
  coalesce(rr.mode_count,0) as forward_mode_count,
  coalesce(rr.activation_review_ready,false) as activation_review_ready,
  rv.review_id,
  coalesce(rv.production_activated,false) as production_activated,
  case
    when oi.integrity_state is distinct from 'FROZEN_PASS' then 'BLOCKED_OOS_NOT_FROZEN'
    when p.proposal_id is null and not coalesce(pp.proposal_ready,false) then 'BLOCKED_PROMOTION_ASSESSMENT'
    when p.proposal_id is null then 'READY_FOR_MANUAL_PROPOSAL'
    when p.release_id is distinct from oi.release_id
      or p.dataset_fingerprint is distinct from oi.dataset_fingerprint then 'HOLD_PROPOSAL_BINDING'
    when rv.review_id is not null and coalesce(rv.production_activated,false) then 'HOLD_UNEXPECTED_PRODUCTION_ACTIVATION'
    when rv.review_id is not null then 'REVIEW_RECORDED_NO_ACTIVATION'
    when not coalesce(rr.activation_review_ready,false) then 'COLLECTING_FORWARD_SHADOW'
    when not coalesce(ar.can_record_review,false) then 'HOLD_ACTIVATION_REVIEW_GATE'
    else 'READY_FOR_MANUAL_ACTIVATION_REVIEW'
  end as gate_state,
  case
    when oi.integrity_state is distinct from 'FROZEN_PASS' then 'One-time OOS release must be FROZEN_PASS first'
    when p.proposal_id is null then coalesce(pp.readiness_reason,'Promotion Proposal is not ready')
    when not coalesce(rr.activation_review_ready,false) then coalesce(rr.readiness_reason,'Forward Shadow is not mature')
    when not coalesce(ar.can_record_review,false) then coalesce(ar.review_reason,'Activation Review is not recordable')
    else 'Manual operator action only; no automatic activation'
  end as gate_reason
from oi
left join pp on true
left join p on true
left join rr on true
left join ar on true
left join rv on true;

revoke all on public.stock_hunter_promotion_forward_shadow_gate_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_promotion_forward_shadow_gate_v417
  to service_role;
