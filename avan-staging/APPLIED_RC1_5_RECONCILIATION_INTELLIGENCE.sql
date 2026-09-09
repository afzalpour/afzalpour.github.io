-- AVAN RC1.5 — Human-controlled reconciliation intelligence
-- Applied to Avan-production on 2026-09-09.
-- Read-only, Company-scoped, SECURITY INVOKER. No autonomous financial writes.

create or replace function public.invoice_integrity(wid uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with line_totals as (
    select il.invoice_id, coalesce(sum(il.line_total), 0::numeric) as line_sum
    from public.invoice_lines il
    where il.workspace_id = wid
    group by il.invoice_id
  )
  select jsonb_build_object(
    'posted_without_journal', (
      select count(*)
      from public.invoices i
      where i.workspace_id = wid
        and i.status = 'posted'
        and i.journal_entry_id is null
    ),
    'total_mismatch', (
      select count(*)
      from public.invoices i
      left join line_totals lt on lt.invoice_id = i.id
      where i.workspace_id = wid
        and (
          case
            when i.subtotal_amount is not null then
              coalesce(i.subtotal_amount, 0::numeric) <> coalesce(lt.line_sum, 0::numeric)
              or coalesce(i.total_amount, 0::numeric) <> coalesce(i.subtotal_amount, 0::numeric) + coalesce(i.tax_total, 0::numeric)
            else
              coalesce(i.total_amount, 0::numeric) <> coalesce(lt.line_sum, 0::numeric)
          end
        )
    )
  );
$$;

revoke all on function public.invoice_integrity(uuid) from public, anon;
grant execute on function public.invoice_integrity(uuid) to authenticated;

create or replace function public.avan_reconciliation_findings(wid uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_workspace_access(wid) then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  with
  invoice_line_totals as (
    select il.invoice_id,
           coalesce(sum(il.line_total), 0::numeric) as line_sum,
           count(*) filter (where il.item_id is not null) as item_line_count
    from public.invoice_lines il
    where il.workspace_id = wid
    group by il.invoice_id
  ),
  schedule_totals as (
    select s.invoice_id,
           coalesce(sum(s.amount), 0::numeric) as scheduled_total,
           count(*) as schedule_count
    from public.invoice_settlement_schedule s
    where s.workspace_id = wid
    group by s.invoice_id
  ),
  journal_balance as (
    select je.id, je.entry_date, je.description, je.source_type, je.source_id,
           coalesce(sum(jl.debit), 0::numeric) as debit_total,
           coalesce(sum(jl.credit), 0::numeric) as credit_total
    from public.journal_entries je
    left join public.journal_lines jl
      on jl.journal_entry_id = je.id and jl.workspace_id = je.workspace_id
    where je.workspace_id = wid and je.status in ('posted','reversed')
    group by je.id, je.entry_date, je.description, je.source_type, je.source_id
  ),
  invoice_duplicates as (
    select i.invoice_type, i.party_id, i.invoice_date, i.total_amount,
           count(*) as duplicate_count,
           array_agg(i.id order by i.created_at) as ids,
           string_agg(i.invoice_no::text, '، ' order by i.invoice_no) as invoice_nos
    from public.invoices i
    where i.workspace_id = wid and i.status <> 'reversed'
    group by i.invoice_type, i.party_id, i.invoice_date, i.total_amount
    having count(*) > 1
  ),
  transaction_duplicates as (
    select t.tx_type, t.tx_date, t.amount, t.party_id, t.from_account_id, t.to_account_id, t.counterpart_account_id,
           count(*) as duplicate_count,
           array_agg(t.id order by t.created_at) as ids
    from public.financial_transactions t
    where t.workspace_id = wid and t.status = 'posted'
    group by t.tx_type, t.tx_date, t.amount, t.party_id, t.from_account_id, t.to_account_id, t.counterpart_account_id
    having count(*) > 1
  ),
  document_duplicates as (
    select d.file_hash, count(*) as duplicate_count, array_agg(d.id order by d.created_at) as ids,
           string_agg(d.file_name, '، ' order by d.created_at) as file_names
    from public.documents d
    where d.workspace_id = wid and nullif(trim(d.file_hash), '') is not null
    group by d.file_hash
    having count(*) > 1
  ),
  findings as (
    select
      'orphan_journal_line'::text as code, 'critical'::text as severity, 'accounting'::text as category,
      'ردیف حسابداری بدون سند'::text as title,
      'یک ردیف حسابداری به سند مادر معتبر متصل نیست.'::text as description,
      'journal_line'::text as entity_type, jl.id as entity_id, null::text as entity_no, null::date as event_date,
      greatest(coalesce(jl.debit,0), coalesce(jl.credit,0))::numeric as amount,
      null::numeric as expected, null::numeric as actual,
      jsonb_build_object('journal_entry_id', jl.journal_entry_id, 'account_id', jl.account_id, 'debit', jl.debit, 'credit', jl.credit) as metadata,
      'repair_source_link'::text as suggestion_type
    from public.journal_lines jl
    left join public.journal_entries je on je.id = jl.journal_entry_id and je.workspace_id = jl.workspace_id
    where jl.workspace_id = wid and je.id is null

    union all
    select
      'unbalanced_journal','critical','accounting','سند حسابداری نامتوازن',
      'جمع بدهکار و بستانکار سند ثبت‌شده/برگشتی برابر نیست.',
      'journal_entry', jb.id, null, jb.entry_date,
      abs(jb.debit_total-jb.credit_total), jb.debit_total, jb.credit_total,
      jsonb_build_object('description', jb.description, 'source_type', jb.source_type, 'source_id', jb.source_id, 'debit_total', jb.debit_total, 'credit_total', jb.credit_total),
      'reverse_and_reenter'
    from journal_balance jb
    where jb.debit_total <> jb.credit_total

    union all
    select
      'posted_invoice_missing_journal','critical','invoice','فاکتور ثبت‌شده بدون سند حسابداری',
      'فاکتور Posted است اما سند حسابداری مرجع ندارد.',
      'invoice', i.id, i.invoice_no::text, i.invoice_date, i.total_amount, i.total_amount, null,
      jsonb_build_object('invoice_type', i.invoice_type, 'party_id', i.party_id, 'status', i.status),
      'rebuild_from_source'
    from public.invoices i
    where i.workspace_id = wid and i.status = 'posted' and i.journal_entry_id is null

    union all
    select
      'invoice_total_mismatch','high','invoice','اختلاف جمع فاکتور',
      'جمع ردیف‌ها/مالیات با مبالغ ذخیره‌شده روی سربرگ فاکتور سازگار نیست.',
      'invoice', i.id, i.invoice_no::text, i.invoice_date, i.total_amount,
      case when i.subtotal_amount is not null then coalesce(i.subtotal_amount,0)+coalesce(i.tax_total,0) else coalesce(ilt.line_sum,0) end,
      coalesce(i.total_amount,0),
      jsonb_build_object('invoice_type', i.invoice_type, 'line_sum', coalesce(ilt.line_sum,0), 'stored_subtotal', i.subtotal_amount, 'stored_tax', i.tax_total, 'stored_total', i.total_amount),
      'review_invoice_totals'
    from public.invoices i
    left join invoice_line_totals ilt on ilt.invoice_id = i.id
    where i.workspace_id = wid and (
      case when i.subtotal_amount is not null then
        coalesce(i.subtotal_amount,0) <> coalesce(ilt.line_sum,0)
        or coalesce(i.total_amount,0) <> coalesce(i.subtotal_amount,0)+coalesce(i.tax_total,0)
      else coalesce(i.total_amount,0) <> coalesce(ilt.line_sum,0) end
    )

    union all
    select
      'sale_invoice_missing_inventory_document','high','inventory','فاکتور فروش کالایی بدون سند خروج انبار',
      'فاکتور فروش ثبت‌شده دارای قلم کالا است اما سند انبار به آن متصل نیست.',
      'invoice', i.id, i.invoice_no::text, i.invoice_date, i.total_amount, null, null,
      jsonb_build_object('item_line_count', ilt.item_line_count, 'invoice_type', i.invoice_type),
      'review_inventory_posting'
    from public.invoices i
    join invoice_line_totals ilt on ilt.invoice_id = i.id and ilt.item_line_count > 0
    where i.workspace_id = wid and i.status = 'posted' and i.invoice_type = 'sale' and i.inventory_document_id is null

    union all
    select
      'orphan_inventory_line','critical','inventory','ردیف انبار بدون سند مادر',
      'ردیف سند انبار به سند انبار معتبر متصل نیست.',
      'inventory_line', l.id, l.line_no::text, null, null, null, null,
      jsonb_build_object('inventory_document_id', l.inventory_document_id, 'item_id', l.item_id, 'quantity', l.quantity),
      'repair_source_link'
    from public.inventory_document_lines l
    left join public.inventory_documents d on d.id = l.inventory_document_id and d.workspace_id = l.workspace_id
    where l.workspace_id = wid and d.id is null

    union all
    select
      'orphan_inventory_movement','critical','inventory','گردش انبار با مرجع نامعتبر',
      'حرکت موجودی به سند یا ردیف انبار معتبر متصل نیست.',
      'inventory_movement', m.id, m.posting_seq::text, m.movement_date, abs(m.value_delta), null, m.value_delta,
      jsonb_build_object('inventory_document_id', m.inventory_document_id, 'inventory_document_line_id', m.inventory_document_line_id, 'item_id', m.item_id, 'warehouse_id', m.warehouse_id, 'quantity_delta', m.quantity_delta),
      'repair_source_link'
    from public.inventory_movements m
    left join public.inventory_documents d on d.id = m.inventory_document_id and d.workspace_id = m.workspace_id
    left join public.inventory_document_lines l on l.id = m.inventory_document_line_id and l.workspace_id = m.workspace_id
    where m.workspace_id = wid and (d.id is null or l.id is null)

    union all
    select
      'posted_inventory_document_without_movement','high','inventory','سند انبار ثبت‌شده بدون گردش موجودی',
      'سند انبار Posted و دارای ردیف است اما هیچ حرکت موجودی برای آن ثبت نشده است.',
      'inventory_document', d.id, d.document_no::text, d.document_date, null, null, null,
      jsonb_build_object('document_type', d.document_type, 'source_type', d.source_type, 'source_id', d.source_id),
      'review_inventory_posting'
    from public.inventory_documents d
    where d.workspace_id = wid and d.status = 'posted'
      and exists (select 1 from public.inventory_document_lines l where l.workspace_id=wid and l.inventory_document_id=d.id)
      and not exists (select 1 from public.inventory_movements m where m.workspace_id=wid and m.inventory_document_id=d.id)

    union all
    select
      'orphan_settlement_schedule','critical','settlement','سررسید تسویه بدون فاکتور',
      'ردیف برنامه تسویه به فاکتور معتبر متصل نیست.',
      'settlement_schedule', s.id, s.installment_no::text, s.due_date, s.amount, null, s.amount,
      jsonb_build_object('invoice_id', s.invoice_id, 'status', s.status, 'planned_method', s.planned_method),
      'repair_source_link'
    from public.invoice_settlement_schedule s
    left join public.invoices i on i.id=s.invoice_id and i.workspace_id=s.workspace_id
    where s.workspace_id=wid and i.id is null

    union all
    select
      'settlement_total_mismatch','high','settlement','اختلاف جمع شرایط تسویه با فاکتور',
      'جمع مبالغ برنامه تسویه دقیقاً با جمع نهایی فاکتور برابر نیست.',
      'invoice', i.id, i.invoice_no::text, i.invoice_date, i.total_amount, i.total_amount, coalesce(st.scheduled_total,0),
      jsonb_build_object('plan_type', p.plan_type, 'schedule_count', coalesce(st.schedule_count,0), 'scheduled_total', coalesce(st.scheduled_total,0)),
      'review_settlement_plan'
    from public.invoice_settlement_plans p
    join public.invoices i on i.id=p.invoice_id and i.workspace_id=p.workspace_id
    left join schedule_totals st on st.invoice_id=i.id
    where p.workspace_id=wid and coalesce(st.scheduled_total,0) <> coalesce(i.total_amount,0)

    union all
    select
      'settled_schedule_missing_journal','high','settlement','تسویه انجام‌شده بدون سند حسابداری',
      'سررسید تسویه‌شده است اما سند حسابداری تسویه به آن متصل نیست.',
      'settlement_schedule', s.id, s.installment_no::text, s.due_date, coalesce(s.settled_amount,s.amount), s.amount, s.settled_amount,
      jsonb_build_object('invoice_id', s.invoice_id, 'planned_method', s.planned_method, 'financial_account_id', s.financial_account_id),
      'review_settlement_posting'
    from public.invoice_settlement_schedule s
    where s.workspace_id=wid and s.status='settled' and s.settlement_journal_entry_id is null

    union all
    select
      'financial_transaction_missing_journal','critical','cashbank','دریافت/پرداخت/انتقال بدون سند حسابداری',
      'تراکنش مالی Posted است اما سند حسابداری مرجع ندارد.',
      'financial_transaction', t.id, null, t.tx_date, t.amount, t.amount, null,
      jsonb_build_object('tx_type', t.tx_type, 'party_id', t.party_id, 'from_account_id', t.from_account_id, 'to_account_id', t.to_account_id, 'counterpart_account_id', t.counterpart_account_id, 'description', t.description),
      'journal_from_transaction'
    from public.financial_transactions t
    where t.workspace_id=wid and t.status='posted' and t.journal_entry_id is null

    union all
    select
      'check_missing_recognition_journal','critical','check','چک در جریان بدون سند شناسایی',
      'چک دریافتنی/پرداختنی در جریان است اما سند شناسایی حسابداری ندارد.',
      'financial_check', c.id, c.check_number, c.issue_date, c.amount, c.amount, null,
      jsonb_build_object('direction', c.direction, 'bank_name', c.bank_name, 'party_id', c.party_id, 'invoice_id', c.invoice_id, 'schedule_id', c.schedule_id, 'status', c.status),
      'review_check_posting'
    from public.financial_checks c
    where c.workspace_id=wid and c.status in ('received','issued','cleared','bounced') and c.recognition_journal_entry_id is null

    union all
    select
      'cleared_check_missing_journal','critical','check','چک وصول/پاس‌شده بدون سند تسویه',
      'وضعیت چک وصول/پاس‌شده است اما سند حسابداری مربوط به clearance وجود ندارد.',
      'financial_check', c.id, c.check_number, c.due_date, c.amount, c.amount, null,
      jsonb_build_object('direction', c.direction, 'bank_name', c.bank_name, 'status', c.status),
      'review_check_posting'
    from public.financial_checks c
    where c.workspace_id=wid and c.status='cleared' and c.clearance_journal_entry_id is null

    union all
    select
      'bounced_check_missing_journal','critical','check','چک برگشتی بدون سند برگشت',
      'چک برگشتی است اما سند حسابداری برگشت به آن متصل نیست.',
      'financial_check', c.id, c.check_number, c.due_date, c.amount, c.amount, null,
      jsonb_build_object('direction', c.direction, 'bank_name', c.bank_name, 'status', c.status),
      'review_check_posting'
    from public.financial_checks c
    where c.workspace_id=wid and c.status='bounced' and c.bounce_journal_entry_id is null

    union all
    select
      'linked_document_missing_journal','high','smart_document','سند هوشمند لینک‌شده بدون سند حسابداری معتبر',
      'سند هوشمند لینک‌شده است اما مرجع سند حسابداری آن خالی یا نامعتبر است.',
      'document', d.id, d.file_name, d.source_document_date, d.total_amount, null, d.total_amount,
      jsonb_build_object('document_type', d.document_type, 'status', d.status, 'linked_journal_entry_id', d.linked_journal_entry_id),
      'review_document_link'
    from public.documents d
    left join public.journal_entries je on je.id=d.linked_journal_entry_id and je.workspace_id=d.workspace_id
    where d.workspace_id=wid and (d.status='linked' or d.linked_journal_entry_id is not null) and je.id is null

    union all
    select
      'possible_duplicate_invoice','medium','duplicate','فاکتورهای احتمالاً تکراری',
      'چند فاکتور غیر‌برگشتی با نوع، طرف‌حساب، تاریخ و مبلغ یکسان یافت شد؛ نیازمند بررسی انسانی است.',
      'invoice_group', d.ids[1], d.invoice_nos, d.invoice_date, d.total_amount, null, d.total_amount,
      jsonb_build_object('invoice_type', d.invoice_type, 'party_id', d.party_id, 'duplicate_count', d.duplicate_count, 'ids', to_jsonb(d.ids)),
      'review_duplicate'
    from invoice_duplicates d

    union all
    select
      'possible_duplicate_financial_transaction','medium','duplicate','تراکنش‌های مالی احتمالاً تکراری',
      'چند تراکنش Posted با نوع، تاریخ، مبلغ و حساب‌های یکسان یافت شد؛ نیازمند بررسی انسانی است.',
      'financial_transaction_group', d.ids[1], null, d.tx_date, d.amount, null, d.amount,
      jsonb_build_object('tx_type', d.tx_type, 'party_id', d.party_id, 'from_account_id', d.from_account_id, 'to_account_id', d.to_account_id, 'counterpart_account_id', d.counterpart_account_id, 'duplicate_count', d.duplicate_count, 'ids', to_jsonb(d.ids)),
      'review_duplicate'
    from transaction_duplicates d

    union all
    select
      'duplicate_smart_document_file','medium','duplicate','فایل سند هوشمند تکراری',
      'چند سند هوشمند با هش فایل یکسان ثبت شده است.',
      'document_group', d.ids[1], d.file_names, null, null, null, null,
      jsonb_build_object('file_hash', d.file_hash, 'duplicate_count', d.duplicate_count, 'ids', to_jsonb(d.ids)),
      'review_duplicate'
    from document_duplicates d
  ),
  materialized as (select * from findings)
  select jsonb_build_object(
    'generated_at', now(),
    'workspace_id', wid,
    'summary', jsonb_build_object(
      'total', count(*),
      'critical', count(*) filter (where severity='critical'),
      'high', count(*) filter (where severity='high'),
      'medium', count(*) filter (where severity='medium'),
      'info', count(*) filter (where severity='info')
    ),
    'findings', coalesce(jsonb_agg(
      jsonb_build_object(
        'code', code, 'severity', severity, 'category', category, 'title', title, 'description', description,
        'entity_type', entity_type, 'entity_id', entity_id, 'entity_no', entity_no, 'event_date', event_date,
        'amount', amount, 'expected', expected, 'actual', actual, 'metadata', metadata, 'suggestion_type', suggestion_type
      ) order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end, event_date desc nulls last, title
    ), '[]'::jsonb)
  ) into result
  from materialized;

  return result;
end;
$$;

revoke all on function public.avan_reconciliation_findings(uuid) from public, anon;
grant execute on function public.avan_reconciliation_findings(uuid) to authenticated;
