-- Stock Hunter 4.1.7 Promotion Proposal -> Forward Shadow -> Activation Review guard layer.
-- PROMOTION_FORWARD_SHADOW_CONTRACT: OOS_FROZEN_MANUAL_ONLY_PROSPECTIVE_PAIRED
--
-- This migration intentionally preserves the already-defined Promotion/Rollout policy
-- thresholds. It adds fail-closed guards around their write surfaces and requires the
-- one-time OOS freeze contract to exist first. It must be applied only after
-- oos-release-freeze-v416.sql is live and verified.

begin;

do $$
begin
  if to_regclass('public.stock_hunter_oos_release_integrity_v416') is null then
    raise exception 'OOS freeze integrity view is required before Promotion/Forward Shadow hardening';
  end if;
  if to_regclass('public.stock_hunter_oos_release_manifest_v416') is null then
    raise exception 'OOS release manifest is required';
  end if;
  if to_regclass('public.stock_hunter_promotion_policy_v416') is null
     or to_regclass('public.stock_hunter_promotion_readiness_v416') is null
     or to_regclass('public.stock_hunter_promotion_proposals_v416') is null then
    raise exception 'existing Promotion Decision Protocol objects are required';
  end if;
  if to_regclass('public.stock_hunter_rollout_policy_v417') is null
     or to_regclass('public.stock_hunter_rollout_readiness_v417') is null
     or to_regclass('public.stock_hunter_challenger_shadow_samples_v417') is null then
    raise exception 'existing Forward Shadow objects are required';
  end if;
  if to_regclass('public.stock_hunter_activation_review_readiness_v417') is null
     or to_regclass('public.stock_hunter_activation_reviews_v417') is null then
    raise exception 'existing Activation Review objects are required';
  end if;
end $$;

-- Preserve the existing frozen numerical policy. Only the already-documented structural
-- minimums are asserted here; utility/return/risk thresholds remain exactly as stored in
-- the existing policy rows and are not re-invented by this migration.
do $$
declare
  v_days integer;
  v_selected integer;
  v_auto_activate boolean;
  v_auto_promote boolean;
begin
  select min_fresh_trade_dates,min_selected_per_mode,auto_activate
    into v_days,v_selected,v_auto_activate
  from public.stock_hunter_rollout_policy_v417
  where policy_id='default';
  if v_days is distinct from 10 then
    raise exception 'unexpected Forward Shadow day threshold: expected 10, got %',v_days;
  end if;
  if v_selected is distinct from 30 then
    raise exception 'unexpected Forward Shadow per-mode sample threshold: expected 30, got %',v_selected;
  end if;
  if v_auto_activate is distinct from false then
    raise exception 'Forward Shadow auto_activate must remain false';
  end if;

  select auto_promote into v_auto_promote
  from public.stock_hunter_promotion_policy_v416
  where policy_id='default';
  if v_auto_promote is distinct from false then
    raise exception 'Promotion auto_promote must remain false';
  end if;
end $$;

-- The existing Forward Shadow sample table is treated as a paired Champion/Challenger
-- observation surface. Require the stable provenance key used by the v4.1.6 shadow path.
do $$
declare
  v_missing text[] := array[]::text[];
  v_col text;
begin
  foreach v_col in array array['sample_id','proposal_id','trade_date','symbol_id','hunt_mode','observed_at','bucket_minute','created_at']
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name='stock_hunter_challenger_shadow_samples_v417'
        and column_name=v_col
    ) then
      v_missing:=array_append(v_missing,v_col);
    end if;
  end loop;
  if coalesce(array_length(v_missing,1),0)>0 then
    raise exception 'Forward Shadow provenance columns missing: %',array_to_string(v_missing,', ');
  end if;
end $$;

create unique index if not exists stock_hunter_forward_shadow_pair_key_v417
  on public.stock_hunter_challenger_shadow_samples_v417
  (proposal_id,trade_date,symbol_id,bucket_minute,hunt_mode);

