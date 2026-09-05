-- Avan RC1.3-C1 — SECURITY DEFINER execute hardening
-- Goal: close anonymous/PUBLIC execution of exposed SECURITY DEFINER functions
-- while preserving existing authenticated/service-role grants.
-- No function bodies, Ledger logic, RLS policies, journal lifecycle or data are changed.

begin;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      f.signature
    );
  end loop;
end $$;

commit;

-- Verification: PUBLIC and anon must both be zero.
-- authenticated should remain available for the existing browser RPC surface.
select
  count(distinct p.oid) filter (
    where x.grantee = 0
      and x.privilege_type = 'EXECUTE'
  ) as public_exec_count,
  count(distinct p.oid) filter (
    where r.rolname = 'anon'
      and x.privilege_type = 'EXECUTE'
  ) as anon_acl_count,
  count(distinct p.oid) filter (
    where r.rolname = 'authenticated'
      and x.privilege_type = 'EXECUTE'
  ) as authenticated_acl_count,
  count(distinct p.oid) as functions_with_acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) x on true
left join pg_roles r on r.oid = x.grantee
where n.nspname = 'public'
  and p.prosecdef;
