-- RC1.3 security hardening
-- Applied to Avan-production on 2026-09-06.
-- Goal: keep privileged implementations out of the exposed public schema while preserving existing RPC names/signatures.

grant usage on schema private to authenticated, service_role;

alter function public.cancel_workspace_invitation(uuid,uuid) set schema private;
alter function public.claim_workspace_invitations() set schema private;
alter function public.close_fiscal_period(uuid,uuid,text,date,date) set schema private;
alter function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) set schema private;
alter function public.create_avan_company(text,text,text,date,date,jsonb) set schema private;
alter function public.delete_draft_invoice(uuid) set schema private;
alter function public.delete_draft_journal(uuid) set schema private;
alter function public.invite_workspace_member(uuid,text,text) set schema private;
alter function public.list_workspace_access(uuid) set schema private;
alter function public.manage_workspace_member(uuid,uuid,text,boolean) set schema private;
alter function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) set schema private;
alter function public.post_invoice(uuid) set schema private;
alter function public.post_journal_entry(uuid) set schema private;
alter function public.rename_avan_company(uuid,text) set schema private;
alter function public.reopen_fiscal_period(uuid) set schema private;
alter function public.reverse_journal_entry(uuid,date,text) set schema private;
alter function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) set schema private;
alter function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) set schema private;
alter function public.set_money_display_unit(uuid,text) set schema private;
alter function public.set_workspace_print_profile(uuid,jsonb) set schema private;

