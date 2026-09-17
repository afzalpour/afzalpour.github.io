-- Stock Hunter 4.1.7 staged Canary one-shot authorization hardening.
-- Contract: 5 -> 10 -> 25 -> 50, manual authorization only, state-bound and fail-closed.

begin;

create table if not exists private.stock_hunter_activation_authorization_consumptions_v417 (
  authorization_id bigint primary key
    references private.stock_hunter_activation_authorizations_v417(authorization_id),
  review_id bigint not null references public.stock_hunter_activation_reviews_v417(review_id),
  from_state_version bigint not null check (from_state_version >= 1),
  to_state_version bigint not null check (to_state_version = from_state_version + 1),
  status_before jsonb not null,
  status_after jsonb not null,
  consumed_at timestamptz not null default now()
);

alter table private.stock_hunter_activation_authorization_consumptions_v417 enable row level security;
revoke all on private.stock_hunter_activation_authorization_consumptions_v417
  from public, anon, authenticated, service_role;

drop policy if exists stock_hunter_activation_authorization_consumption_deny_api_v417
  on private.stock_hunter_activation_authorization_consumptions_v417;
create policy stock_hunter_activation_authorization_consumption_deny_api_v417
  on private.stock_hunter_activation_authorization_consumptions_v417
  for all to anon, authenticated using (false) with check (false);

drop trigger if exists stock_hunter_activation_authorization_consumption_immutable_v417
  on private.stock_hunter_activation_authorization_consumptions_v417;
create trigger stock_hunter_activation_authorization_consumption_immutable_v417
before update or delete on private.stock_hunter_activation_authorization_consumptions_v417
for each row execute function private.reject_stock_hunter_activation_audit_mutation_v417();

drop trigger if exists stock_hunter_activation_authorization_consumption_truncate_v417
  on private.stock_hunter_activation_authorization_consumptions_v417;
create trigger stock_hunter_activation_authorization_consumption_truncate_v417
before truncate on private.stock_hunter_activation_authorization_consumptions_v417
for each statement execute function private.reject_stock_hunter_activation_audit_mutation_v417();

