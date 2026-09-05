-- Avan RC1.2-E.1 — PostgREST schema-cache recovery
-- Run only after RC1_2_E_COMPANY_PROFILE_PATCH.sql has completed successfully.
-- This file is safe to run repeatedly and does not mutate Ledger data.

begin;

do $$
begin
  if to_regclass('public.workspace_print_profiles') is null then
    raise exception 'RC1_2_E_TABLE_MISSING';
  end if;

  if to_regprocedure('public.get_workspace_print_profile(uuid)') is null then
    raise exception 'RC1_2_E_GET_RPC_MISSING';
  end if;

  if to_regprocedure('public.set_workspace_print_profile(uuid,jsonb)') is null then
    raise exception 'RC1_2_E_SET_RPC_MISSING';
  end if;
end $$;

-- Ask PostgREST/Supabase API to reload its schema cache so newly-created RPCs
-- become visible immediately through /rest/v1/rpc/*.
select pg_notify('pgrst', 'reload schema');

commit;

-- Read-only verification:
select
  to_regclass('public.workspace_print_profiles') as profile_table,
  to_regprocedure('public.get_workspace_print_profile(uuid)') as get_rpc,
  to_regprocedure('public.set_workspace_print_profile(uuid,jsonb)') as set_rpc;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avan-branding';
