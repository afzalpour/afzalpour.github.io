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

-- Verification: both counts must be zero.
select
  count(*) filter (
    where has_function_privilege('anon', p.oid, 'EXECUTE')
  ) as anon_executable_security_definers,
  count(*) filter (
    where coalesce(array_to_string(p.proacl, ','), '') like '%=X/%'
  ) as public_executable_security_definers,
  count(*) filter (
    where has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) as authenticated_executable_security_definers,
  count(*) as total_security_definers
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef;