create or replace function private.start_stock_hunter_canary_v417(
  p_review_id bigint,
  p_expected_state_version bigint,
  p_percent integer,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy public.stock_hunter_activation_policy_v417%rowtype;
  v_status public.stock_hunter_activation_status_v417%rowtype;
  v_auth private.stock_hunter_activation_authorizations_v417%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_admission_ready boolean;
  v_admission_review_id bigint;
  v_admission_reason text;
  v_authorized_state_version bigint;
  v_authorized_review_id bigint;
  v_authorized_admission_ready boolean;
  v_authorized_admission_review_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(417,1);

  if nullif(pg_catalog.btrim(p_note),'') is null then
    raise exception 'canary note is required';
  end if;

  select * into strict v_policy
  from public.stock_hunter_activation_policy_v417
  where policy_id='default';

  if not v_policy.runtime_routing_enabled then
    raise exception 'runtime routing is not connected; canary start is blocked';
  end if;
  if v_policy.auto_activate or v_policy.auto_expand then
    raise exception 'automatic activation/expansion must remain disabled';
  end if;
  if not v_policy.require_activation_review or not v_policy.require_manual_authorization then
    raise exception 'manual activation review and authorization are required';
  end if;
  if v_policy.canary_steps is distinct from array[5,10,25,50]::integer[]
     or v_policy.initial_canary_percent <> 5 then
    raise exception 'frozen staged Canary policy mismatch';
  end if;
  if not (p_percent = any(v_policy.canary_steps)) then
    raise exception 'canary percent is not an allowed frozen step';
  end if;
  if p_percent <> v_policy.initial_canary_percent then
    raise exception 'first canary must use the frozen initial percent';
  end if;

  select * into strict v_status
  from public.stock_hunter_activation_status_v417
  where status_id='default'
  for update;

  if v_status.state_version <> p_expected_state_version then
    raise exception 'activation state version mismatch';
  end if;
  if v_status.routing_mode <> 'CHAMPION_ONLY'
     or v_status.challenger_traffic_percent <> 0
     or not v_status.kill_switch_engaged
     or v_status.activation_review_id is distinct from p_review_id then
    raise exception 'activation control is not in review-bound champion-only safe state';
  end if;

  select * into strict v_auth
  from private.stock_hunter_activation_authorizations_v417
  where review_id=p_review_id and decision='APPROVE_CANARY';

  v_authorized_state_version := nullif(v_auth.status_snapshot->>'state_version','')::bigint;
  v_authorized_review_id := nullif(v_auth.status_snapshot->>'activation_review_id','')::bigint;
  v_authorized_admission_ready := coalesce((v_auth.admission_snapshot->>'admission_ready')::boolean,false);
  v_authorized_admission_review_id := nullif(v_auth.admission_snapshot->>'activation_review_id','')::bigint;

  if v_authorized_state_version is distinct from v_status.state_version
     or v_authorized_review_id is distinct from p_review_id then
    raise exception 'approved Canary authorization is stale for the current control-plane state';
  end if;
  if not v_authorized_admission_ready
     or v_authorized_admission_review_id is distinct from p_review_id then
    raise exception 'approved Canary authorization is not bound to a PASS admission snapshot';
  end if;
  if exists (
    select 1
    from private.stock_hunter_activation_authorization_consumptions_v417 c
    where c.authorization_id=v_auth.authorization_id
  ) then
    raise exception 'approved Canary authorization has already been consumed';
  end if;

  select a.admission_ready,a.activation_review_id,a.admission_reason
    into v_admission_ready,v_admission_review_id,v_admission_reason
  from public.stock_hunter_canary_admission_readiness_v417 a
  limit 1;

  if v_admission_review_id is distinct from p_review_id
     or not coalesce(v_admission_ready,false) then
    raise exception 'canary admission gate recheck blocked start: %',coalesce(v_admission_reason,'UNKNOWN');
  end if;

  v_before := pg_catalog.to_jsonb(v_status);

  update public.stock_hunter_activation_status_v417 as s
     set routing_mode='CANARY',
         challenger_traffic_percent=p_percent,
         kill_switch_engaged=false,
         activation_review_id=p_review_id,
         authorization_id=v_auth.authorization_id,
         state_version=state_version+1,
         last_transition='CANARY_STARTED',
         last_transition_at=now(),
         updated_at=now()
   where status_id='default'
   returning pg_catalog.to_jsonb(s.*) into v_after;

  insert into private.stock_hunter_activation_authorization_consumptions_v417(
    authorization_id,review_id,from_state_version,to_state_version,status_before,status_after
  ) values (
    v_auth.authorization_id,p_review_id,v_status.state_version,v_status.state_version+1,v_before,v_after
  );

  insert into private.stock_hunter_activation_events_v417(
    event_type,review_id,authorization_id,from_state,to_state,event_note,event_fingerprint
  ) values (
    'CANARY_STARTED',p_review_id,v_auth.authorization_id,v_before,
    v_after || pg_catalog.jsonb_build_object('authorization_consumed',true),
    pg_catalog.btrim(p_note),
    pg_catalog.md5(v_before::text || '|' || v_after::text || '|' || v_auth.authorization_id::text || '|CANARY_STARTED|' || pg_catalog.btrim(p_note))
  );

  return v_after || pg_catalog.jsonb_build_object('authorization_consumed',true);
end;
$$;

revoke all on function private.start_stock_hunter_canary_v417(bigint,bigint,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function private.start_stock_hunter_canary_v417(bigint,bigint,integer,text) to postgres;

comment on table private.stock_hunter_activation_authorization_consumptions_v417 is
  'One-shot consumption ledger for the initial 5% Canary authorization. Immutable, state-bound, API-denied.';

commit;