-- Promotion proposal creation is permitted only after a valid one-time OOS release,
-- exact release/fingerprint binding, and a two-mode OOS Promotion assessment PASS.
create or replace function private.guard_stock_hunter_promotion_proposal_v417()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_new jsonb:=to_jsonb(new);
  v_integrity text;
  v_release_id bigint;
  v_manifest_fingerprint text;
  v_new_release bigint;
  v_new_fingerprint text;
  v_target text;
  v_policy_target text;
  v_ready boolean;
  v_passed integer;
  v_modes integer;
begin
  select integrity_state,release_id,dataset_fingerprint
    into v_integrity,v_release_id,v_manifest_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;

  if v_integrity is distinct from 'FROZEN_PASS' then
    raise exception 'Promotion Proposal blocked: OOS integrity must be FROZEN_PASS (current=%)',coalesce(v_integrity,'NULL');
  end if;

  v_new_release:=nullif(v_new->>'release_id','')::bigint;
  v_new_fingerprint:=nullif(v_new->>'dataset_fingerprint','');
  v_target:=nullif(v_new->>'target_engine_version','');
  if v_new_release is distinct from v_release_id then
    raise exception 'Promotion Proposal release_id does not match frozen OOS release';
  end if;
  if v_new_fingerprint is distinct from v_manifest_fingerprint then
    raise exception 'Promotion Proposal dataset fingerprint does not match frozen OOS release';
  end if;

  select target_engine_version into v_policy_target
  from public.stock_hunter_promotion_policy_v416
  where policy_id='default';
  if v_target is distinct from v_policy_target then
    raise exception 'Promotion Proposal target version does not match frozen Promotion policy';
  end if;

  select proposal_ready,passed_modes,mode_count
    into v_ready,v_passed,v_modes
  from public.stock_hunter_promotion_readiness_v416
  limit 1;
  if not coalesce(v_ready,false) or coalesce(v_modes,0)<>2 or coalesce(v_passed,0)<>2 then
    raise exception 'Promotion Proposal blocked: both OOS modes must pass Promotion assessment';
  end if;

  if exists (
    select 1
    from public.stock_hunter_promotion_proposals_v416 p
    where p.release_id=v_new_release and p.target_engine_version=v_target
  ) then
    raise exception 'Promotion Proposal already exists for this OOS release and target version';
  end if;

  new.created_at:=now();
  return new;
end $$;
revoke all on function private.guard_stock_hunter_promotion_proposal_v417() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_promotion_proposal_v417() to postgres;

drop trigger if exists stock_hunter_promotion_proposal_oos_guard_v417
  on public.stock_hunter_promotion_proposals_v416;
create trigger stock_hunter_promotion_proposal_oos_guard_v417
before insert on public.stock_hunter_promotion_proposals_v416
for each row execute function private.guard_stock_hunter_promotion_proposal_v417();

create unique index if not exists stock_hunter_promotion_release_target_once_v417
  on public.stock_hunter_promotion_proposals_v416(release_id,target_engine_version);

-- Forward Shadow is prospective-only. A row must bind to an existing Proposal, occur
-- after Proposal creation, match Tehran trade_date, arrive within the same 10-minute
-- provenance envelope used by prospective Calibration, and represent one of both modes.
create or replace function private.guard_stock_hunter_forward_shadow_v417()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_new jsonb:=to_jsonb(new);
  v_integrity text;
  v_proposal_id bigint;
  v_proposal_created timestamptz;
  v_observed timestamptz;
  v_created timestamptz;
  v_trade_date date;
  v_mode text;
