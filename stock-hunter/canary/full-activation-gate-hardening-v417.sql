-- Stock Hunter 4.1.7 independent 50% -> 100% Full Activation Gate hardening.
-- This migration does not activate traffic. It freezes policy, tightens coverage,
-- makes authorization audit append-only, and rechecks frozen snapshots at consumption.

update public.stock_hunter_full_activation_policy_v417
set required_from_percent=50,
    min_stage_minutes=120,
    min_routed_pairs_per_mode=250,
    min_routed_symbols_per_mode=50,
    min_routed_buckets_per_mode=8,
    max_telemetry_age_minutes=15,
    required_recommendation='PASS',
    auto_activate=false,
    updated_at=now()
where policy_id='default';

alter table public.stock_hunter_full_activation_policy_v417
  drop constraint if exists stock_hunter_full_activation_policy_v417_strict_gate;
alter table public.stock_hunter_full_activation_policy_v417
  add constraint stock_hunter_full_activation_policy_v417_strict_gate check (
    policy_id='default'
    and required_from_percent=50
    and min_stage_minutes>=120
    and min_routed_pairs_per_mode>=250
    and min_routed_symbols_per_mode>=50
    and min_routed_buckets_per_mode>=8
    and max_telemetry_age_minutes<=15
    and required_recommendation='PASS'
    and auto_activate=false
  );

create or replace function private.reject_stock_hunter_full_activation_policy_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'stock hunter full activation policy is frozen; change only through a reviewed migration';
end;
$$;
revoke all on function private.reject_stock_hunter_full_activation_policy_mutation_v417() from public,anon,authenticated,service_role;
grant execute on function private.reject_stock_hunter_full_activation_policy_mutation_v417() to postgres;

drop trigger if exists stock_hunter_full_activation_policy_immutable_v417
on public.stock_hunter_full_activation_policy_v417;
create trigger stock_hunter_full_activation_policy_immutable_v417
before insert or update or delete or truncate
on public.stock_hunter_full_activation_policy_v417
for each statement execute function private.reject_stock_hunter_full_activation_policy_mutation_v417();

revoke all on public.stock_hunter_full_activation_policy_v417 from public,anon,authenticated,service_role;
grant select on public.stock_hunter_full_activation_policy_v417 to anon,authenticated,service_role;

-- The readiness view is public read-only surface only.
revoke all on public.stock_hunter_full_activation_readiness_v417 from public,anon,authenticated,service_role;
grant select on public.stock_hunter_full_activation_readiness_v417 to anon,authenticated,service_role;
alter view public.stock_hunter_full_activation_readiness_v417 set (security_invoker=true);

-- Authorization audit is immutable except for the single NULL -> timestamp consumption transition.
create or replace function private.guard_stock_hunter_full_activation_authorization_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' then
    if row(
      old.full_authorization_id,old.review_id,old.state_version,old.from_percent,old.decision,
      old.authorization_note,old.readiness_snapshot,old.status_snapshot,
      old.authorization_fingerprint,old.created_at
    ) is distinct from row(
      new.full_authorization_id,new.review_id,new.state_version,new.from_percent,new.decision,
      new.authorization_note,new.readiness_snapshot,new.status_snapshot,
      new.authorization_fingerprint,new.created_at
    ) then
      raise exception 'full activation authorization audit fields are immutable';
    end if;
    if old.consumed_at is not null or new.consumed_at is null then
      raise exception 'full activation authorization may only be consumed once';
    end if;
    return new;
  end if;
  raise exception 'full activation authorization audit is immutable';
end;
$$;
revoke all on function private.guard_stock_hunter_full_activation_authorization_mutation_v417() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_full_activation_authorization_mutation_v417() to postgres;

drop trigger if exists stock_hunter_full_activation_authorization_immutable_v417
on private.stock_hunter_full_activation_authorizations_v417;
create trigger stock_hunter_full_activation_authorization_immutable_v417
before update or delete
on private.stock_hunter_full_activation_authorizations_v417
for each row execute function private.guard_stock_hunter_full_activation_authorization_mutation_v417();

drop trigger if exists stock_hunter_full_activation_authorization_truncate_v417
on private.stock_hunter_full_activation_authorizations_v417;
create trigger stock_hunter_full_activation_authorization_truncate_v417
before truncate
on private.stock_hunter_full_activation_authorizations_v417
for each statement execute function private.guard_stock_hunter_full_activation_authorization_mutation_v417();

