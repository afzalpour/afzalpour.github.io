-- AVAN RC1.6-A — live-schema compatibility follow-up
-- Applied after RC1.6-A foundation on 2026-09-10.
-- Adds nullable treasury reference to existing financial transactions and
-- removes the nonexistent historical tx_no assumption from candidate output.

alter table public.financial_transactions
  add column if not exists reference text;

create index if not exists financial_transactions_workspace_reference_idx
  on public.financial_transactions(workspace_id, reference)
  where reference is not null;

create or replace function public.avan_bank_reconciliation_candidates(
  wid uuid,
  p_statement_line_id uuid,
  p_date_window integer default 3
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_workspace_access(wid) then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;
  if p_date_window < 0 or p_date_window > 30 then
    raise exception 'BANK_RECONCILIATION_DATE_WINDOW_INVALID';
  end if;

  with line_context as (
    select l.*, fa.ledger_account_id
    from public.bank_statement_lines l
    join public.financial_accounts fa
      on fa.workspace_id = l.workspace_id
     and fa.id = l.financial_account_id
     and fa.kind = 'bank'
    where l.workspace_id = wid
      and l.id = p_statement_line_id
      and l.ignored_at is null
      and not exists (
        select 1
        from public.bank_reconciliation_matches m
        where m.workspace_id = l.workspace_id
          and m.statement_line_id = l.id
          and m.voided_at is null
      )
  ), normalized as (
    select l.*,
      regexp_replace(
        lower(translate(coalesce(l.reference_no,''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')),
        '[^[:alnum:]]', '', 'g'
      ) as line_ref
    from line_context l
  ), candidates as (
    select
      t.id as transaction_id,
      t.tx_type,
      t.tx_date,
      t.amount,
      t.reference,
      t.description,
      abs(t.tx_date - l.booking_date) as date_distance_days,
      regexp_replace(
        lower(translate(coalesce(t.reference,''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')),
        '[^[:alnum:]]', '', 'g'
      ) as tx_ref,
      l.line_ref,
      l.financial_account_id
    from normalized l
    join public.financial_transactions t
      on t.workspace_id = l.workspace_id
     and t.status = 'posted'
     and t.tx_type in ('receipt','payment','transfer')
     and t.amount = l.amount
     and abs(t.tx_date - l.booking_date) <= p_date_window
     and (
       (l.direction = 'credit' and (
         (t.tx_type = 'receipt' and t.to_account_id = l.ledger_account_id)
         or (t.tx_type = 'transfer' and t.to_account_id = l.ledger_account_id and t.from_account_id is distinct from l.ledger_account_id)
       ))
       or
       (l.direction = 'debit' and (
         (t.tx_type = 'payment' and t.from_account_id = l.ledger_account_id)
         or (t.tx_type = 'transfer' and t.from_account_id = l.ledger_account_id and t.to_account_id is distinct from l.ledger_account_id)
       ))
     )
    where not exists (
      select 1
      from public.bank_reconciliation_matches m
      where m.workspace_id = t.workspace_id
        and m.financial_account_id = l.financial_account_id
        and m.financial_transaction_id = t.id
        and m.voided_at is null
    )
  ), scored as (
    select c.*,
      least(100,
        70
        + case when nullif(c.line_ref,'') is not null and c.line_ref = c.tx_ref then 20 else 0 end
        + case
            when c.date_distance_days = 0 then 10
            when c.date_distance_days = 1 then 7
            when c.date_distance_days <= 3 then 3
            else 0
          end
      )::integer as score,
      array_remove(array[
        'EXACT_AMOUNT'::text,
        'BANK_ACCOUNT_SIDE_MATCH'::text,
        case when nullif(c.line_ref,'') is not null and c.line_ref = c.tx_ref then 'EXACT_REFERENCE' end,
        case
          when c.date_distance_days = 0 then 'SAME_DAY'
          when c.date_distance_days = 1 then 'DATE_WITHIN_1_DAY'
          when c.date_distance_days <= 3 then 'DATE_WITHIN_3_DAYS'
        end
      ], null)::text[] as reason_codes
    from candidates c
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'transaction_id', transaction_id,
    'tx_type', tx_type,
    'tx_date', tx_date,
    'amount', amount,
    'reference', reference,
    'description', description,
    'date_distance_days', date_distance_days,
    'score', score,
    'reason_codes', reason_codes
  ) order by score desc, date_distance_days asc, transaction_id), '[]'::jsonb)
  into v_result
  from scored;

  return v_result;
end;
$$;

revoke all on function public.avan_bank_reconciliation_candidates(uuid,uuid,integer)
from public, anon;
grant execute on function public.avan_bank_reconciliation_candidates(uuid,uuid,integer)
to authenticated;
