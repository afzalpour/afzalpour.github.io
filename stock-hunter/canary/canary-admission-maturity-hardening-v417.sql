-- Stock Hunter 4.1.7 Canary telemetry/admission maturity hardening.
-- CANARY_ADMISSION_MATURITY_CONTRACT: REVIEW_BOUND_REAL_DATA_MANUAL_ONLY

begin;

do $$
declare
  tp public.stock_hunter_canary_telemetry_policy_v417%rowtype;
  ap public.stock_hunter_canary_admission_policy_v417%rowtype;
begin
  select * into strict tp from public.stock_hunter_canary_telemetry_policy_v417 where policy_id='default';
  select * into strict ap from public.stock_hunter_canary_admission_policy_v417 where policy_id='default';

  if tp.protocol_version <> '4.1.7-canary-telemetry-v1'
     or tp.min_pairs_per_mode <> 100
     or tp.auto_kill then
    raise exception 'unexpected canary telemetry policy contract';
  end if;

  if ap.protocol_version <> '4.1.7-canary-admission-v1'
     or ap.min_pairs_per_mode <> 100
     or ap.min_symbols_per_mode <> 30
     or ap.min_buckets_per_mode <> 3
     or ap.max_telemetry_age_minutes <> 20
     or ap.required_recommendation <> 'PASS'
     or not ap.require_safe_champion_state
     or ap.auto_start then
    raise exception 'unexpected canary admission policy contract';
  end if;
end $$;

create or replace function private.reject_stock_hunter_canary_telemetry_policy_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'stock_hunter_canary_telemetry_policy_v417 is frozen; change only through a reviewed migration';
end;
$$;

revoke all on function private.reject_stock_hunter_canary_telemetry_policy_mutation_v417()
  from public, anon, authenticated, service_role;
grant execute on function private.reject_stock_hunter_canary_telemetry_policy_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_canary_telemetry_policy_immutable_v417
  on public.stock_hunter_canary_telemetry_policy_v417;
create trigger stock_hunter_canary_telemetry_policy_immutable_v417
before insert or update or delete or truncate
on public.stock_hunter_canary_telemetry_policy_v417
for each statement
execute function private.reject_stock_hunter_canary_telemetry_policy_mutation_v417();

-- The policy and operator views are read-only Data API surfaces.
revoke all on table public.stock_hunter_canary_telemetry_policy_v417
  from public, anon, authenticated, service_role;
grant select on table public.stock_hunter_canary_telemetry_policy_v417
  to anon, authenticated, service_role;

revoke all on table public.stock_hunter_canary_monitor_v417
  from public, anon, authenticated, service_role;
grant select on table public.stock_hunter_canary_monitor_v417
  to anon, authenticated, service_role;

revoke all on table public.stock_hunter_canary_telemetry_metrics_v417
  from public, anon, authenticated, service_role;
grant select on table public.stock_hunter_canary_telemetry_metrics_v417
  to anon, authenticated, service_role;

revoke all on table public.stock_hunter_canary_admission_readiness_v417
  from public, anon, authenticated, service_role;
grant select on table public.stock_hunter_canary_admission_readiness_v417
  to anon, authenticated, service_role;

comment on function private.reject_stock_hunter_canary_telemetry_policy_mutation_v417() is
  'Freezes Canary telemetry divergence thresholds; changes require a reviewed migration.';

commit;
