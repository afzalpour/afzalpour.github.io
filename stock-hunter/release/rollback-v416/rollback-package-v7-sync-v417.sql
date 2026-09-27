-- Stock Hunter 4.1.7 release-control rollback identity refresh.
-- Security-only recovery metadata update: preserve the exact live 4.1.6 Champion
-- capture v7/HMAC+nonce component in any future final-release rollback archive.
-- Does not create a release manifest, authorize/freeze a release, or change runtime traffic.

create or replace function private.freeze_stock_hunter_release_v417(
  p_expected_state_version bigint,
  p_release_id bigint,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog'
as $$
declare
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_policy public.stock_hunter_release_pin_policy_v417%rowtype;
  v_ready public.stock_hunter_release_pin_readiness_v417%rowtype;
  v_manifest private.stock_hunter_release_pin_manifests_v417%rowtype;
  v_auth private.stock_hunter_release_freeze_authorizations_v417%rowtype;
  v_expected_manifest_fp text;
  v_rollback jsonb;
  v_archive_fp text;
  v_archive_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,5);
  perform pg_catalog.pg_advisory_xact_lock(417,6);

  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'release freeze note is required';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default'
  for update;

  if v_status.state_version<>p_expected_state_version then
    raise exception 'activation state version mismatch';
  end if;

  select * into strict v_policy
  from public.stock_hunter_release_pin_policy_v417
  where policy_id='default';

  select * into strict v_ready
  from public.stock_hunter_release_pin_readiness_v417;

  if not coalesce(v_ready.ready_for_manual_release_freeze,false) then
    raise exception 'release freeze gate recheck blocked freeze: %',
      coalesce(v_ready.release_pin_reason,'UNKNOWN');
  end if;

  if v_ready.release_id is distinct from p_release_id
     or v_ready.state_version is distinct from v_status.state_version
     or v_ready.activation_review_id is distinct from v_status.activation_review_id
     or not coalesce(v_ready.pass_component_attestation,false)
     or v_ready.component_attestation_id is null
     or nullif(v_ready.component_attestation_fingerprint,'') is null then
    raise exception 'release freeze readiness is stale or not bound to current state/attestation';
  end if;

  select * into strict v_manifest
  from private.stock_hunter_release_pin_manifests_v417
  where release_id=p_release_id
  for update;

  if v_manifest.release_status<>'PREPARED'
     or v_manifest.release_version<>v_policy.target_release_version
     or v_manifest.previous_stable_version<>v_policy.previous_stable_version
     or v_manifest.state_version<>v_status.state_version
     or v_manifest.activation_review_id is distinct from v_status.activation_review_id
     or v_manifest.capture_deployment_sha256 !~ '^[0-9a-f]{64}$'
     or v_manifest.component_attestation_id is null then
    raise exception 'prepared release manifest is stale or invalid';
  end if;

  v_expected_manifest_fp:=pg_catalog.md5(
    v_manifest.release_version||'|'||
    v_manifest.previous_stable_version||'|'||
    v_manifest.activation_review_id::text||'|'||
    v_manifest.state_version::text||'|'||
    v_manifest.proposal_id::text||'|'||
    v_manifest.dataset_fingerprint||'|'||
    v_manifest.git_commit_sha||'|'||
    v_manifest.engine_asset_version||'|'||
    v_manifest.dashboard_version||'|'||
    v_manifest.service_worker_cache_version||'|'||
    v_manifest.capture_function_slug||'|'||
    v_manifest.capture_deployment_version::text||'|'||
    v_manifest.capture_deployment_sha256||'|'||
    v_manifest.capture_release_tag||'|'||
    v_manifest.audit_release_tag||'|'||
    v_manifest.component_attestation_id::text
  );

  if v_expected_manifest_fp<>v_manifest.manifest_fingerprint then
    raise exception 'release manifest fingerprint mismatch';
  end if;

  select * into v_auth
  from private.stock_hunter_release_freeze_authorizations_v417
  where release_id=p_release_id
    and state_version=v_status.state_version
    and decision='APPROVE_RELEASE_FREEZE'
    and consumed_at is null
  order by freeze_authorization_id desc
  limit 1
  for update;

  if v_auth.freeze_authorization_id is null then
    raise exception 'separate one-time release-freeze authorization is required';
  end if;

  if coalesce((v_auth.readiness_snapshot->>'ready_for_manual_release_freeze')::boolean,false) is not true
     or coalesce((v_auth.readiness_snapshot->>'pass_component_attestation')::boolean,false) is not true
     or nullif(v_auth.readiness_snapshot->>'release_id','')::bigint is distinct from p_release_id
     or nullif(v_auth.readiness_snapshot->>'state_version','')::bigint is distinct from v_status.state_version
     or nullif(v_auth.readiness_snapshot->>'activation_review_id','')::bigint is distinct from v_status.activation_review_id
     or nullif(v_auth.readiness_snapshot->>'component_attestation_id','')::bigint is distinct from v_ready.component_attestation_id
     or v_auth.readiness_snapshot->>'component_attestation_fingerprint' is distinct from v_ready.component_attestation_fingerprint then
    raise exception 'release-freeze authorization snapshot is stale or not bound to current state/attestation';
  end if;

  if v_policy.previous_stable_version<>'4.1.6'
     or v_status.champion_engine_version<>'4.1.6-hunt-v2' then
    raise exception '4.1.6 rollback target is not preserved at final freeze';
  end if;

  v_rollback:=pg_catalog.jsonb_build_object(
    'release_version','4.1.6',
    'engine_version','4.1.6-hunt-v2',
    'dashboard_version','4.1.6',
    'service_worker_cache_version','shikar-sahm-v4.1.6-r12',
    'capture_function_slug','stock-hunter-capture-v416',
    'capture_deployment_version',7,
    'capture_deployment_sha256','49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740',
    'capture_verify_jwt',false,
    'capture_auth_contract','VAULT_HMAC_NONCE_V2',
    'preservation_mode','ARCHIVED_ROLLBACK_PACKAGE'
  );

  v_archive_fp:=pg_catalog.md5(
    p_release_id::text||'|'||
    v_policy.previous_stable_version||'|'||
    v_status.champion_engine_version||'|'||
    pg_catalog.to_jsonb(v_status)::text||'|'||
    v_rollback::text
  );

  insert into private.stock_hunter_previous_stable_archive_v417(
    release_id,previous_stable_version,previous_engine_version,
    previous_status_snapshot,rollback_package_snapshot,archive_fingerprint
  ) values (
    p_release_id,v_policy.previous_stable_version,v_status.champion_engine_version,
    pg_catalog.to_jsonb(v_status),v_rollback,v_archive_fp
  )
  returning archive_id into v_archive_id;

  update private.stock_hunter_release_pin_manifests_v417
  set release_status='FROZEN',
      frozen_at=pg_catalog.now()
  where release_id=p_release_id;

  update private.stock_hunter_release_freeze_authorizations_v417
  set consumed_at=pg_catalog.now()
  where freeze_authorization_id=v_auth.freeze_authorization_id;

  return pg_catalog.jsonb_build_object(
    'release_id',p_release_id,
    'release_version',v_manifest.release_version,
    'release_status','FROZEN',
    'freeze_authorization_id',v_auth.freeze_authorization_id,
    'component_attestation_id',v_ready.component_attestation_id,
    'component_attestation_fingerprint',v_ready.component_attestation_fingerprint,
    'archive_id',v_archive_id,
    'previous_stable_version',v_policy.previous_stable_version,
    'previous_engine_version',v_status.champion_engine_version,
    'rollback_package_fingerprint',v_archive_fp,
    'runtime_state_changed',false
  );
end;
$$;

revoke all on function private.freeze_stock_hunter_release_v417(bigint,bigint,text)
  from public,anon,authenticated,service_role;
grant execute on function private.freeze_stock_hunter_release_v417(bigint,bigint,text)
  to postgres;

-- No invocation is performed by this migration.
