-- Applied migration: rc1_3_operational_close_legacy_company_bootstrap
-- MT-B/MT-C made create_avan_company + CompanyContext the only supported browser lifecycle.
-- These legacy primitives remain callable internally by SECURITY DEFINER owners but not directly by signed-in browser users.

begin;
revoke execute on function public.bootstrap_avan_workspace(text,text,text,text,date,date) from authenticated;
revoke execute on function public.create_workspace(text,text,text) from authenticated;
commit;
