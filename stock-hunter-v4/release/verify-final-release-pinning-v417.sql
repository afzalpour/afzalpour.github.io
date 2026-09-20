-- Stock Hunter 4.1.7 Final Release Promotion / Pinning verifier.
-- State-aware: passes before release maturity and after a correctly frozen final release.
-- Expected final row: stock-hunter-final-release-pinning-v417: PASS

do $$
declare
  p public.stock_hunter_release_pin_policy_v417%rowtype;
  r public.stock_hunter_release_pin_readiness_v417%rowtype;
  m private.stock_hunter_release_pin_manifests_v417%rowtype;
  a private.stock_hunter_previous_stable_archive_v417%rowtype;
  manifest_count bigint;
  archive_count bigint;
  freeze_auth_count bigint;
  legacy_def text;
  prepare_def text;
  authorize_def text;
  freeze_def text;
begin
  select * into strict p
  from public.stock_hunter_release_pin_policy_v417
  where policy_id='default';

  select * into strict r
  from public.stock_hunter_release_pin_readiness_v417;

  if p.protocol_version<>'4.1.7-release-pin-v1'
     or p.target_release_version<>'4.1.7'
     or p.previous_stable_version<>'4.1.6'
     or p.required_capture_function_slug<>'stock-hunter-capture-v417'
     or p.auto_freeze then
    raise exception 'release-pin frozen policy mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_release_pin_policy_v417'::regclass
      and tgname='stock_hunter_release_pin_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then raise exception 'release-pin policy immutability trigger missing'; end if;

  if has_table_privilege('anon','public.stock_hunter_release_pin_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_release_pin_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_release_pin_policy_v417','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'release-pin policy has unexpected API write privilege';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and attname='capture_deployment_sha256'
      and attnotnull
      and not attisdropped
  ) then raise exception 'capture deployment sha256 pin missing/not-null contract missing'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and conname='stock_hunter_release_pin_capture_sha256_check'
  ) then raise exception 'capture deployment sha256 check missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and tgname='stock_hunter_release_manifest_immutable_v417' and tgenabled='O'
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and tgname='stock_hunter_release_manifest_truncate_v417' and tgenabled='O'
  ) then raise exception 'release manifest immutability triggers missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_freeze_authorizations_v417'::regclass
      and tgname='stock_hunter_release_freeze_authorization_immutable_v417' and tgenabled='O'
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_freeze_authorizations_v417'::regclass
      and tgname='stock_hunter_release_freeze_authorization_truncate_v417' and tgenabled='O'
  ) then raise exception 'release-freeze authorization immutability triggers missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_previous_stable_archive_v417'::regclass
      and tgname='stock_hunter_previous_stable_archive_immutable_v417' and tgenabled='O'
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_previous_stable_archive_v417'::regclass
      and tgname='stock_hunter_previous_stable_archive_truncate_v417' and tgenabled='O'
  ) then raise exception 'previous-stable archive immutability triggers missing'; end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid='private.stock_hunter_previous_stable_archive_v417'::regclass
      and attname='rollback_package_snapshot' and attnotnull and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
    where attrelid='private.stock_hunter_previous_stable_archive_v417'::regclass
      and attname='archive_fingerprint' and attnotnull and not attisdropped
  ) then raise exception 'rollback archive package/fingerprint columns missing'; end if;

  if has_function_privilege('anon','private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('authenticated','private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('anon','private.freeze_stock_hunter_release_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('authenticated','private.freeze_stock_hunter_release_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.freeze_stock_hunter_release_v417(bigint,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text,text)','EXECUTE') then
    raise exception 'manual final release functions exposed to API roles';
  end if;

  select pg_get_functiondef(
    'private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text)'::regprocedure
  ) into legacy_def;
  select pg_get_functiondef(
    'private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text,text)'::regprocedure
  ) into prepare_def;
  select pg_get_functiondef(
    'private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)'::regprocedure
  ) into authorize_def;
  select pg_get_functiondef(
    'private.freeze_stock_hunter_release_v417(bigint,bigint,text)'::regprocedure
  ) into freeze_def;

  if legacy_def not like '%capture deployment sha256 is required%' then
    raise exception 'legacy release prepare signature is not fail-closed';
  end if;

  if prepare_def not like '%capture_deployment_sha256%'
     or prepare_def not like '%post-activation stabilization blocked release preparation%'
     or prepare_def not like '%shikar-sahm-v4.1.7-%'
     or prepare_def not like '%stock-hunter-capture-v417%' then
    raise exception 'hardened release prepare contract mismatch';
  end if;

  if authorize_def not like '%ready_for_manual_release_freeze%'
     or authorize_def not like '%APPROVE_RELEASE_FREEZE%'
     or authorize_def not like '%capture_deployment_sha256%' then
    raise exception 'release-freeze authorization contract mismatch';
  end if;

  if freeze_def not like '%release freeze gate recheck blocked freeze%'
     or freeze_def not like '%release manifest fingerprint mismatch%'
     or freeze_def not like '%consumed_at is null%'
     or freeze_def not like '%4.1.6-hunt-v2%'
     or freeze_def not like '%shikar-sahm-v4.1.6-r12%'
     or freeze_def not like '%stock-hunter-capture-v416%'
     or freeze_def not like '%''capture_deployment_version'',6%'
     or freeze_def not like '%b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af%'
     or freeze_def not like '%VAULT_HMAC_NONCE_V2%'
     or freeze_def not like '%runtime_state_changed%' then
    raise exception 'final freeze / rollback archive contract mismatch';
  end if;

  select count(*) into manifest_count
  from private.stock_hunter_release_pin_manifests_v417;
  select count(*) into archive_count
  from private.stock_hunter_previous_stable_archive_v417;
  select count(*) into freeze_auth_count
  from private.stock_hunter_release_freeze_authorizations_v417;

  if manifest_count=0 then
    if r.pass_manifest_exists or r.ready_for_manual_release_freeze then
      raise exception 'release readiness is not fail-closed without a manifest';
    end if;
    if archive_count<>0 or freeze_auth_count<>0 then
      raise exception 'archive/authorization exists before first release manifest';
    end if;
  elsif manifest_count=1 then
    select * into strict m
    from private.stock_hunter_release_pin_manifests_v417
    limit 1;

    if m.release_version<>'4.1.7'
       or m.previous_stable_version<>'4.1.6'
       or m.capture_deployment_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'stored release manifest identity/pin mismatch';
    end if;

    if m.release_status='FROZEN' then
      if m.frozen_at is null then raise exception 'frozen release missing frozen_at'; end if;
      select count(*) into archive_count
      from private.stock_hunter_previous_stable_archive_v417
      where release_id=m.release_id;
      if archive_count<>1 then raise exception 'frozen release must have exactly one rollback archive'; end if;

      select * into strict a
      from private.stock_hunter_previous_stable_archive_v417
      where release_id=m.release_id;

      if a.previous_stable_version<>'4.1.6'
         or a.previous_engine_version<>'4.1.6-hunt-v2'
         or a.rollback_package_snapshot->>'service_worker_cache_version'<>'shikar-sahm-v4.1.6-r12'
         or a.rollback_package_snapshot->>'capture_function_slug'<>'stock-hunter-capture-v416'
         or nullif(a.rollback_package_snapshot->>'capture_deployment_version','')::integer<>6
         or a.rollback_package_snapshot->>'capture_deployment_sha256'<>'b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af'
         or a.rollback_package_snapshot->>'capture_auth_contract'<>'VAULT_HMAC_NONCE_V2'
         or nullif(a.archive_fingerprint,'') is null then
        raise exception 'frozen release rollback archive mismatch';
      end if;

      if not exists (
        select 1
        from private.stock_hunter_release_freeze_authorizations_v417 x
        where x.release_id=m.release_id
          and x.state_version=m.state_version
          and x.decision='APPROVE_RELEASE_FREEZE'
          and x.consumed_at is not null
      ) then raise exception 'frozen release missing consumed one-shot authorization'; end if;
    elsif m.release_status<>'PREPARED' then
      raise exception 'unexpected release manifest state';
    end if;
  else
    raise exception 'one-time release protocol permits only one 4.1.7 manifest';
  end if;
end $$;

select 'stock-hunter-final-release-pinning-v417: PASS' as result;