begin
  select integrity_state into v_integrity
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;
  if v_integrity is distinct from 'FROZEN_PASS' then
    raise exception 'Forward Shadow blocked: OOS integrity is not FROZEN_PASS';
  end if;

  v_proposal_id:=nullif(v_new->>'proposal_id','')::bigint;
  v_observed:=nullif(v_new->>'observed_at','')::timestamptz;
  v_created:=coalesce(nullif(v_new->>'created_at','')::timestamptz,now());
  v_trade_date:=nullif(v_new->>'trade_date','')::date;
  v_mode:=nullif(v_new->>'hunt_mode','');

  select created_at into v_proposal_created
  from public.stock_hunter_promotion_proposals_v416
  where proposal_id=v_proposal_id;
  if v_proposal_created is null then
    raise exception 'Forward Shadow blocked: Promotion Proposal does not exist';
  end if;
  if v_observed is null or v_observed<=v_proposal_created then
    raise exception 'Forward Shadow must be strictly prospective after Promotion Proposal';
  end if;
  if v_trade_date is distinct from (v_observed at time zone 'Asia/Tehran')::date then
    raise exception 'Forward Shadow trade_date must match observed_at Tehran date';
  end if;
  if v_created < v_observed-interval '2 minutes'
     or v_created > v_observed+interval '10 minutes' then
    raise exception 'Forward Shadow capture provenance lag is outside allowed window';
  end if;
  if v_mode not in ('reversal','acceleration') then
    raise exception 'Forward Shadow hunt_mode must be reversal or acceleration';
  end if;
  return new;
end $$;
revoke all on function private.guard_stock_hunter_forward_shadow_v417() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_forward_shadow_v417() to postgres;

drop trigger if exists stock_hunter_forward_shadow_prospective_guard_v417
  on public.stock_hunter_challenger_shadow_samples_v417;
create trigger stock_hunter_forward_shadow_prospective_guard_v417
before insert on public.stock_hunter_challenger_shadow_samples_v417
for each row execute function private.guard_stock_hunter_forward_shadow_v417();

-- Activation Review is an immutable audit record only. It can be inserted once per
-- proposal after the existing Forward Shadow readiness gate is true. It never activates
-- production and cannot be used to bypass the OOS freeze dependency.
create or replace function private.guard_stock_hunter_activation_review_v417()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_new jsonb:=to_jsonb(new);
  v_integrity text;
  v_proposal_id bigint;
  v_ready boolean;
  v_ready_proposal bigint;
  v_production_activated boolean;
begin
  select integrity_state into v_integrity
  from public.stock_hunter_oos_release_integrity_v416
  limit 1;
  if v_integrity is distinct from 'FROZEN_PASS' then
    raise exception 'Activation Review blocked: OOS integrity is not FROZEN_PASS';
  end if;

  v_proposal_id:=nullif(v_new->>'proposal_id','')::bigint;
  v_production_activated:=coalesce(nullif(v_new->>'production_activated','')::boolean,false);
  if v_production_activated then
    raise exception 'Activation Review cannot activate production';
  end if;
  if not exists(select 1 from public.stock_hunter_promotion_proposals_v416 where proposal_id=v_proposal_id) then
    raise exception 'Activation Review blocked: Promotion Proposal does not exist';
  end if;

  select can_record_review,proposal_id
    into v_ready,v_ready_proposal
  from public.stock_hunter_activation_review_readiness_v417
  limit 1;
  if not coalesce(v_ready,false) or v_ready_proposal is distinct from v_proposal_id then
    raise exception 'Activation Review blocked: Forward Shadow readiness is not PASS for this Proposal';
  end if;
  if exists(select 1 from public.stock_hunter_activation_reviews_v417 where proposal_id=v_proposal_id) then
    raise exception 'Activation Review already exists for this Proposal';
  end if;
  return new;
end $$;
revoke all on function private.guard_stock_hunter_activation_review_v417() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_activation_review_v417() to postgres;

drop trigger if exists stock_hunter_activation_review_gate_v417
  on public.stock_hunter_activation_reviews_v417;
create trigger stock_hunter_activation_review_gate_v417
before insert on public.stock_hunter_activation_reviews_v417
for each row execute function private.guard_stock_hunter_activation_review_v417();

create unique index if not exists stock_hunter_activation_review_once_per_proposal_v417
  on public.stock_hunter_activation_reviews_v417(proposal_id);

