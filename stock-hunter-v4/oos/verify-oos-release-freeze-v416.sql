-- Read-only, state-aware verification for Stock Hunter 4.1.6 one-time OOS release.
-- Safe before release and after the single controlled release.

do $$
declare
  v_manifest_count integer;
  v_snapshot_count integer;
  v_result_count integer;
  v_oos_unlocked boolean;
  v_integrity_state text;
  v_view_def text;
  v_release_def text;
  v_rls boolean;
  v_triggers integer;
  v_release_cron integer;
  v_oos_used boolean;
  v_candidate_auto boolean;
  v_auto_unlock boolean;
  v_require_both boolean;
  v_diff integer;
begin
  if to_regclass('public.stock_hunter_oos_release_dataset_v416') is null then
    raise exception 'frozen OOS dataset table is missing';
  end if;
  if to_regclass('public.stock_hunter_oos_release_integrity_v416') is null then
    raise exception 'OOS release integrity view is missing';
  end if;

  select relrowsecurity into v_rls
  from pg_class
  where oid='public.stock_hunter_oos_release_dataset_v416'::regclass;
  if not coalesce(v_rls,false) then
    raise exception 'frozen OOS dataset must have RLS enabled';
  end if;

  select count(*) into v_triggers
  from pg_trigger
  where tgrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
    and not tgisinternal
    and tgname in ('stock_hunter_oos_dataset_insert_guard_v416','stock_hunter_oos_dataset_immutable_v416');
  if v_triggers <> 2 then
    raise exception 'frozen OOS dataset trigger contract mismatch: %',v_triggers;
  end if;

  select pg_get_functiondef('private.release_stock_hunter_oos_v416(text,text)'::regprocedure)
    into v_release_def;
  if position('SECURITY DEFINER' in v_release_def)=0
     or position('OOS robustness gate is not ready' in v_release_def)=0
     or position('stock_hunter_oos_release_dataset_v416' in v_release_def)=0
     or position('frozen OOS dataset fingerprint mismatch' in v_release_def)=0 then
    raise exception 'controlled OOS release function is missing freeze/robustness invariants';
  end if;

  if has_function_privilege('anon','private.release_stock_hunter_oos_v416(text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.release_stock_hunter_oos_v416(text,text)','EXECUTE')
     or has_function_privilege('service_role','private.release_stock_hunter_oos_v416(text,text)','EXECUTE') then
    raise exception 'OOS release function must remain postgres/manual-only';
  end if;

  if has_table_privilege('anon','public.stock_hunter_oos_release_dataset_v416','INSERT')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_dataset_v416','INSERT')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_dataset_v416','INSERT')
     or has_table_privilege('anon','public.stock_hunter_oos_release_dataset_v416','UPDATE')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_dataset_v416','UPDATE')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_dataset_v416','UPDATE')
     or has_table_privilege('anon','public.stock_hunter_oos_release_dataset_v416','DELETE')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_dataset_v416','DELETE')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_dataset_v416','DELETE') then
    raise exception 'frozen OOS dataset is writable by a non-manual role';
  end if;

  if has_table_privilege('anon','public.stock_hunter_oos_release_manifest_v416','INSERT')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_manifest_v416','INSERT')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_manifest_v416','INSERT')
     or has_table_privilege('anon','public.stock_hunter_oos_release_results_v416','INSERT')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_results_v416','INSERT')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_results_v416','INSERT') then
    raise exception 'OOS audit tables are writable by a non-manual role';
  end if;

  select oos_used_for_selection,auto_promote
    into v_oos_used,v_candidate_auto
  from public.stock_hunter_candidate_eval_policy_v416
  where policy_id='default';
  if v_oos_used is distinct from false then
    raise exception 'OOS must never be used for candidate selection';
  end if;
  if v_candidate_auto is distinct from false then
    raise exception 'candidate auto promotion must remain false';
  end if;

  select auto_unlock_oos,require_both_modes
    into v_auto_unlock,v_require_both
  from public.stock_hunter_robustness_policy_v416
  where policy_id='default';
  if v_auto_unlock is distinct from false then
    raise exception 'OOS auto unlock must remain false';
  end if;
  if v_require_both is distinct from true then
    raise exception 'both hunt modes must remain required';
  end if;

  select count(*) into v_release_cron
  from cron.job
  where active
    and (
      lower(jobname) like '%oos%'
      or lower(command) like '%release_stock_hunter_oos_v416%'
      or lower(command) like '%oos_unlocked%'
    );
  if v_release_cron <> 0 then
    raise exception 'unexpected automatic OOS release path in cron: %',v_release_cron;
  end if;

  select pg_get_viewdef('public.stock_hunter_calibration_dataset_v416'::regclass,true)
    into v_view_def;
  if position('stock_hunter_oos_release_dataset_v416' in v_view_def)=0
     or position('exists' in lower(v_view_def))=0 then
    raise exception 'Calibration view is not switched by the immutable frozen dataset';
  end if;

  select count(*)::integer into v_manifest_count
  from public.stock_hunter_oos_release_manifest_v416;
  select count(*)::integer into v_snapshot_count
  from public.stock_hunter_oos_release_dataset_v416;
  select count(*)::integer into v_result_count
  from public.stock_hunter_oos_release_results_v416;
  select oos_unlocked into v_oos_unlocked
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true;
  select integrity_state into v_integrity_state
  from public.stock_hunter_oos_release_integrity_v416;

  if v_manifest_count=0 then
    if v_snapshot_count<>0 or v_result_count<>0 or coalesce(v_oos_unlocked,false) then
      raise exception 'pre-release state has OOS residue: manifest %, snapshot %, results %, unlocked %',
        v_manifest_count,v_snapshot_count,v_result_count,v_oos_unlocked;
    end if;
    if v_integrity_state is distinct from 'LOCKED_AWAITING_MATURITY' then
      raise exception 'unexpected pre-release integrity state: %',v_integrity_state;
    end if;
  elsif v_manifest_count=1 then
    if not coalesce(v_oos_unlocked,false) then
      raise exception 'release manifest exists while OOS is still locked';
    end if;
    if v_integrity_state is distinct from 'FROZEN_PASS' then
      raise exception 'released OOS integrity is not FROZEN_PASS: %',v_integrity_state;
    end if;

    select count(*)::integer into v_diff
    from (
      (select to_jsonb(d) as j from public.stock_hunter_calibration_dataset_v416 d
       except
       select to_jsonb(f)-'release_id'-'frozen_at' as j from public.stock_hunter_oos_release_dataset_v416 f)
      union all
      (select to_jsonb(f)-'release_id'-'frozen_at' as j from public.stock_hunter_oos_release_dataset_v416 f
       except
       select to_jsonb(d) as j from public.stock_hunter_calibration_dataset_v416 d)
    ) q;
    if v_diff<>0 then
      raise exception 'post-release Calibration dataset differs from frozen OOS snapshot: % rows',v_diff;
    end if;
  else
    raise exception 'more than one OOS release manifest exists: %',v_manifest_count;
  end if;
end $$;

select 'stock-hunter-oos-release-freeze-v416: PASS' as result;
