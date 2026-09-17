-- Read-only verification for Stock Hunter 4.1.6 calibration/validation/robustness maturity.

do $$
declare
  v_selected_def text;
  v_validation_def text;
  v_unlock_def text;
  v_bad_selected integer;
  v_selected_modes integer;
  v_robust_modes integer;
  v_can_unlock boolean;
  v_require_both boolean;
  v_auto_unlock boolean;
  v_oos_used boolean;
  v_auto_promote boolean;
  v_release_cron integer;
begin
  select pg_get_viewdef('public.stock_hunter_candidate_selected_v416'::regclass,true)
    into v_selected_def;
  select pg_get_viewdef('public.stock_hunter_candidate_validation_selection_v416'::regclass,true)
    into v_validation_def;
  select pg_get_viewdef('public.stock_hunter_oos_unlock_readiness_v416'::regclass,true)
    into v_unlock_def;

  if position('stock_hunter_candidate_validation_selection_v416' in v_selected_def)=0 then
    raise exception 'candidate_selected bypasses validation selection';
  end if;
  if position('stock_hunter_candidate_train_shortlist_v416' in v_validation_def)=0
     or position('split = ''validation''' in v_validation_def)=0 then
    raise exception 'validation selection does not enforce Train shortlist -> Validation ordering';
  end if;

  select count(*) into v_bad_selected
  from public.stock_hunter_candidate_selected_v416 s
  left join public.stock_hunter_candidate_train_shortlist_v416 t
    on t.hunt_mode=s.hunt_mode and t.candidate_id=s.candidate_id
  where t.candidate_id is null or s.is_baseline;
  if v_bad_selected <> 0 then
    raise exception 'selected challenger violated Train-shortlist/non-baseline contract: %',v_bad_selected;
  end if;

  select require_both_modes,auto_unlock_oos
    into v_require_both,v_auto_unlock
  from public.stock_hunter_robustness_policy_v416
  where policy_id='default';
  if v_require_both is distinct from true then
    raise exception 'require_both_modes must remain true';
  end if;
  if v_auto_unlock is distinct from false then
    raise exception 'auto_unlock_oos must remain false';
  end if;

  select oos_used_for_selection,auto_promote
    into v_oos_used,v_auto_promote
  from public.stock_hunter_candidate_eval_policy_v416
  where policy_id='default';
  if v_oos_used is distinct from false then
    raise exception 'OOS must not be used for candidate selection';
  end if;
  if v_auto_promote is distinct from false then
    raise exception 'candidate auto promotion must remain false';
  end if;

  if position('count(distinct hunt_mode)' in lower(v_unlock_def))=0 then
    raise exception 'OOS readiness must count distinct hunt modes';
  end if;

  select selected_modes,robust_modes,can_unlock_oos
    into v_selected_modes,v_robust_modes,v_can_unlock
  from public.stock_hunter_maturity_status_v416;

  if v_selected_modes < 2 and v_can_unlock then
    raise exception 'OOS unlock allowed without two selected challengers';
  end if;
  if v_robust_modes < 2 and v_can_unlock then
    raise exception 'OOS unlock allowed without two robust modes';
  end if;

  select count(*) into v_release_cron
  from cron.job
  where active
    and (
      lower(jobname) like '%oos%'
      or lower(jobname) like '%robust%'
      or lower(command) like '%release_stock_hunter_oos%'
      or lower(command) like '%oos_unlocked%'
    );
  if v_release_cron <> 0 then
    raise exception 'unexpected automatic OOS/robustness release cron jobs: %',v_release_cron;
  end if;
end $$;

select 'stock-hunter-calibration-robustness-v416: PASS' as result;