-- Keep all automation OFF even if someone later edits policy rows directly.
create or replace function private.guard_stock_hunter_promotion_rollout_automation_v417()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_new jsonb:=to_jsonb(new);
begin
  if coalesce((v_new->>'auto_promote')::boolean,false)
     or coalesce((v_new->>'auto_activate')::boolean,false) then
    raise exception 'automatic Promotion/Activation is forbidden; manual review only';
  end if;
  return new;
end $$;
revoke all on function private.guard_stock_hunter_promotion_rollout_automation_v417() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_promotion_rollout_automation_v417() to postgres;

drop trigger if exists stock_hunter_promotion_policy_manual_only_v417
  on public.stock_hunter_promotion_policy_v416;
create trigger stock_hunter_promotion_policy_manual_only_v417
before insert or update on public.stock_hunter_promotion_policy_v416
for each row execute function private.guard_stock_hunter_promotion_rollout_automation_v417();

drop trigger if exists stock_hunter_rollout_policy_manual_only_v417
  on public.stock_hunter_rollout_policy_v417;
create trigger stock_hunter_rollout_policy_manual_only_v417
before insert or update on public.stock_hunter_rollout_policy_v417
for each row execute function private.guard_stock_hunter_promotion_rollout_automation_v417();

-- Unified, read-only state surface. The existing numerical readiness calculations remain
-- the source of truth; this view only adds the explicit OOS dependency and fail-closed
-- lifecycle state used by operators.
create or replace view public.stock_hunter_promotion_forward_shadow_gate_v417
with (security_invoker=true)
as
with oi as (
  select integrity_state,release_id,dataset_fingerprint
  from public.stock_hunter_oos_release_integrity_v416
  limit 1
), pp as (
  select proposal_ready,passed_modes,mode_count,readiness_reason,proposal_id
  from public.stock_hunter_promotion_readiness_v416
  limit 1
), p as (
  select proposal_id,release_id,target_engine_version,dataset_fingerprint,created_at
  from public.stock_hunter_promotion_proposals_v416
  order by proposal_id desc
  limit 1
), rr as (
  select proposal_id,target_engine_version,min_fresh_trade_dates_observed,
         min_challenger_selected_observed,passed_modes,mode_count,
         activation_review_ready,readiness_reason
  from public.stock_hunter_rollout_readiness_v417
  limit 1
), ar as (
  select proposal_id,can_record_review,review_reason
  from public.stock_hunter_activation_review_readiness_v417
  limit 1
), rv as (
  select review_id,proposal_id,review_status,production_activated,reviewed_at
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
    when p.proposal_id is null and coalesce(pp.proposal_ready,false) then 'READY_FOR_MANUAL_PROPOSAL'
    when p.release_id is distinct from oi.release_id or p.dataset_fingerprint is distinct from oi.dataset_fingerprint then 'HOLD_PROPOSAL_BINDING'
    when rv.review_id is not null and coalesce(rv.production_activated,false) then 'HOLD_UNEXPECTED_PRODUCTION_ACTIVATION'
    when rv.review_id is not null then 'REVIEW_RECORDED_NO_ACTIVATION'
    when not coalesce(rr.activation_review_ready,false) then 'COLLECTING_FORWARD_SHADOW'
    when not coalesce(ar.can_record_review,false) then 'HOLD_ACTIVATION_REVIEW_GATE'
    else 'READY_FOR_MANUAL_ACTIVATION_REVIEW'
  end as gate_state,
  case
    when oi.integrity_state is distinct from 'FROZEN_PASS' then 'One-time OOS freeze must be FROZEN_PASS first'
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

grant select on public.stock_hunter_promotion_forward_shadow_gate_v417 to anon,authenticated,service_role;

comment on view public.stock_hunter_promotion_forward_shadow_gate_v417 is
  'Fail-closed read-only lifecycle: OOS freeze -> manual Promotion Proposal -> prospective paired Forward Shadow -> manual Activation Review. No traffic mutation.';

commit;
