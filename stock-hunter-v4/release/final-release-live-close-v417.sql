-- Stock Hunter 4.1.7 final release / component pin live closure.
-- Adds externally verified component attestation as a mandatory manual gate.
-- No manifest, attestation, authorization, freeze, runtime mutation, or rollback archive is created here.

alter table public.stock_hunter_release_pin_policy_v417
  add column if not exists max_component_attestation_age_minutes integer not null default 60;

alter table public.stock_hunter_release_pin_policy_v417
  drop constraint if exists stock_hunter_release_pin_policy_v417_frozen_contract;

alter table public.stock_hunter_release_pin_policy_v417
  add constraint stock_hunter_release_pin_policy_v417_frozen_contract check (
    policy_id='default'
    and protocol_version='4.1.7-release-pin-v1'
    and target_release_version='4.1.7'
    and previous_stable_version='4.1.6'
    and required_capture_function_slug='stock-hunter-capture-v417'
    and max_component_attestation_age_minutes=60
    and auto_freeze=false
  );

create table if not exists private.stock_hunter_release_component_attestations_v417 (
  attestation_id bigint generated always as identity primary key,
  target_release_version text not null,
  source_repo_full_name text not null,
  git_commit_sha text not null,
  engine_asset_version text not null,
  dashboard_version text not null,
  service_worker_cache_version text not null,
  supabase_project_id text not null,
  capture_function_id uuid not null,
  capture_function_slug text not null,
  capture_deployment_version integer not null,
  capture_deployment_sha256 text not null,
  capture_status text not null,
  capture_verify_jwt boolean not null,
  evidence_source text not null,
  evidence_snapshot jsonb not null,
  evidence_observed_at timestamptz not null,
  attestation_note text not null,
  attestation_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint stock_hunter_release_component_attestation_contract check (
    target_release_version='4.1.7'
    and source_repo_full_name='afzalpour/afzalpour.github.io'
    and git_commit_sha ~ '^[0-9a-f]{40}$'
    and engine_asset_version='4.1.7'
    and dashboard_version='4.1.7'
    and service_worker_cache_version like 'shikar-sahm-v4.1.7-%'
    and supabase_project_id='summnepwuziwulzvpcms'
    and capture_function_slug='stock-hunter-capture-v417'
    and capture_deployment_version>=1
    and capture_deployment_sha256 ~ '^[0-9a-f]{64}$'
    and capture_status='ACTIVE'
    and evidence_source='GITHUB_API+SUPABASE_MANAGEMENT_API'
    and jsonb_typeof(evidence_snapshot)='object'
    and nullif(btrim(attestation_note),'') is not null
  )
);

revoke all on private.stock_hunter_release_component_attestations_v417
  from public,anon,authenticated,service_role;

create or replace function private.reject_stock_hunter_release_component_attestation_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'release component attestations are immutable';
end;
$$;

revoke all on function private.reject_stock_hunter_release_component_attestation_mutation_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.reject_stock_hunter_release_component_attestation_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_release_component_attestation_immutable_v417
on private.stock_hunter_release_component_attestations_v417;

create trigger stock_hunter_release_component_attestation_immutable_v417
before update or delete
on private.stock_hunter_release_component_attestations_v417
for each row
execute function private.reject_stock_hunter_release_component_attestation_mutation_v417();

drop trigger if exists stock_hunter_release_component_attestation_truncate_v417
on private.stock_hunter_release_component_attestations_v417;

create trigger stock_hunter_release_component_attestation_truncate_v417
before truncate
on private.stock_hunter_release_component_attestations_v417
for each statement
execute function private.reject_stock_hunter_release_component_attestation_mutation_v417();