create or replace function private.authorize_stock_hunter_full_activation_v417(
  p_expected_state_version bigint,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_ready public.stock_hunter_full_activation_readiness_v417%rowtype;
  v_policy public.stock_hunter_full_activation_policy_v417%rowtype;
  v_id bigint;
  v_fp text;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,4);
  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'full activation authorization note is required';
  end if;

  select * into strict v_policy
  from public.stock_hunter_full_activation_policy_v417
  where policy_id='default';
  if v_policy.required_from_percent<>50
     or v_policy.min_stage_minutes<120
     or v_policy.min_routed_pairs_per_mode<250
     or v_policy.min_routed_symbols_per_mode<50
     or v_policy.min_routed_buckets_per_mode<8
     or v_policy.max_telemetry_age_minutes>15
     or v_policy.required_recommendation<>'PASS'
     or v_policy.auto_activate then
    raise exception 'frozen full activation policy mismatch';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default'
  for update;
  if v_status.state_version<>p_expected_state_version then
    raise exception 'activation state version mismatch';
  end if;
  if v_status.routing_mode<>'CANARY'
     or v_status.challenger_traffic_percent<>50
     or v_status.kill_switch_engaged
     or v_status.activation_review_id is null then
    raise exception 'full activation authorization requires an active review-bound exact 50 percent Canary';
  end if;

  select * into strict v_ready
  from public.stock_hunter_full_activation_readiness_v417;
  if not coalesce(v_ready.full_activation_ready,false) then
    raise exception 'full activation gate blocked authorization: %',coalesce(v_ready.full_activation_reason,'UNKNOWN');
  end if;
  if v_ready.activation_review_id is distinct from v_status.activation_review_id
     or v_ready.state_version is distinct from v_status.state_version
     or v_ready.current_percent is distinct from 50 then
    raise exception 'full activation readiness is not bound to the current exact 50 percent state';
  end if;

  v_fp:=pg_catalog.md5(
    pg_catalog.to_jsonb(v_status)::text||'|'||
    pg_catalog.to_jsonb(v_ready)::text||'|'||
    pg_catalog.to_jsonb(v_policy)::text||'|'||
    pg_catalog.btrim(p_note)||'|APPROVE_FULL_ACTIVATION'
  );

  insert into private.stock_hunter_full_activation_authorizations_v417(
    review_id,state_version,from_percent,decision,authorization_note,
    readiness_snapshot,status_snapshot,authorization_fingerprint
  ) values (
    v_status.activation_review_id,v_status.state_version,50,'APPROVE_FULL_ACTIVATION',
    pg_catalog.btrim(p_note),pg_catalog.to_jsonb(v_ready),pg_catalog.to_jsonb(v_status),v_fp
  ) returning full_authorization_id into v_id;

  return pg_catalog.jsonb_build_object(
    'full_authorization_id',v_id,
    'review_id',v_status.activation_review_id,
    'state_version',v_status.state_version,
    'from_percent',50,
    'decision','APPROVE_FULL_ACTIVATION'
  );