create function public.cancel_workspace_invitation(wid uuid, p_invitation_id uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.cancel_workspace_invitation(wid,p_invitation_id)
$$;

create function public.claim_workspace_invitations()
returns integer language sql security invoker set search_path='' as $$
  select private.claim_workspace_invitations()
$$;

create function public.close_fiscal_period(p_workspace_id uuid, p_fiscal_year_id uuid, p_name text, p_date_from date, p_date_to date)
returns uuid language sql security invoker set search_path='' as $$
  select private.close_fiscal_period(p_workspace_id,p_fiscal_year_id,p_name,p_date_from,p_date_to)
$$;

create function public.create_and_post_journal(p_workspace_id uuid, p_fiscal_year_id uuid, p_entry_date date, p_description text, p_source_type text, p_lines jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.create_and_post_journal(p_workspace_id,p_fiscal_year_id,p_entry_date,p_description,p_source_type,p_lines)
$$;

create function public.create_avan_company(
  p_name text,
  p_money_unit text default 'toman'::text,
  p_fiscal_name text default '۱۴۰۵'::text,
  p_date_from date default '2026-03-21'::date,
  p_date_to date default '2027-03-20'::date,
  p_profile jsonb default '{}'::jsonb
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.create_avan_company(p_name,p_money_unit,p_fiscal_name,p_date_from,p_date_to,p_profile)
$$;

create function public.delete_draft_invoice(iid uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.delete_draft_invoice(iid)
$$;

create function public.delete_draft_journal(jid uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.delete_draft_journal(jid)
$$;

create function public.invite_workspace_member(wid uuid, p_email text, p_role text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.invite_workspace_member(wid,p_email,p_role)
$$;

create function public.list_workspace_access(wid uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.list_workspace_access(wid)
$$;

create function public.manage_workspace_member(wid uuid, p_user_id uuid, p_role text, p_active boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select private.manage_workspace_member(wid,p_user_id,p_role,p_active)
$$;

create function public.post_financial_operation(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_tx_date date,
  p_tx_type text,
  p_amount numeric,
  p_primary_account_id uuid,
  p_counterpart_account_id uuid default null::uuid,
  p_party_id uuid default null::uuid,
  p_description text default null::text
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.post_financial_operation(p_workspace_id,p_fiscal_year_id,p_tx_date,p_tx_type,p_amount,p_primary_account_id,p_counterpart_account_id,p_party_id,p_description)
$$;

create function public.post_invoice(iid uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.post_invoice(iid)
$$;

create function public.post_journal_entry(jid uuid)
returns public.journal_entries language sql security invoker set search_path='' as $$
  select private.post_journal_entry(jid)
$$;

create function public.rename_avan_company(wid uuid, p_name text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.rename_avan_company(wid,p_name)
$$;

create function public.reopen_fiscal_period(pid uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.reopen_fiscal_period(pid)
$$;

create function public.reverse_journal_entry(jid uuid, reverse_date date, reason text)
returns uuid language sql security invoker set search_path='' as $$
  select private.reverse_journal_entry(jid,reverse_date,reason)
$$;

create function public.save_draft_invoice(p_workspace_id uuid, p_fiscal_year_id uuid, p_invoice_id uuid, p_invoice_type text, p_invoice_date date, p_due_date date, p_party_id uuid, p_description text, p_lines jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.save_draft_invoice(p_workspace_id,p_fiscal_year_id,p_invoice_id,p_invoice_type,p_invoice_date,p_due_date,p_party_id,p_description,p_lines)
$$;

create function public.save_draft_journal(p_workspace_id uuid, p_fiscal_year_id uuid, p_journal_id uuid, p_entry_date date, p_description text, p_lines jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.save_draft_journal(p_workspace_id,p_fiscal_year_id,p_journal_id,p_entry_date,p_description,p_lines)
$$;

create function public.set_money_display_unit(wid uuid, p_unit text)
returns text language sql security invoker set search_path='' as $$
  select private.set_money_display_unit(wid,p_unit)
$$;

create function public.set_workspace_print_profile(wid uuid, p_profile jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.set_workspace_print_profile(wid,p_profile)
$$;

-- Public wrappers: no default PUBLIC/anon execution.
revoke all on function public.cancel_workspace_invitation(uuid,uuid) from public, anon;
revoke all on function public.claim_workspace_invitations() from public, anon;
revoke all on function public.close_fiscal_period(uuid,uuid,text,date,date) from public, anon;
revoke all on function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) from public, anon;
revoke all on function public.create_avan_company(text,text,text,date,date,jsonb) from public, anon;
revoke all on function public.delete_draft_invoice(uuid) from public, anon;
revoke all on function public.delete_draft_journal(uuid) from public, anon;
revoke all on function public.invite_workspace_member(uuid,text,text) from public, anon;
revoke all on function public.list_workspace_access(uuid) from public, anon;
revoke all on function public.manage_workspace_member(uuid,uuid,text,boolean) from public, anon;
revoke all on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) from public, anon;
revoke all on function public.post_invoice(uuid) from public, anon;
revoke all on function public.post_journal_entry(uuid) from public, anon;
revoke all on function public.rename_avan_company(uuid,text) from public, anon;
revoke all on function public.reopen_fiscal_period(uuid) from public, anon;
revoke all on function public.reverse_journal_entry(uuid,date,text) from public, anon;
revoke all on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public, anon;
revoke all on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) from public, anon;
revoke all on function public.set_money_display_unit(uuid,text) from public, anon;
revoke all on function public.set_workspace_print_profile(uuid,jsonb) from public, anon;

grant execute on function public.cancel_workspace_invitation(uuid,uuid) to authenticated, service_role;
grant execute on function public.claim_workspace_invitations() to authenticated, service_role;
grant execute on function public.close_fiscal_period(uuid,uuid,text,date,date) to authenticated, service_role;
grant execute on function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) to authenticated, service_role;
grant execute on function public.create_avan_company(text,text,text,date,date,jsonb) to authenticated, service_role;
grant execute on function public.delete_draft_invoice(uuid) to authenticated, service_role;
grant execute on function public.delete_draft_journal(uuid) to authenticated, service_role;
grant execute on function public.invite_workspace_member(uuid,text,text) to authenticated, service_role;
grant execute on function public.list_workspace_access(uuid) to authenticated, service_role;
grant execute on function public.manage_workspace_member(uuid,uuid,text,boolean) to authenticated, service_role;
grant execute on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.post_invoice(uuid) to authenticated, service_role;
grant execute on function public.post_journal_entry(uuid) to authenticated, service_role;
grant execute on function public.rename_avan_company(uuid,text) to authenticated, service_role;
grant execute on function public.reopen_fiscal_period(uuid) to authenticated, service_role;
grant execute on function public.reverse_journal_entry(uuid,date,text) to authenticated, service_role;
grant execute on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to authenticated, service_role;
grant execute on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) to authenticated, service_role;
grant execute on function public.set_money_display_unit(uuid,text) to authenticated, service_role;
grant execute on function public.set_workspace_print_profile(uuid,jsonb) to authenticated, service_role;

-- Private implementations remain privileged, but are not exposed as public RPCs.
revoke all on function private.cancel_workspace_invitation(uuid,uuid) from public, anon;
revoke all on function private.claim_workspace_invitations() from public, anon;
revoke all on function private.close_fiscal_period(uuid,uuid,text,date,date) from public, anon;
revoke all on function private.create_and_post_journal(uuid,uuid,date,text,text,jsonb) from public, anon;
revoke all on function private.create_avan_company(text,text,text,date,date,jsonb) from public, anon;
revoke all on function private.delete_draft_invoice(uuid) from public, anon;
revoke all on function private.delete_draft_journal(uuid) from public, anon;
revoke all on function private.invite_workspace_member(uuid,text,text) from public, anon;
revoke all on function private.list_workspace_access(uuid) from public, anon;
revoke all on function private.manage_workspace_member(uuid,uuid,text,boolean) from public, anon;
revoke all on function private.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) from public, anon;
revoke all on function private.post_invoice(uuid) from public, anon;
revoke all on function private.post_journal_entry(uuid) from public, anon;
revoke all on function private.rename_avan_company(uuid,text) from public, anon;
revoke all on function private.reopen_fiscal_period(uuid) from public, anon;
revoke all on function private.reverse_journal_entry(uuid,date,text) from public, anon;
revoke all on function private.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public, anon;
revoke all on function private.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) from public, anon;
revoke all on function private.set_money_display_unit(uuid,text) from public, anon;
revoke all on function private.set_workspace_print_profile(uuid,jsonb) from public, anon;

grant execute on function private.cancel_workspace_invitation(uuid,uuid) to authenticated, service_role;
grant execute on function private.claim_workspace_invitations() to authenticated, service_role;
grant execute on function private.close_fiscal_period(uuid,uuid,text,date,date) to authenticated, service_role;
grant execute on function private.create_and_post_journal(uuid,uuid,date,text,text,jsonb) to authenticated, service_role;
grant execute on function private.create_avan_company(text,text,text,date,date,jsonb) to authenticated, service_role;
grant execute on function private.delete_draft_invoice(uuid) to authenticated, service_role;
grant execute on function private.delete_draft_journal(uuid) to authenticated, service_role;
grant execute on function private.invite_workspace_member(uuid,text,text) to authenticated, service_role;
grant execute on function private.list_workspace_access(uuid) to authenticated, service_role;
grant execute on function private.manage_workspace_member(uuid,uuid,text,boolean) to authenticated, service_role;
grant execute on function private.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function private.post_invoice(uuid) to authenticated, service_role;
grant execute on function private.post_journal_entry(uuid) to authenticated, service_role;
grant execute on function private.rename_avan_company(uuid,text) to authenticated, service_role;
grant execute on function private.reopen_fiscal_period(uuid) to authenticated, service_role;
grant execute on function private.reverse_journal_entry(uuid,date,text) to authenticated, service_role;
grant execute on function private.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to authenticated, service_role;
grant execute on function private.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) to authenticated, service_role;
grant execute on function private.set_money_display_unit(uuid,text) to authenticated, service_role;
grant execute on function private.set_workspace_print_profile(uuid,jsonb) to authenticated, service_role;