create or replace function private.record_stock_hunter_release_component_attestation_v417(
  p_git_commit_sha text,
  p_engine_asset_version text,
  p_dashboard_version text,
  p_service_worker_cache_version text,
  p_capture_function_id uuid,
  p_capture_deployment_version integer,
  p_capture_deployment_sha256 text,
  p_capture_verify_jwt boolean,
  p_evidence_observed_at timestamptz,
  p_evidence_snapshot jsonb,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog'
as $$
declare
  v_id bigint;
  v_fp text;
  v_now timestamptz:=pg_catalog.now();
begin
  perform pg_catalog.pg_advisory_xact_lock(417,6);

  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'component attestation note is required';
  end if;
  if p_git_commit_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'component attestation git sha is invalid';
  end if;
  if p_engine_asset_version<>'4.1.7' or p_dashboard_version<>'4.1.7' then
    raise exception 'component attestation engine/dashboard must be 4.1.7';
  end if;
  if p_service_worker_cache_version not like 'shikar-sahm-v4.1.7-%' then
    raise exception 'component attestation service worker cache must be 4.1.7';
  end if;
  if coalesce(p_capture_deployment_version,0)<1
     or p_capture_deployment_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'component attestation capture deployment identity is invalid';
  end if;
  if p_evidence_observed_at is null
     or p_evidence_observed_at < v_now-pg_catalog.make_interval(mins=>15)
     or p_evidence_observed_at > v_now+pg_catalog.make_interval(mins=>1) then
    raise exception 'component attestation evidence must be freshly observed';
  end if;
  if pg_catalog.jsonb_typeof(p_evidence_snapshot)<>'object' then
    raise exception 'component attestation evidence snapshot must be a JSON object';
  end if;

  if p_evidence_snapshot#>>'{github,repository}' <> 'afzalpour/afzalpour.github.io'
     or p_evidence_snapshot#>>'{github,commit_sha}' <> p_git_commit_sha
     or p_evidence_snapshot#>>'{supabase,project_id}' <> 'summnepwuziwulzvpcms'
     or p_evidence_snapshot#>>'{supabase,edge_function,id}' <> p_capture_function_id::text
     or p_evidence_snapshot#>>'{supabase,edge_function,slug}' <> 'stock-hunter-capture-v417'
     or p_evidence_snapshot#>>'{supabase,edge_function,status}' <> 'ACTIVE'
     or nullif(p_evidence_snapshot#>>'{supabase,edge_function,version}','')::integer
          is distinct from p_capture_deployment_version
     or p_evidence_snapshot#>>'{supabase,edge_function,ezbr_sha256}' <> p_capture_deployment_sha256
     or nullif(p_evidence_snapshot#>>'{supabase,edge_function,verify_jwt}','')::boolean
          is distinct from p_capture_verify_jwt then
    raise exception 'component attestation evidence does not match GitHub/Supabase observations';
  end if;

  v_fp:=pg_catalog.md5(
    '4.1.7|afzalpour/afzalpour.github.io|'||
    p_git_commit_sha||'|'||
    p_engine_asset_version||'|'||
    p_dashboard_version||'|'||
    p_service_worker_cache_version||'|'||
    'summnepwuziwulzvpcms|'||
    p_capture_function_id::text||'|'||
    'stock-hunter-capture-v417|'||
    p_capture_deployment_version::text||'|'||
    p_capture_deployment_sha256||'|'||
    p_capture_verify_jwt::text||'|'||
    p_evidence_observed_at::text||'|'||
    p_evidence_snapshot::text
  );

  insert into private.stock_hunter_release_component_attestations_v417(
    target_release_version,source_repo_full_name,git_commit_sha,
    engine_asset_version,dashboard_version,service_worker_cache_version,
    supabase_project_id,capture_function_id,capture_function_slug,
    capture_deployment_version,capture_deployment_sha256,capture_status,
    capture_verify_jwt,evidence_source,evidence_snapshot,evidence_observed_at,
    attestation_note,attestation_fingerprint
  ) values (
    '4.1.7','afzalpour/afzalpour.github.io',p_git_commit_sha,
    p_engine_asset_version,p_dashboard_version,p_service_worker_cache_version,
    'summnepwuziwulzvpcms',p_capture_function_id,'stock-hunter-capture-v417',
    p_capture_deployment_version,p_capture_deployment_sha256,'ACTIVE',
    p_capture_verify_jwt,'GITHUB_API+SUPABASE_MANAGEMENT_API',
    p_evidence_snapshot,p_evidence_observed_at,pg_catalog.btrim(p_note),v_fp
  )
  returning attestation_id into v_id;

  return pg_catalog.jsonb_build_object(
    'attestation_id',v_id,
    'target_release_version','4.1.7',
    'git_commit_sha',p_git_commit_sha,
    'capture_function_slug','stock-hunter-capture-v417',
    'capture_deployment_version',p_capture_deployment_version,
    'capture_deployment_sha256',p_capture_deployment_sha256,
    'attestation_fingerprint',v_fp
  );
end;
$$;

revoke all on function private.record_stock_hunter_release_component_attestation_v417(
  text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text
) from public,anon,authenticated,service_role;
grant execute on function private.record_stock_hunter_release_component_attestation_v417(
  text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text
) to postgres;

alter table private.stock_hunter_release_pin_manifests_v417
  add column if not exists component_attestation_id bigint;

alter table private.stock_hunter_release_pin_manifests_v417
  drop constraint if exists stock_hunter_release_pin_manifests_v417_component_attestation_fkey;

alter table private.stock_hunter_release_pin_manifests_v417
  add constraint stock_hunter_release_pin_manifests_v417_component_attestation_fkey
  foreign key(component_attestation_id)
  references private.stock_hunter_release_component_attestations_v417(attestation_id);

alter table private.stock_hunter_release_pin_manifests_v417
  alter column component_attestation_id set not null;

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
      old.manifest_fingerprint,old.release_note,old.prepared_at,
      old.component_attestation_id
    ) is distinct from row(
      new.release_id,new.release_version,new.previous_stable_version,
      new.activation_review_id,new.state_version,new.proposal_id,new.dataset_fingerprint,
      new.git_commit_sha,new.engine_asset_version,new.dashboard_version,
      new.service_worker_cache_version,new.capture_function_slug,
      new.capture_deployment_version,new.capture_deployment_sha256,
      new.capture_release_tag,new.audit_release_tag,new.post_activation_snapshot,
      new.manifest_fingerprint,new.release_note,new.prepared_at,
      new.component_attestation_id
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
set search_path='pg_catalog'
as $$
declare
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_policy public.stock_hunter_release_pin_policy_v417%rowtype;
  v_post public.stock_hunter_post_activation_monitor_v417%rowtype;
  v_att private.stock_hunter_release_component_attestations_v417%rowtype;
  v_proposal_id bigint;
  v_dataset text;
  v_id bigint;
  v_fp text;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,5);
  perform pg_catalog.pg_advisory_xact_lock(417,6);

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
     or v_policy.max_component_attestation_age_minutes<>60
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

  select * into v_att
  from private.stock_hunter_release_component_attestations_v417 a
  where a.target_release_version=v_policy.target_release_version
    and a.source_repo_full_name='afzalpour/afzalpour.github.io'
    and a.git_commit_sha=p_git_commit_sha
    and a.engine_asset_version=p_engine_asset_version
    and a.dashboard_version=p_dashboard_version
    and a.service_worker_cache_version=p_service_worker_cache_version
    and a.supabase_project_id='summnepwuziwulzvpcms'
    and a.capture_function_slug=p_capture_function_slug
    and a.capture_deployment_version=p_capture_deployment_version
    and a.capture_deployment_sha256=p_capture_deployment_sha256
    and a.capture_status='ACTIVE'
    and a.evidence_source='GITHUB_API+SUPABASE_MANAGEMENT_API'
    and a.evidence_observed_at>=pg_catalog.now()-pg_catalog.make_interval(mins=>v_policy.max_component_attestation_age_minutes)
  order by a.evidence_observed_at desc,a.attestation_id desc
  limit 1;

  if v_att.attestation_id is null then
    raise exception 'fresh externally verified 4.1.7 component attestation is required';
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
    p_audit_release_tag||'|'||
    v_att.attestation_id::text
  );

  insert into private.stock_hunter_release_pin_manifests_v417(
    release_version,previous_stable_version,activation_review_id,state_version,
    proposal_id,dataset_fingerprint,git_commit_sha,engine_asset_version,
    dashboard_version,service_worker_cache_version,capture_function_slug,
    capture_deployment_version,capture_deployment_sha256,capture_release_tag,
    audit_release_tag,post_activation_snapshot,manifest_fingerprint,release_note,
    component_attestation_id
  ) values (
    v_policy.target_release_version,v_policy.previous_stable_version,
    v_status.activation_review_id,v_status.state_version,v_proposal_id,v_dataset,
    p_git_commit_sha,p_engine_asset_version,p_dashboard_version,
    p_service_worker_cache_version,p_capture_function_slug,
    p_capture_deployment_version,p_capture_deployment_sha256,
    p_capture_release_tag,p_audit_release_tag,pg_catalog.to_jsonb(v_post),
    v_fp,pg_catalog.btrim(p_note),v_att.attestation_id
  )
  returning release_id into v_id;

  return pg_catalog.jsonb_build_object(
    'release_id',v_id,
    'release_version',v_policy.target_release_version,
    'manifest_fingerprint',v_fp,
    'component_attestation_id',v_att.attestation_id,
    'component_attestation_fingerprint',v_att.attestation_fingerprint,
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

create or replace view public.stock_hunter_release_pin_readiness_v417
with (security_invoker=true)
as
with pol as (
  select * from public.stock_hunter_release_pin_policy_v417 where policy_id='default'
),
s as (
  select * from public.stock_hunter_activation_status_v417 where status_id='default'
),
post as (
  select * from public.stock_hunter_post_activation_monitor_v417
),
m as (
  select *
  from private.stock_hunter_release_pin_manifests_v417
  order by release_id desc
  limit 1
),
att_any as (
  select a.*
  from private.stock_hunter_release_component_attestations_v417 a
  cross join pol
  where a.target_release_version=pol.target_release_version
  order by a.evidence_observed_at desc,a.attestation_id desc
  limit 1
),
att_match as (
  select a.*
  from private.stock_hunter_release_component_attestations_v417 a
  cross join pol
  cross join m
  where a.target_release_version=m.release_version
    and a.source_repo_full_name='afzalpour/afzalpour.github.io'
    and a.git_commit_sha=m.git_commit_sha
    and a.engine_asset_version=m.engine_asset_version
    and a.dashboard_version=m.dashboard_version
    and a.service_worker_cache_version=m.service_worker_cache_version
    and a.supabase_project_id='summnepwuziwulzvpcms'
    and a.capture_function_slug=m.capture_function_slug
    and a.capture_deployment_version=m.capture_deployment_version
    and a.capture_deployment_sha256=m.capture_deployment_sha256
    and a.capture_status='ACTIVE'
    and a.evidence_source='GITHUB_API+SUPABASE_MANAGEMENT_API'
  order by a.evidence_observed_at desc,a.attestation_id desc
  limit 1
)
select
  pol.protocol_version,
  pol.target_release_version,
  pol.previous_stable_version,
  pol.required_capture_function_slug,
  pol.auto_freeze,
  s.activation_review_id,
  s.state_version,
  s.routing_mode,
  s.champion_engine_version,
  s.challenger_engine_version,
  post.stabilization_ready_for_version_promotion,
  post.stabilization_reason,
  m.release_id,
  m.release_status,
  m.git_commit_sha,
  m.engine_asset_version,
  m.dashboard_version,
  m.service_worker_cache_version,
  m.capture_function_slug,
  m.capture_deployment_version,
  m.capture_release_tag,
  m.audit_release_tag,
  m.dataset_fingerprint,
  m.manifest_fingerprint,
  m.release_id is not null as pass_manifest_exists,
  m.release_version=pol.target_release_version
    and m.previous_stable_version=pol.previous_stable_version as pass_release_identity,
  m.activation_review_id=s.activation_review_id
    and m.state_version=s.state_version as pass_state_binding,
  m.engine_asset_version=pol.target_release_version
    and m.dashboard_version=pol.target_release_version
    and m.capture_release_tag=pol.target_release_version
    and m.audit_release_tag=pol.target_release_version
    and att_match.engine_asset_version=m.engine_asset_version
    and att_match.dashboard_version=m.dashboard_version as pass_component_tags,
  m.service_worker_cache_version like 'shikar-sahm-v4.1.7-%'
    and att_match.service_worker_cache_version=m.service_worker_cache_version as pass_service_worker_pin,
  m.capture_function_slug=pol.required_capture_function_slug
    and m.capture_deployment_version>=1
    and m.capture_deployment_sha256 ~ '^[0-9a-f]{64}$'
    and att_match.capture_function_slug=m.capture_function_slug
    and att_match.capture_deployment_version=m.capture_deployment_version
    and att_match.capture_deployment_sha256=m.capture_deployment_sha256
    and att_match.capture_status='ACTIVE' as pass_capture_pin,
  m.git_commit_sha ~ '^[0-9a-f]{40}$'
    and att_match.git_commit_sha=m.git_commit_sha as pass_git_commit_pin,
  (
    post.stabilization_ready_for_version_promotion
    and m.release_status='PREPARED'
    and m.release_version=pol.target_release_version
    and m.previous_stable_version=pol.previous_stable_version
    and m.activation_review_id=s.activation_review_id
    and m.state_version=s.state_version
    and m.engine_asset_version=pol.target_release_version
    and m.dashboard_version=pol.target_release_version
    and m.service_worker_cache_version like 'shikar-sahm-v4.1.7-%'
    and m.capture_function_slug=pol.required_capture_function_slug
    and m.capture_deployment_version>=1
    and m.capture_deployment_sha256 ~ '^[0-9a-f]{64}$'
    and m.capture_release_tag=pol.target_release_version
    and m.audit_release_tag=pol.target_release_version
    and m.git_commit_sha ~ '^[0-9a-f]{40}$'
    and att_match.attestation_id is not null
    and att_match.evidence_observed_at>=pg_catalog.now()-pg_catalog.make_interval(mins=>pol.max_component_attestation_age_minutes)
    and not pol.auto_freeze
  ) as ready_for_manual_release_freeze,
  case
    when not post.stabilization_ready_for_version_promotion
      then 'POST_ACTIVATION_NOT_STABLE'
    when m.release_id is null
      then 'RELEASE_MANIFEST_NOT_PREPARED'
    when m.release_status<>'PREPARED'
      then 'RELEASE_MANIFEST_NOT_IN_PREPARED_STATE'
    when m.release_version<>pol.target_release_version
      or m.previous_stable_version<>pol.previous_stable_version
      then 'RELEASE_IDENTITY_MISMATCH'
    when m.activation_review_id is distinct from s.activation_review_id
      or m.state_version is distinct from s.state_version
      then 'RELEASE_MANIFEST_STATE_MISMATCH'
    when att_any.attestation_id is null
      then 'RELEASE_COMPONENT_ATTESTATION_MISSING'
    when att_match.attestation_id is null
      then 'RELEASE_COMPONENT_ATTESTATION_MISMATCH'
    when att_match.evidence_observed_at<pg_catalog.now()-pg_catalog.make_interval(mins=>pol.max_component_attestation_age_minutes)
      then 'RELEASE_COMPONENT_ATTESTATION_STALE'
    when m.engine_asset_version<>pol.target_release_version
      or m.dashboard_version<>pol.target_release_version
      or m.capture_release_tag<>pol.target_release_version
      or m.audit_release_tag<>pol.target_release_version
      then 'RELEASE_COMPONENT_TAG_MISMATCH'
    when m.service_worker_cache_version not like 'shikar-sahm-v4.1.7-%'
      then 'SERVICE_WORKER_NOT_PINNED_TO_417'
    when m.capture_function_slug<>pol.required_capture_function_slug
      or m.capture_deployment_version<1
      or m.capture_deployment_sha256 !~ '^[0-9a-f]{64}$'
      then 'CAPTURE_BACKEND_NOT_PINNED_TO_417'
    when m.git_commit_sha !~ '^[0-9a-f]{40}$'
      then 'GIT_COMMIT_NOT_PINNED'
    when pol.auto_freeze
      then 'AUTO_FREEZE_MUST_REMAIN_OFF'
    else 'READY_FOR_MANUAL_RELEASE_FREEZE'
  end as release_pin_reason,
  att_match.attestation_id as component_attestation_id,
  att_match.attestation_fingerprint as component_attestation_fingerprint,
  att_match.evidence_observed_at as component_attestation_observed_at,
  (
    att_match.attestation_id is not null
    and att_match.evidence_observed_at>=pg_catalog.now()-pg_catalog.make_interval(mins=>pol.max_component_attestation_age_minutes)
  ) as pass_component_attestation
from pol
cross join s
cross join post
left join m on true
left join att_any on true
left join att_match on true;

-- This internal readiness view depends on private audit tables. Keep it postgres-only
-- rather than exposing a non-functional security_invoker grant to service_role.
revoke all on public.stock_hunter_release_pin_readiness_v417
  from public,anon,authenticated,service_role;

create or replace function private.authorize_stock_hunter_release_freeze_v417(
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
  v_ready public.stock_hunter_release_pin_readiness_v417%rowtype;
  v_manifest private.stock_hunter_release_pin_manifests_v417%rowtype;
  v_id bigint;
  v_fp text;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,5);
  perform pg_catalog.pg_advisory_xact_lock(417,6);

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
     or v_ready.activation_review_id is distinct from v_status.activation_review_id
     or not coalesce(v_ready.pass_component_attestation,false)
     or v_ready.component_attestation_id is null
     or nullif(v_ready.component_attestation_fingerprint,'') is null then
    raise exception 'release freeze readiness is not bound to current release/state/attestation';
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
    v_ready.component_attestation_id::text||'|'||
    v_ready.component_attestation_fingerprint||'|'||
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
    'component_attestation_id',v_ready.component_attestation_id,
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
