-- Companion ACL/immutability hardening for the one-time OOS release.
-- The controlled private release function runs as postgres; service/data-api roles are read-only.

revoke all on public.stock_hunter_oos_release_dataset_v416 from public,anon,authenticated,service_role;
grant select on public.stock_hunter_oos_release_dataset_v416 to anon,authenticated,service_role;

revoke insert,update,delete,truncate,references,trigger
  on public.stock_hunter_oos_release_manifest_v416
  from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate,references,trigger
  on public.stock_hunter_oos_release_results_v416
  from public,anon,authenticated,service_role;

grant select on public.stock_hunter_oos_release_manifest_v416 to service_role;
grant select on public.stock_hunter_oos_release_results_v416 to service_role;
grant select on public.stock_hunter_candidate_eval_control_v416 to service_role;

create unique index if not exists stock_hunter_oos_release_manifest_singleton_v416
  on public.stock_hunter_oos_release_manifest_v416 ((true));

drop trigger if exists stock_hunter_oos_manifest_immutable_v416 on public.stock_hunter_oos_release_manifest_v416;
create trigger stock_hunter_oos_manifest_immutable_v416
before update or delete or truncate on public.stock_hunter_oos_release_manifest_v416
for each statement execute function private.reject_stock_hunter_oos_release_mutation_v416();

drop trigger if exists stock_hunter_oos_results_immutable_v416 on public.stock_hunter_oos_release_results_v416;
create trigger stock_hunter_oos_results_immutable_v416
before update or delete or truncate on public.stock_hunter_oos_release_results_v416
for each statement execute function private.reject_stock_hunter_oos_release_mutation_v416();