end;
$$;
revoke all on function private.authorize_stock_hunter_full_activation_v417(bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.authorize_stock_hunter_full_activation_v417(bigint,text) to postgres;

create or replace function private.activate_stock_hunter_challenger_v417(
  p_expected_state_version bigint,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_activation_policy public.stock_hunter_activation_policy_v417%rowtype;
  v_full_policy public.stock_hunter_full_activation_policy_v417%rowtype;
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_ready public.stock_hunter_full_activation_readiness_v417%rowtype;
  v_auth private.stock_hunter_full_activation_authorizations_v417%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_auth_ready boolean;
  v_auth_review_id bigint;
  v_auth_state_version bigint;
  v_auth_percent integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);
  perform pg_catalog.pg_advisory_xact_lock(417,4);
  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'full activation note is required';
  end if;

  select * into strict v_activation_policy
  from public.stock_hunter_activation_policy_v417
  where policy_id='default';
  select * into strict v_full_policy
  from public.stock_hunter_full_activation_policy_v417
  where policy_id='default';

  if not v_activation_policy.runtime_routing_enabled then
    raise exception 'runtime routing is not connected; full activation is blocked';
  end if;
  if v_activation_policy.auto_activate or v_full_policy.auto_activate then
    raise exception 'auto activation must remain disabled';
  end if;
  if v_activation_policy.require_pre_full_canary_percent<>50
     or v_full_policy.required_from_percent<>50 then
    raise exception 'full activation requires the frozen exact 50 percent pre-full state';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default'
  for update;
  if v_status.state_version<>p_expected_state_version then
    raise exception 'activation state version mismatch';
  end if;
  if v_status.routing_mode<>'CANARY'
     or v_status.challenger_traffic_percent<>50
     or v_status.kill_switch_engaged
     or v_status.activation_review_id is null then
    raise exception 'activation control is not in the exact review-bound 50 percent Canary state';
  end if;

  select * into strict v_ready
  from public.stock_hunter_full_activation_readiness_v417;
  if not coalesce(v_ready.full_activation_ready,false) then
    raise exception 'full activation gate recheck blocked activation: %',coalesce(v_ready.full_activation_reason,'UNKNOWN');
  end if;
  if v_ready.activation_review_id is distinct from v_status.activation_review_id
     or v_ready.state_version is distinct from v_status.state_version
     or v_ready.current_percent is distinct from 50 then
    raise exception 'full activation readiness is stale or not bound to current state';
  end if;

  select * into v_auth
  from private.stock_hunter_full_activation_authorizations_v417
  where review_id=v_status.activation_review_id
    and state_version=v_status.state_version
    and from_percent=50
    and decision='APPROVE_FULL_ACTIVATION'
    and consumed_at is null
  order by full_authorization_id desc
  limit 1
  for update;
  if v_auth.full_authorization_id is null then
    raise exception 'separate one-time full activation authorization is required for this state version';
  end if;

  v_auth_ready:=coalesce((v_auth.readiness_snapshot->>'full_activation_ready')::boolean,false);
  v_auth_review_id:=nullif(v_auth.readiness_snapshot->>'activation_review_id','')::bigint;
  v_auth_state_version:=nullif(v_auth.readiness_snapshot->>'state_version','')::bigint;
  v_auth_percent:=nullif(v_auth.readiness_snapshot->>'current_percent','')::integer;
  if not v_auth_ready
     or v_auth_review_id is distinct from v_status.activation_review_id
     or v_auth_state_version is distinct from v_status.state_version
     or v_auth_percent is distinct from 50
     or nullif(v_auth.status_snapshot->>'state_version','')::bigint is distinct from v_status.state_version
     or nullif(v_auth.status_snapshot->>'activation_review_id','')::bigint is distinct from v_status.activation_review_id
     or nullif(v_auth.status_snapshot->>'challenger_traffic_percent','')::integer is distinct from 50 then
    raise exception 'full activation authorization snapshot is stale or not bound to the current 50 percent state';
  end if;

  v_before:=pg_catalog.to_jsonb(v_status);
  update public.stock_hunter_activation_status_v417 as s
  set routing_mode='CHALLENGER_ONLY',
      challenger_traffic_percent=100,
      kill_switch_engaged=false,
      state_version=state_version+1,
      last_transition='CHALLENGER_FULL_ACTIVATED',
      last_transition_at=now(),
      updated_at=now()
  where status_id='default'
  returning pg_catalog.to_jsonb(s.*) into v_after;

  update private.stock_hunter_full_activation_authorizations_v417
  set consumed_at=now()
  where full_authorization_id=v_auth.full_authorization_id;

  insert into private.stock_hunter_activation_events_v417(
    event_type,review_id,authorization_id,from_state,to_state,event_note,event_fingerprint
  ) values (
    'CHALLENGER_FULL_ACTIVATED',v_status.activation_review_id,v_status.authorization_id,v_before,
    v_after||pg_catalog.jsonb_build_object('full_authorization_id',v_auth.full_authorization_id,'full_authorization_consumed',true),
    pg_catalog.btrim(p_note),
    pg_catalog.md5(v_before::text||'|'||v_after::text||'|'||v_auth.full_authorization_id::text||'|CHALLENGER_FULL_ACTIVATED|'||pg_catalog.btrim(p_note))
  );

  return v_after||pg_catalog.jsonb_build_object(
    'full_authorization_id',v_auth.full_authorization_id,
    'full_authorization_consumed',true
  );
end;
$$;
revoke all on function private.activate_stock_hunter_challenger_v417(bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.activate_stock_hunter_challenger_v417(bigint,text) to postgres;
