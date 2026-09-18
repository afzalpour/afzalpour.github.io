-- Stock Hunter 4.1.7 final release live-close verifier.
-- No release action is performed.
-- Expected final row: stock-hunter-final-release-live-close-v417: PASS

do $$
declare
  p public.stock_hunter_release_pin_policy_v417%rowtype;
  r public.stock_hunter_release_pin_readiness_v417%rowtype;
  s public.stock_hunter_activation_status_v417%rowtype;
  view_def text;
  record_def text;
  prepare_def text;
  authorize_def text;
  freeze_def text;
  guard_def text;
  legacy_def text;
  v_bad_acl integer;
  v_bad_cron integer;
begin
  select * into strict p
  from public.stock_hunter_release_pin_policy_v417
  where policy_id='default';

  if p.protocol_version<>'4.1.7-release-pin-v1'
     or p.target_release_version<>'4.1.7'
     or p.previous_stable_version<>'4.1.6'
     or p.required_capture_function_slug<>'stock-hunter-capture-v417'
     or p.max_component_attestation_age_minutes<>60
     or p.auto_freeze then
    raise exception 'final release frozen policy mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.stock_hunter_release_pin_policy_v417'::regclass
      and tgname='stock_hunter_release_pin_policy_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'release-pin policy immutability trigger missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.stock_hunter_release_pin_policy_v417'::regclass
      and conname='stock_hunter_release_pin_policy_v417_frozen_contract'
      and pg_get_constraintdef(oid) like '%max_component_attestation_age_minutes = 60%'
  ) then
    raise exception 'release-pin policy does not freeze attestation freshness';
  end if;

  if to_regclass('private.stock_hunter_release_component_attestations_v417') is null then
    raise exception 'component attestation audit table missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_component_attestations_v417'::regclass
      and tgname='stock_hunter_release_component_attestation_immutable_v417'
      and tgenabled='O' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='private.stock_hunter_release_component_attestations_v417'::regclass
      and tgname='stock_hunter_release_component_attestation_truncate_v417'
      and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'component attestation immutability triggers missing';
  end if;

  if has_table_privilege('anon','private.stock_hunter_release_component_attestations_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','private.stock_hunter_release_component_attestations_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','private.stock_hunter_release_component_attestations_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'component attestation table exposed to API role';
  end if;

  select pg_get_functiondef(
    'private.record_stock_hunter_release_component_attestation_v417(text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text)'::regprocedure
  ) into record_def;

  if position('GITHUB_API+SUPABASE_MANAGEMENT_API' in record_def)=0
     or position('afzalpour/afzalpour.github.io' in record_def)=0
     or position('summnepwuziwulzvpcms' in record_def)=0
     or position('stock-hunter-capture-v417' in record_def)=0
     or position('component attestation evidence must be freshly observed' in record_def)=0
     or position('{supabase,edge_function,ezbr_sha256}' in record_def)=0 then
    raise exception 'external component attestation evidence contract mismatch';
  end if;

  if has_function_privilege('anon',
       'private.record_stock_hunter_release_component_attestation_v417(text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text)',
       'EXECUTE')
     or has_function_privilege('authenticated',
       'private.record_stock_hunter_release_component_attestation_v417(text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text)',
       'EXECUTE')
     or has_function_privilege('service_role',
       'private.record_stock_hunter_release_component_attestation_v417(text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text)',
       'EXECUTE')
     or not has_function_privilege('postgres',
       'private.record_stock_hunter_release_component_attestation_v417(text,text,text,text,uuid,integer,text,boolean,timestamptz,jsonb,text)',
       'EXECUTE') then
    raise exception 'component attestation recorder ACL mismatch';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and attname='component_attestation_id'
      and attnotnull and not attisdropped
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='private.stock_hunter_release_pin_manifests_v417'::regclass
      and conname='stock_hunter_release_pin_manifests_v417_component_attestation_fkey'
  ) then
    raise exception 'release manifest is not bound to an immutable component attestation';
  end if;

  select pg_get_functiondef(
    'private.guard_stock_hunter_release_manifest_mutation_v417()'::regprocedure
  ) into guard_def;

  if position('old.component_attestation_id' in guard_def)=0
     or position('new.component_attestation_id' in guard_def)=0 then
    raise exception 'manifest immutability guard does not freeze component attestation identity';
  end if;

  if not exists (
    select 1 from pg_class
    where oid='public.stock_hunter_release_pin_readiness_v417'::regclass
      and relkind='v'
      and coalesce(reloptions,'{}'::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'release-pin readiness must remain security_invoker';
  end if;

  if (select count(*) from pg_attribute
      where attrelid='public.stock_hunter_release_pin_readiness_v417'::regclass
        and attnum>0 and not attisdropped)<>37 then
    raise exception 'release-pin readiness live-close output contract drifted';
  end if;

  if has_table_privilege('anon','public.stock_hunter_release_pin_readiness_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated','public.stock_hunter_release_pin_readiness_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('service_role','public.stock_hunter_release_pin_readiness_v417','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'internal release-pin readiness is unexpectedly exposed through Data API role';
  end if;

  select pg_get_viewdef('public.stock_hunter_release_pin_readiness_v417'::regclass,true)
  into view_def;

  if position('stock_hunter_release_component_attestations_v417' in view_def)=0
     or position('capture_deployment_sha256' in view_def)=0
     or position('max_component_attestation_age_minutes' in view_def)=0
     or position('RELEASE_COMPONENT_ATTESTATION_MISSING' in view_def)=0
     or position('RELEASE_COMPONENT_ATTESTATION_MISMATCH' in view_def)=0
     or position('RELEASE_COMPONENT_ATTESTATION_STALE' in view_def)=0
     or position('pass_component_attestation' in view_def)=0 then
    raise exception 'release-pin readiness is not externally attestation-bound';
  end if;

  select pg_get_functiondef(
    'private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text,text)'::regprocedure
  ) into prepare_def;

  if position('fresh externally verified 4.1.7 component attestation is required' in prepare_def)=0
     or position('stock_hunter_release_component_attestations_v417' in prepare_def)=0
     or position('component_attestation_id' in prepare_def)=0
     or position('v_att.attestation_id::text' in prepare_def)=0 then
    raise exception 'release PREPARE is not bound to fresh external component evidence';
  end if;

  select pg_get_functiondef(
    'private.authorize_stock_hunter_release_freeze_v417(bigint,bigint,text)'::regprocedure
  ) into authorize_def;

  if position('pass_component_attestation' in authorize_def)=0
     or position('component_attestation_fingerprint' in authorize_def)=0
     or position('current release/state/attestation' in authorize_def)=0 then
    raise exception 'release FREEZE authorization is not attestation-bound';
  end if;

  select pg_get_functiondef(
    'private.freeze_stock_hunter_release_v417(bigint,bigint,text)'::regprocedure
  ) into freeze_def;

  if position('pass_component_attestation' in freeze_def)=0
     or position('component_attestation_fingerprint' in freeze_def)=0
     or position('component_attestation_id::text' in freeze_def)=0
     or position('release-freeze authorization snapshot is stale or not bound to current state/attestation' in freeze_def)=0
     or position('4.1.6-hunt-v2' in freeze_def)=0
     or position('stock-hunter-capture-v416' in freeze_def)=0
     or position('runtime_state_changed' in freeze_def)=0 then
    raise exception 'final freeze attestation/rollback contract mismatch';
  end if;

  select pg_get_functiondef(
    'private.prepare_stock_hunter_release_pin_v417(bigint,text,text,text,text,text,integer,text,text,text)'::regprocedure
  ) into legacy_def;

  if position('capture deployment sha256 is required' in legacy_def)=0 then
    raise exception 'legacy PREPARE signature no longer fails closed';
  end if;

  select count(*) into v_bad_acl
  from pg_proc q join pg_namespace n on n.oid=q.pronamespace
  where n.nspname='private'
    and q.proname in (
      'record_stock_hunter_release_component_attestation_v417',
      'prepare_stock_hunter_release_pin_v417',
      'authorize_stock_hunter_release_freeze_v417',
      'freeze_stock_hunter_release_v417'
    )
    and (
      has_function_privilege('anon',q.oid,'EXECUTE')
      or has_function_privilege('authenticated',q.oid,'EXECUTE')
      or has_function_privilege('service_role',q.oid,'EXECUTE')
    );

  if v_bad_acl<>0 then
    raise exception 'final release mutator exposed to API role';
  end if;

  select count(*) into v_bad_cron
  from cron.job
  where active and (
       lower(command) like '%release_component_attestation%'
    or lower(command) like '%prepare_stock_hunter_release_pin%'
    or lower(command) like '%authorize_stock_hunter_release_freeze%'
    or lower(command) like '%freeze_stock_hunter_release%'
  );

  if v_bad_cron<>0 then
    raise exception 'automatic final release mutator cron detected';
  end if;

  select * into strict r
  from public.stock_hunter_release_pin_readiness_v417;

  select * into strict s
  from public.stock_hunter_activation_status_v417
  where status_id='default';

  if s.state_version=1 and s.activation_review_id is null then
    if r.ready_for_manual_release_freeze
       or r.pass_manifest_exists
       or r.pass_component_attestation
       or r.release_pin_reason<>'POST_ACTIVATION_NOT_STABLE' then
      raise exception 'pre-lifecycle final release gate is not fail-closed';
    end if;

    if exists(select 1 from private.stock_hunter_release_component_attestations_v417)
       or exists(select 1 from private.stock_hunter_release_pin_manifests_v417)
       or exists(select 1 from private.stock_hunter_release_freeze_authorizations_v417)
       or exists(select 1 from private.stock_hunter_previous_stable_archive_v417)
       or exists(select 1 from private.stock_hunter_activation_events_v417) then
      raise exception 'final release artifact residue exists before real lifecycle progression';
    end if;
  end if;
end $$;

select 'stock-hunter-final-release-live-close-v417: PASS' as result;
