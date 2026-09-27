-- Stock Hunter 4.1.6
-- Enforce Train -> Validation -> Robustness ordering and fail-closed maturity semantics.

create or replace view public.stock_hunter_candidate_selected_v416
with (security_invoker = true)
as
select
  l.candidate_id,
  l.hunt_mode,
  l.is_baseline,
  l.family,
  l.order_pressure,
  l.impulse,
  l.feasibility,
  l.flow_volume,
  l.market_context,
  l.train_selected,
  l.train_utility,
  l.train_return_3d_pct,
  l.train_mfe_3d_pct,
  l.train_mae_3d_pct,
  l.validation_selected,
  l.validation_utility,
  l.validation_return_3d_pct,
  l.validation_mfe_3d_pct,
  l.validation_mae_3d_pct,
  l.validation_positive_rate_3d_pct,
  l.eligible_for_selection,
  v.validation_rank
from public.stock_hunter_candidate_validation_selection_v416 v
join public.stock_hunter_candidate_leaderboard_v416 l
  on l.hunt_mode=v.hunt_mode
 and l.candidate_id=v.candidate_id
where v.validation_rank=1
  and v.is_baseline=false
  and l.eligible_for_selection=true;

comment on view public.stock_hunter_candidate_selected_v416 is
  'Selected non-baseline challenger per mode. Candidate must survive Train shortlist first, then rank #1 on Validation; baseline winning causes abstention.';

create or replace view public.stock_hunter_oos_unlock_readiness_v416
with (security_invoker = true)
as
with pol as (
  select *
  from public.stock_hunter_robustness_policy_v416
  where policy_id='default'
), r as (
  select
    count(distinct hunt_mode) filter (where not is_baseline)::integer as mode_count,
    count(distinct hunt_mode) filter (where not is_baseline and robustness_ready)::integer as robust_modes
  from public.stock_hunter_candidate_robustness_v416
), c as (
  select *
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true
)
select
  r.mode_count,
  r.robust_modes,
  pol.require_both_modes,
  pol.auto_unlock_oos,
  c.oos_unlocked,
  c.oos_unlocked_at,
  c.oos_unlock_note,
  (
    not c.oos_unlocked
    and (
      (pol.require_both_modes and r.mode_count=2 and r.robust_modes=2)
      or (not pol.require_both_modes and r.robust_modes>=1)
    )
  ) as can_unlock_oos,
  case
    when c.oos_unlocked then 'OOS قبلاً باز شده است'
    when r.mode_count=0 then 'challenger غیر-Baseline منتخب هنوز وجود ندارد'
    when pol.require_both_modes and r.mode_count<2 then 'هر دو Mode هنوز challenger غیر-Baseline منتخب ندارند'
    when pol.require_both_modes and r.robust_modes<2 then 'Robustness Gate هر دو Mode پاس نشده است'
    when not pol.require_both_modes and r.robust_modes<1 then 'هیچ Modeای Robustness Gate را پاس نکرده است'
    else 'OOS آماده بازگشایی دستی یک‌باره است'
  end as unlock_reason
from r cross join pol cross join c;

create or replace view public.stock_hunter_maturity_status_v416
with (security_invoker = true)
as
with cal as (
  select * from public.stock_hunter_calibration_readiness_v416
), sel as (
  select
    count(distinct hunt_mode)::integer as selected_modes,
    max(candidate_id) filter (where hunt_mode='reversal') as selected_reversal_candidate,
    max(candidate_id) filter (where hunt_mode='acceleration') as selected_acceleration_candidate
  from public.stock_hunter_candidate_selected_v416
), rob as (
  select
    count(distinct hunt_mode) filter (where not is_baseline)::integer as robustness_modes,
    count(distinct hunt_mode) filter (where not is_baseline and robustness_ready)::integer as robust_modes,
    bool_or(robustness_ready) filter (where hunt_mode='reversal' and not is_baseline) as reversal_robust,
    bool_or(robustness_ready) filter (where hunt_mode='acceleration' and not is_baseline) as acceleration_robust
  from public.stock_hunter_candidate_robustness_v416
), pol as (
  select * from public.stock_hunter_robustness_policy_v416 where policy_id='default'
), u as (
  select * from public.stock_hunter_oos_unlock_readiness_v416
)
select
  cal.total_samples,
  cal.reversal_samples,
  cal.acceleration_samples,
  cal.oos_samples,
  cal.trade_dates,
  cal.calibration_ready,
  cal.readiness_reason as calibration_reason,
  sel.selected_modes,
  sel.selected_reversal_candidate,
  sel.selected_acceleration_candidate,
  rob.robustness_modes,
  rob.robust_modes,
  coalesce(rob.reversal_robust,false) as reversal_robust,
  coalesce(rob.acceleration_robust,false) as acceleration_robust,
  pol.min_validation_trade_dates,
  pol.min_paired_trade_dates,
  pol.min_slice_selected_symbol_days,
  pol.min_slice_passes,
  pol.bootstrap_reps,
  pol.bootstrap_block_days,
  pol.min_bootstrap_win_rate,
  pol.min_bootstrap_p10_diff,
  pol.require_both_modes,
  pol.auto_unlock_oos,
  u.oos_unlocked,
  u.can_unlock_oos,
  u.unlock_reason,
  case
    when u.oos_unlocked then 'OOS_RELEASED'
    when not cal.calibration_ready then 'COLLECTING'
    when sel.selected_modes<2 then 'VALIDATION_SELECTION_PENDING'
    when rob.robust_modes<2 then 'ROBUSTNESS_PENDING'
    when u.can_unlock_oos then 'READY_FOR_MANUAL_OOS_RELEASE'
    else 'HOLD'
  end as maturity_state
from cal cross join sel cross join rob cross join pol cross join u;

revoke all on public.stock_hunter_maturity_status_v416 from public, anon, authenticated;
grant select on public.stock_hunter_maturity_status_v416 to service_role;
