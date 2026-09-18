-- Stock Hunter 4.1.7 Final Release Promotion / Pinning hardening.
-- This migration completes the manual PREPARED -> FROZEN release contract.
-- It does NOT create a release manifest, authorize a freeze, freeze 4.1.7,
-- change runtime traffic, or retire the 4.1.6 rollback package.

alter table public.stock_hunter_release_pin_policy_v417
  drop constraint if exists stock_hunter_release_pin_policy_v417_frozen_contract;

alter table public.stock_hunter_release_pin_policy_v417
  add constraint stock_hunter_release_pin_policy_v417_frozen_contract check (
    policy_id='default'
    and protocol_version='4.1.7-release-pin-v1'
    and target_release_version='4.1.7'
    and previous_stable_version='4.1.6'
    and required_capture_function_slug='stock-hunter-capture-v417'
    and auto_freeze=false
  );

create or replace function private.reject_stock_hunter_release_pin_policy_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'stock hunter release-pin policy is frozen; change only through a reviewed migration';
end;
$$;

revoke all on function private.reject_stock_hunter_release_pin_policy_mutation_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.reject_stock_hunter_release_pin_policy_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_release_pin_policy_immutable_v417
on public.stock_hunter_release_pin_policy_v417;

create trigger stock_hunter_release_pin_policy_immutable_v417
before insert or update or delete or truncate
on public.stock_hunter_release_pin_policy_v417
for each statement
execute function private.reject_stock_hunter_release_pin_policy_mutation_v417();

revoke all on public.stock_hunter_release_pin_policy_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_release_pin_policy_v417
  to anon,authenticated,service_role;

-- Exact capture content hash is part of the final 4.1.7 component pin.
alter table private.stock_hunter_release_pin_manifests_v417
  add column if not exists capture_deployment_sha256 text;

alter table private.stock_hunter_release_pin_manifests_v417
  drop constraint if exists stock_hunter_release_pin_capture_sha256_check;

alter table private.stock_hunter_release_pin_manifests_v417
  add constraint stock_hunter_release_pin_capture_sha256_check
  check (capture_deployment_sha256 ~ '^[0-9a-f]{64}$');

-- Empty before first real release; require the capture hash for every future manifest.
alter table private.stock_hunter_release_pin_manifests_v417
  alter column capture_deployment_sha256 set not null;

-- Archive the actual rollback-package identity alongside the previous status snapshot.
alter table private.stock_hunter_previous_stable_archive_v417
  add column if not exists rollback_package_snapshot jsonb;

alter table private.stock_hunter_previous_stable_archive_v417
  add column if not exists archive_fingerprint text;

alter table private.stock_hunter_previous_stable_archive_v417
  alter column rollback_package_snapshot set not null;

alter table private.stock_hunter_previous_stable_archive_v417
  alter column archive_fingerprint set not null;

create unique index if not exists stock_hunter_previous_stable_archive_fingerprint_v417
on private.stock_hunter_previous_stable_archive_v417(archive_fingerprint);

create or replace function private.guard_stock_hunter_release_manifest_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' then
    if row(
      old.release_id,old.release_version,old.previous_stable_version,
      old.activation_review_id,old.state_version,old.proposal_id,old.dataset_fingerprint,
      old.git_commit_sha,old.engine_asset_version,old.dashboard_version,
      old.service_worker_cache_version,old.capture_function_slug,
      old.capture_deployment_version,old.capture_deployment_sha256,
      old.capture_release_tag,old.audit_release_tag,old.post_activation_snapshot,
      old.manifest_fingerprint,old.release_note,old.prepared_at
    ) is distinct from row(
      new.release_id,new.release_version,new.previous_stable_version,
      new.activation_review_id,new.state_version,new.proposal_id,new.dataset_fingerprint,
      new.git_commit_sha,new.engine_asset_version,new.dashboard_version,
      new.service_worker_cache_version,new.capture_function_slug,
      new.capture_deployment_version,new.capture_deployment_sha256,
      new.capture_release_tag,new.audit_release_tag,new.post_activation_snapshot,
      new.manifest_fingerprint,new.release_note,new.prepared_at
    ) then
      raise exception 'release manifest identity fields are immutable';
    end if;

    if old.release_status='PREPARED'
       and new.release_status='FROZEN'
       and old.frozen_at is null
       and new.frozen_at is not null then
      return new;
    end if;

    raise exception 'release manifest permits only PREPARED to FROZEN transition';
  end if;

  raise exception 'release manifest rows are immutable';
