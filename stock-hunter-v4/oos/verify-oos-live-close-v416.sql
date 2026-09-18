-- Stock Hunter 4.1.6 one-time OOS release live-close verifier.
-- Safe before and after the single controlled release.
-- Expected final row: stock-hunter-oos-live-close-v416: PASS

do $$
declare
  v_manifest_count integer;
  v_dataset_count integer;
  v_result_count integer;
  v_oos_unlocked boolean;
  v_integrity_state text;
  v_view_def text;
  v_release_def text;
  v_diff integer;
  v_release_cron integer;
begin
  if to_regclass('public.stock_hunter_oos_release_dataset_v416') is null
     or to_regclass('public.stock_hunter_oos_release_integrity_v416') is null then
    raise exception 'OOS frozen dataset/integrity surface missing';
  end if;

  if (select count(*) from pg_attribute
      where attrelid='public.stock_hunter_calibration_dataset_v416'::regclass
        and attnum>0 and not attisdropped) <> 40 then
    raise exception 'Calibration view column contract drifted';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_calibration_dataset_v416'::regclass
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'Calibration view must remain security_invoker';
  end if;

  if not (select relrowsecurity from pg_class
          where oid='public.stock_hunter_oos_release_dataset_v416'::regclass) then
    raise exception 'frozen OOS dataset RLS missing';
  end if;

  if not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
        and tgname='stock_hunter_oos_dataset_insert_guard_v416'
        and tgenabled='O' and not tgisinternal
    )
    or not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
        and tgname='stock_hunter_oos_dataset_immutable_v416'
        and tgenabled='O' and not tgisinternal
    ) then
    raise exception 'frozen dataset trigger contract mismatch';
  end if;

  if not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_oos_release_manifest_v416'::regclass
        and tgname='stock_hunter_oos_manifest_immutable_v416'
        and tgenabled='O' and not tgisinternal
    )
    or not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_oos_release_results_v416'::regclass
        and tgname='stock_hunter_oos_results_immutable_v416'
        and tgenabled='O' and not tgisinternal
    ) then
    raise exception 'manifest/results immutability contract mismatch';
  end if;

  if not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_candidate_library_v416'::regclass
        and tgname='stock_hunter_candidate_library_freeze_after_oos_v416'
        and tgenabled='O' and not tgisinternal
    )
    or not exists (
      select 1 from pg_trigger
      where tgrelid='public.stock_hunter_candidate_weights_v416'::regclass
        and tgname='stock_hunter_candidate_weights_freeze_after_oos_v416'
        and tgenabled='O' and not tgisinternal
    ) then
    raise exception 'candidate-definition post-OOS freeze triggers missing';
  end if;

  if has_table_privilege('anon','public.stock_hunter_oos_release_dataset_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_dataset_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_dataset_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('anon','public.stock_hunter_oos_release_manifest_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_manifest_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_manifest_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('anon','public.stock_hunter_oos_release_results_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_results_v416','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_oos_release_results_v416','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'OOS frozen/audit tables have unexpected API write privilege';
  end if;

  if not has_table_privilege('anon','public.stock_hunter_oos_release_dataset_v416','SELECT')
     or not has_table_privilege('authenticated','public.stock_hunter_oos_release_dataset_v416','SELECT')
     or not has_table_privilege('service_role','public.stock_hunter_oos_release_dataset_v416','SELECT') then
    raise exception 'frozen dataset read contract mismatch';
  end if;

  if has_table_privilege('anon','public.stock_hunter_oos_release_integrity_v416','SELECT')
     or has_table_privilege('authenticated','public.stock_hunter_oos_release_integrity_v416','SELECT')
     or not has_table_privilege('service_role','public.stock_hunter_oos_release_integrity_v416','SELECT') then
    raise exception 'OOS integrity surface is not service-role-only';
  end if;

  if has_function_privilege('anon','private.release_stock_hunter_oos_v416(text,text)','EXECUTE')
     or has_function_privilege('authenticated','private.release_stock_hunter_oos_v416(text,text)','EXECUTE')
     or has_function_privilege('service_role','private.release_stock_hunter_oos_v416(text,text)','EXECUTE')
     or not has_function_privilege('postgres','private.release_stock_hunter_oos_v416(text,text)','EXECUTE') then
    raise exception 'OOS release execute ACL mismatch';
  end if;

  select pg_get_functiondef('private.release_stock_hunter_oos_v416(text,text)'::regprocedure)
    into v_release_def;
  if position('SECURITY DEFINER' in v_release_def)=0
     or position('SET search_path TO ''''' in v_release_def)=0
     or position('OOS robustness gate is not ready' in v_release_def)=0
     or position('stock_hunter_oos_release_dataset_v416' in v_release_def)=0
     or position('md5-jsonb-v2' in v_release_def)=0
     or position('frozen OOS dataset fingerprint mismatch' in v_release_def)=0
     or position('both hunt modes must have selected non-baseline candidates' in v_release_def)=0 then
    raise exception 'controlled OOS release hardening contract mismatch';
  end if;

  select pg_get_viewdef('public.stock_hunter_calibration_dataset_v416'::regclass,true)
    into v_view_def;
  if position('stock_hunter_oos_release_dataset_v416' in v_view_def)=0
     or position('freeze_state' in v_view_def)=0 then
    raise exception 'Calibration dataset is not wired to frozen OOS snapshot';
  end if;

  if (select oos_used_for_selection
      from public.stock_hunter_candidate_eval_policy_v416 where policy_id='default') then
    raise exception 'OOS is being used for candidate selection';
  end if;

  if (select auto_promote
      from public.stock_hunter_candidate_eval_policy_v416 where policy_id='default') then
    raise exception 'candidate auto-promote must remain off';
  end if;

  if (select auto_unlock_oos
      from public.stock_hunter_robustness_policy_v416 where policy_id='default') then
    raise exception 'automatic OOS unlock must remain off';
  end if;

  if not (select require_both_modes
          from public.stock_hunter_robustness_policy_v416 where policy_id='default') then
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
  if v_release_cron<>0 then
    raise exception 'automatic OOS release path detected in cron';
  end if;

  select count(*) into v_manifest_count
  from public.stock_hunter_oos_release_manifest_v416;
  select count(*) into v_dataset_count
  from public.stock_hunter_oos_release_dataset_v416;
  select count(*) into v_result_count
  from public.stock_hunter_oos_release_results_v416;
  select oos_unlocked into v_oos_unlocked
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true;
  select integrity_state into v_integrity_state
  from public.stock_hunter_oos_release_integrity_v416;

  if v_manifest_count=0 then
    if v_dataset_count<>0 or v_result_count<>0 or coalesce(v_oos_unlocked,false) then
      raise exception 'pre-release OOS residue exists';
    end if;
    if v_integrity_state<>'LOCKED_AWAITING_MATURITY' then
      raise exception 'unexpected pre-release integrity state: %',v_integrity_state;
    end if;
  elsif v_manifest_count=1 then
    if not coalesce(v_oos_unlocked,false) then
      raise exception 'manifest exists without OOS unlock';
    end if;
    if v_integrity_state<>'FROZEN_PASS' then
      raise exception 'released OOS integrity state is %',v_integrity_state;
    end if;

    select count(*) into v_diff
    from (
      (select to_jsonb(d) j
       from public.stock_hunter_calibration_dataset_v416 d
       except
       select to_jsonb(f)-'release_id'-'frozen_at'
       from public.stock_hunter_oos_release_dataset_v416 f)
      union all
      (select to_jsonb(f)-'release_id'-'frozen_at'
       from public.stock_hunter_oos_release_dataset_v416 f
       except
       select to_jsonb(d)
       from public.stock_hunter_calibration_dataset_v416 d)
    ) q;

    if v_diff<>0 then
      raise exception 'post-release Calibration/frozen snapshot mismatch: %',v_diff;
    end if;
  else
    raise exception 'one-time OOS protocol has % manifests',v_manifest_count;
  end if;
end $$;

select 'stock-hunter-oos-live-close-v416: PASS' as result;
