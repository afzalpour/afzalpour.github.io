-- AVAN RC1.5 — Invoice save hot-refresh snapshot
-- Additive read-only RPC used only immediately after a successful invoice save/post.
-- SECURITY INVOKER keeps all existing RLS boundaries authoritative.

create or replace function public.avan_invoice_save_refresh_snapshot(wid uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'workspaces', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select id,name,mode,base_currency,created_at
        from public.workspaces
        where id=wid
        limit 1
      ) x
    ), '[]'::jsonb),
    'fiscal_years', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.fiscal_years
        where workspace_id=wid
        order by date_from desc
        limit 1
      ) x
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.accounts
        where workspace_id=wid
        order by code asc
      ) x
    ), '[]'::jsonb),
    'account_roles', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select role_key,account_id
        from public.account_roles
        where workspace_id=wid
      ) x
    ), '[]'::jsonb),
    'parties', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.parties
        where workspace_id=wid
        order by name asc
      ) x
    ), '[]'::jsonb),
    'journal_entries', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.journal_entries
        where workspace_id=wid
        order by entry_date desc,journal_no desc nulls last,created_at desc
      ) x
    ), '[]'::jsonb),
    'journal_lines', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.journal_lines
        where workspace_id=wid
        order by line_no asc
      ) x
    ), '[]'::jsonb),
    'financial_accounts', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.financial_accounts
        where workspace_id=wid
        order by kind asc,created_at asc
      ) x
    ), '[]'::jsonb),
    'fiscal_periods', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.fiscal_periods
        where workspace_id=wid
        order by date_from desc
      ) x
    ), '[]'::jsonb),
    'financial_transactions', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.financial_transactions
        where workspace_id=wid
        order by tx_date desc,created_at desc
        limit 100
      ) x
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.invoices
        where workspace_id=wid
        order by invoice_date desc,invoice_no desc nulls last,created_at desc
      ) x
    ), '[]'::jsonb),
    'invoice_lines', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.invoice_lines
        where workspace_id=wid
        order by line_no asc
      ) x
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select *
        from public.documents
        where workspace_id=wid
        order by created_at desc
      ) x
    ), '[]'::jsonb),
    'health', public.avan_workspace_health(wid),
    'integrity', public.avan_core_integrity(wid),
    'workspace_role', public.workspace_role(wid),
    'invoice_integrity', public.invoice_integrity(wid)
  );
$function$;

revoke all on function public.avan_invoice_save_refresh_snapshot(uuid) from public;
revoke all on function public.avan_invoice_save_refresh_snapshot(uuid) from anon;
grant execute on function public.avan_invoice_save_refresh_snapshot(uuid) to authenticated;

comment on function public.avan_invoice_save_refresh_snapshot(uuid) is
  'RC1.5 read-only, RLS-governed one-roundtrip context refresh used immediately after invoice save/post.';