end;
$$;

revoke all on function private.guard_stock_hunter_release_manifest_mutation_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_release_manifest_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_release_manifest_immutable_v417
on private.stock_hunter_release_pin_manifests_v417;
create trigger stock_hunter_release_manifest_immutable_v417
before update or delete
on private.stock_hunter_release_pin_manifests_v417
for each row execute function private.guard_stock_hunter_release_manifest_mutation_v417();

drop trigger if exists stock_hunter_release_manifest_truncate_v417
on private.stock_hunter_release_pin_manifests_v417;
create trigger stock_hunter_release_manifest_truncate_v417
before truncate
on private.stock_hunter_release_pin_manifests_v417
for each statement execute function private.guard_stock_hunter_release_manifest_mutation_v417();

create or replace function private.guard_stock_hunter_release_freeze_authorization_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' then
    if row(
      old.freeze_authorization_id,old.release_id,old.state_version,old.decision,
      old.authorization_note,old.readiness_snapshot,old.authorization_fingerprint,old.created_at
    ) is distinct from row(
      new.freeze_authorization_id,new.release_id,new.state_version,new.decision,
      new.authorization_note,new.readiness_snapshot,new.authorization_fingerprint,new.created_at
    ) then
      raise exception 'release-freeze authorization audit fields are immutable';
    end if;

    if old.consumed_at is null and new.consumed_at is not null then
      return new;
    end if;

    raise exception 'release-freeze authorization may only be consumed once';
  end if;

  raise exception 'release-freeze authorization rows are immutable';
end;
$$;

revoke all on function private.guard_stock_hunter_release_freeze_authorization_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_release_freeze_authorization_v417()
  to postgres;

drop trigger if exists stock_hunter_release_freeze_authorization_immutable_v417
on private.stock_hunter_release_freeze_authorizations_v417;
create trigger stock_hunter_release_freeze_authorization_immutable_v417
before update or delete
on private.stock_hunter_release_freeze_authorizations_v417
for each row execute function private.guard_stock_hunter_release_freeze_authorization_v417();

drop trigger if exists stock_hunter_release_freeze_authorization_truncate_v417
on private.stock_hunter_release_freeze_authorizations_v417;
create trigger stock_hunter_release_freeze_authorization_truncate_v417
before truncate
on private.stock_hunter_release_freeze_authorizations_v417
for each statement execute function private.guard_stock_hunter_release_freeze_authorization_v417();

create or replace function private.reject_stock_hunter_previous_stable_archive_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'previous stable rollback archive is immutable';
end;
$$;

revoke all on function private.reject_stock_hunter_previous_stable_archive_mutation_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.reject_stock_hunter_previous_stable_archive_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_previous_stable_archive_immutable_v417
on private.stock_hunter_previous_stable_archive_v417;
create trigger stock_hunter_previous_stable_archive_immutable_v417
before update or delete
on private.stock_hunter_previous_stable_archive_v417
for each row execute function private.reject_stock_hunter_previous_stable_archive_mutation_v417();

drop trigger if exists stock_hunter_previous_stable_archive_truncate_v417
on private.stock_hunter_previous_stable_archive_v417;
create trigger stock_hunter_previous_stable_archive_truncate_v417
before truncate
on private.stock_hunter_previous_stable_archive_v417
for each statement execute function private.reject_stock_hunter_previous_stable_archive_mutation_v417();

