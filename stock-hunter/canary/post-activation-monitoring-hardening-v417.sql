-- Stock Hunter 4.1.7 Post-Activation Monitoring hardening.
-- Freezes monitoring thresholds and makes public monitoring surfaces read-only.
-- Does not activate challenger traffic and does not prepare/freeze a release pin.

alter table public.stock_hunter_post_activation_policy_v417
  drop constraint if exists stock_hunter_post_activation_policy_v417_frozen_contract;

alter table public.stock_hunter_post_activation_policy_v417
  add constraint stock_hunter_post_activation_policy_v417_frozen_contract check (
    policy_id='default'
    and protocol_version='4.1.7-post-activation-v1'
    and min_stability_trade_dates=5
    and min_pairs_per_mode=500
    and min_symbols_per_mode=75
    and min_buckets_per_mode=8
    and max_telemetry_age_minutes=15
    and required_recommendation='PASS'
    and auto_rollback=false
    and auto_finalize=false
  );

create or replace function private.reject_stock_hunter_post_activation_policy_mutation_v417()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'stock hunter post-activation policy is frozen; change only through a reviewed migration';
end;
$$;

revoke all on function private.reject_stock_hunter_post_activation_policy_mutation_v417()
  from public,anon,authenticated,service_role;
grant execute on function private.reject_stock_hunter_post_activation_policy_mutation_v417()
  to postgres;

drop trigger if exists stock_hunter_post_activation_policy_immutable_v417
on public.stock_hunter_post_activation_policy_v417;

create trigger stock_hunter_post_activation_policy_immutable_v417
before insert or update or delete or truncate
on public.stock_hunter_post_activation_policy_v417
for each statement
execute function private.reject_stock_hunter_post_activation_policy_mutation_v417();

revoke all on public.stock_hunter_post_activation_policy_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_post_activation_policy_v417
  to anon,authenticated,service_role;

revoke all on public.stock_hunter_post_activation_monitor_v417
  from public,anon,authenticated,service_role;
grant select on public.stock_hunter_post_activation_monitor_v417
  to anon,authenticated,service_role;
alter view public.stock_hunter_post_activation_monitor_v417
  set (security_invoker=true);