-- Disable the legacy prepare signature: exact capture content hash is now mandatory.
create or replace function private.prepare_stock_hunter_release_pin_v417(
  p_expected_state_version bigint,
  p_git_commit_sha text,
  p_engine_asset_version text,
  p_dashboard_version text,
  p_service_worker_cache_version text,
  p_capture_function_slug text,
  p_capture_deployment_version integer,
  p_capture_release_tag text,
  p_audit_release_tag text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  raise exception 'capture deployment sha256 is required; use hardened release-pin prepare signature';
end;
$$;

revoke all on function private.prepare_stock_hunter_release_pin_v417(
  bigint,text,text,text,text,text,integer,text,text,text
) from public,anon,authenticated,service_role;
grant execute on function private.prepare_stock_hunter_release_pin_v417(
  bigint,text,text,text,text,text,integer,text,text,text
) to postgres;

create or replace function private.prepare_stock_hunter_release_pin_v417(
  p_expected_state_version bigint,
  p_git_commit_sha text,
  p_engine_asset_version text,
  p_dashboard_version text,
  p_service_worker_cache_version text,
  p_capture_function_slug text,
  p_capture_deployment_version integer,
  p_capture_deployment_sha256 text,
  p_capture_release_tag text,
  p_audit_release_tag text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_policy public.stock_hunter_release_pin_policy_v417%rowtype;
  v_post public.stock_hunter_post_activation_monitor_v417%rowtype;
  v_proposal_id bigint;
  v_dataset text;
  v_id bigint;
  v_fp text;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,5);

  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'release pin note is required';
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

  if v_policy.target_release_version<>'4.1.7'
     or v_policy.previous_stable_version<>'4.1.6'
     or v_policy.required_capture_function_slug<>'stock-hunter-capture-v417'
     or v_policy.auto_freeze then
    raise exception 'frozen release-pin policy mismatch';
  end if;

  select * into strict v_post
  from public.stock_hunter_post_activation_monitor_v417;

  if not coalesce(v_post.stabilization_ready_for_version_promotion,false) then
    raise exception 'post-activation stabilization blocked release preparation: %',
      coalesce(v_post.stabilization_reason,'UNKNOWN');
  end if;

  if p_git_commit_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'git commit sha must be a full 40-character lowercase hex sha';
  end if;

  if p_engine_asset_version<>v_policy.target_release_version
     or p_dashboard_version<>v_policy.target_release_version
     or p_capture_release_tag<>v_policy.target_release_version
     or p_audit_release_tag<>v_policy.target_release_version then
    raise exception 'all release component tags must equal target release %',
      v_policy.target_release_version;
  end if;

  if p_service_worker_cache_version not like 'shikar-sahm-v4.1.7-%' then
    raise exception 'service worker cache must be pinned to 4.1.7';
  end if;

  if p_capture_function_slug<>v_policy.required_capture_function_slug then
    raise exception 'capture backend must use the frozen v417 function slug';
  end if;

  if coalesce(p_capture_deployment_version,0)<1 then
    raise exception 'capture deployment version is required';
  end if;

  if p_capture_deployment_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'capture deployment sha256 must be a lowercase 64-character hex digest';
  end if;

  select r.proposal_id,p.dataset_fingerprint
  into strict v_proposal_id,v_dataset
  from public.stock_hunter_activation_reviews_v417 r
  join public.stock_hunter_promotion_proposals_v416 p
    on p.proposal_id=r.proposal_id
  where r.review_id=v_status.activation_review_id;

  v_fp:=pg_catalog.md5(
    v_policy.target_release_version||'|'||
    v_policy.previous_stable_version||'|'||
    v_status.activation_review_id::text||'|'||
    v_status.state_version::text||'|'||
    v_proposal_id::text||'|'||
    v_dataset||'|'||
    p_git_commit_sha||'|'||
    p_engine_asset_version||'|'||
    p_dashboard_version||'|'||
    p_service_worker_cache_version||'|'||
    p_capture_function_slug||'|'||
    p_capture_deployment_version::text||'|'||
    p_capture_deployment_sha256||'|'||
    p_capture_release_tag||'|'||
    p_audit_release_tag
  );

  insert into private.stock_hunter_release_pin_manifests_v417(
    release_version,previous_stable_version,activation_review_id,state_version,
    proposal_id,dataset_fingerprint,git_commit_sha,engine_asset_version,
    dashboard_version,service_worker_cache_version,capture_function_slug,
    capture_deployment_version,capture_deployment_sha256,capture_release_tag,
    audit_release_tag,post_activation_snapshot,manifest_fingerprint,release_note
  ) values (
    v_policy.target_release_version,v_policy.previous_stable_version,
    v_status.activation_review_id,v_status.state_version,v_proposal_id,v_dataset,
    p_git_commit_sha,p_engine_asset_version,p_dashboard_version,
    p_service_worker_cache_version,p_capture_function_slug,
    p_capture_deployment_version,p_capture_deployment_sha256,
    p_capture_release_tag,p_audit_release_tag,pg_catalog.to_jsonb(v_post),
    v_fp,pg_catalog.btrim(p_note)
  )
  returning release_id into v_id;

  return pg_catalog.jsonb_build_object(
    'release_id',v_id,
    'release_version',v_policy.target_release_version,
    'manifest_fingerprint',v_fp,
    'capture_deployment_sha256',p_capture_deployment_sha256,
    'status','PREPARED'
  );
end;
$$;

revoke all on function private.prepare_stock_hunter_release_pin_v417(
  bigint,text,text,text,text,text,integer,text,text,text,text
) from public,anon,authenticated,service_role;
grant execute on function private.prepare_stock_hunter_release_pin_v417(
  bigint,text,text,text,text,text,integer,text,text,text,text
) to postgres;

create or replace function private.authorize_stock_hunter_release_freeze_v417(
  p_expected_state_version bigint,
  p_release_id bigint,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_ready public.stock_hunter_release_pin_readiness_v417%rowtype;
  v_manifest private.stock_hunter_release_pin_manifests_v417%rowtype;
  v_id bigint;
  v_fp text;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,5);

  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'release freeze authorization note is required';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default'
  for update;

  if v_status.state_version<>p_expected_state_version then
    raise exception 'activation state version mismatch';
  end if;

  select * into strict v_ready
  from public.stock_hunter_release_pin_readiness_v417;

  if not coalesce(v_ready.ready_for_manual_release_freeze,false) then
    raise exception 'release freeze gate blocked authorization: %',
      coalesce(v_ready.release_pin_reason,'UNKNOWN');
  end if;

  if v_ready.release_id is distinct from p_release_id
     or v_ready.state_version is distinct from v_status.state_version
     or v_ready.activation_review_id is distinct from v_status.activation_review_id then
    raise exception 'release freeze readiness is not bound to current release/state';
  end if;

  select * into strict v_manifest
  from private.stock_hunter_release_pin_manifests_v417
  where release_id=p_release_id
  for update;

  if v_manifest.release_status<>'PREPARED'
     or v_manifest.state_version<>v_status.state_version
     or v_manifest.activation_review_id is distinct from v_status.activation_review_id
     or v_manifest.capture_deployment_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'release manifest is not a valid current prepared manifest';
  end if;

  v_fp:=pg_catalog.md5(
    p_release_id::text||'|'||
    v_status.state_version::text||'|'||
    v_manifest.manifest_fingerprint||'|'||
    pg_catalog.to_jsonb(v_ready)::text||'|'||
    pg_catalog.btrim(p_note)||'|APPROVE_RELEASE_FREEZE'
  );

  insert into private.stock_hunter_release_freeze_authorizations_v417(
    release_id,state_version,decision,authorization_note,
    readiness_snapshot,authorization_fingerprint
  ) values (
    p_release_id,v_status.state_version,'APPROVE_RELEASE_FREEZE',
    pg_catalog.btrim(p_note),pg_catalog.to_jsonb(v_ready),v_fp
  )
  returning freeze_authorization_id into v_id;

  return pg_catalog.jsonb_build_object(
    'freeze_authorization_id',v_id,
    'release_id',p_release_id,
    'state_version',v_status.state_version,
    'decision','APPROVE_RELEASE_FREEZE'
  );
end;
$$;

revoke all on function private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)
  from public,anon,authenticated,service_role;
grant execute on function private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)
  to postgres;

create or replace function private.freeze_stock_hunter_release_v417(
  p_expected_state_version bigint,
  p_release_id bigint,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
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
     or v_ready.activation_review_id is distinct from v_status.activation_review_id then
    raise exception 'release freeze readiness is stale or not bound to current state';
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
     or v_manifest.capture_deployment_sha256 !~ '^[0-9a-f]{64}$' then
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
    v_manifest.audit_release_tag
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
     or nullif(v_auth.readiness_snapshot->>'release_id','')::bigint is distinct from p_release_id
     or nullif(v_auth.readiness_snapshot->>'state_version','')::bigint is distinct from v_status.state_version
     or nullif(v_auth.readiness_snapshot->>'activation_review_id','')::bigint is distinct from v_status.activation_review_id then
    raise exception 'release-freeze authorization snapshot is stale or not bound to current state';
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
    'capture_deployment_version',5,
    'capture_deployment_sha256','6eb0ba0ee5e9dae3b8d6bab5c79f7f48a98ae643fd35ebe968d8d41eb73fdc76',
    'capture_verify_jwt',false,
    'capture_auth_contract','VAULT_SECRET_SERVICE_ROLE_ONLY',
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
