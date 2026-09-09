-- RC1.5 custom report composite v2
-- Read-only, Company-scoped, SECURITY INVOKER reporting contract.

alter table public.custom_reports
  drop constraint if exists custom_reports_source_key_check;

alter table public.custom_reports
  add constraint custom_reports_source_key_check check (source_key = any (array[
    'composite_events'::text,
    'invoices'::text,
    'invoice_lines'::text,
    'journals'::text,
    'journal_lines'::text,
    'transactions'::text,
    'settlements'::text,
    'checks'::text,
    'parties'::text,
    'accounts'::text,
    'financial_accounts'::text,
    'inventory_items'::text,
    'inventory_stock'::text,
    'inventory_movements'::text,
    'inventory_documents'::text,
    'smart_documents'::text
  ]));

create or replace function public.run_custom_report(
  wid uuid,
  p_source_key text,
  p_from date default null,
  p_to date default null,
  p_limit integer default 500
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_from date := coalesce(p_from, '1900-01-01'::date);
  v_to date := coalesce(p_to, '2999-12-31'::date);
  v_rows jsonb;
begin
  if wid is null or not public.has_workspace_access(wid) then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;
  if v_to < v_from then
    raise exception 'REPORT_DATE_RANGE_INVALID';
  end if;

  if p_source_key = 'invoices' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_date desc, x.invoice_no desc nulls last), '[]'::jsonb)
    into v_rows
    from (
      select i.id,i.invoice_no,i.invoice_date,i.invoice_type,i.status,p.name as party_name,
             i.subtotal_amount,i.tax_total,i.total_amount
      from public.invoices i
      left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      where i.workspace_id=wid and i.invoice_date between v_from and v_to
      order by i.invoice_date desc,i.invoice_no desc nulls last
      limit v_limit
    ) x;

  elsif p_source_key = 'invoice_lines' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_date desc,x.invoice_no desc nulls last,x.line_no), '[]'::jsonb)
    into v_rows
    from (
      select i.invoice_no,i.invoice_date,i.invoice_type,i.status,p.name as party_name,
             il.line_no,it.sku as item_sku,it.name as item_name,w.name as warehouse_name,
             il.description,il.quantity,il.unit_price,il.discount,il.line_total,il.tax_rate,
             il.taxable_amount,il.tax_amount,il.tax_profile_name_fa as tax_profile_name
      from public.invoice_lines il
      join public.invoices i on i.id=il.invoice_id and i.workspace_id=il.workspace_id
      left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      left join public.inventory_items it on it.id=il.item_id and it.workspace_id=il.workspace_id
      left join public.warehouses w on w.id=il.warehouse_id and w.workspace_id=il.workspace_id
      where il.workspace_id=wid and i.invoice_date between v_from and v_to
      order by i.invoice_date desc,i.invoice_no desc nulls last,il.line_no
      limit v_limit
    ) x;

  elsif p_source_key = 'journals' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc,x.journal_no desc nulls last), '[]'::jsonb)
    into v_rows
    from (
      select j.id,j.journal_no,j.entry_date,j.description,j.status,j.source_type,
             coalesce(sum(l.debit),0::numeric) as debit_total,
             coalesce(sum(l.credit),0::numeric) as credit_total
      from public.journal_entries j
      left join public.journal_lines l on l.journal_entry_id=j.id and l.workspace_id=j.workspace_id
      where j.workspace_id=wid and j.entry_date between v_from and v_to
      group by j.id,j.journal_no,j.entry_date,j.description,j.status,j.source_type
      order by j.entry_date desc,j.journal_no desc nulls last
      limit v_limit
    ) x;

  elsif p_source_key = 'journal_lines' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc,x.journal_no desc nulls last,x.line_no), '[]'::jsonb)
    into v_rows
    from (
      select j.journal_no,j.entry_date,j.status,j.source_type,l.line_no,a.code as account_code,a.name as account_name,
             p.name as party_name,l.description,l.debit,l.credit
      from public.journal_lines l
      join public.journal_entries j on j.id=l.journal_entry_id and j.workspace_id=l.workspace_id
      join public.accounts a on a.id=l.account_id and a.workspace_id=l.workspace_id
      left join public.parties p on p.id=l.party_id and p.workspace_id=l.workspace_id
      where l.workspace_id=wid and j.entry_date between v_from and v_to
      order by j.entry_date desc,j.journal_no desc nulls last,l.line_no
      limit v_limit
    ) x;

  elsif p_source_key = 'transactions' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.tx_date desc), '[]'::jsonb)
    into v_rows
    from (
      select t.id,t.tx_date,t.tx_type,p.name as party_name,t.amount,
             concat_ws(' — ',fa.code,fa.name) as from_account,
             concat_ws(' — ',ta.code,ta.name) as to_account,
             concat_ws(' — ',ca.code,ca.name) as counterpart_account,
             t.description,t.status
      from public.financial_transactions t
      left join public.parties p on p.id=t.party_id and p.workspace_id=t.workspace_id
      left join public.accounts fa on fa.id=t.from_account_id and fa.workspace_id=t.workspace_id
      left join public.accounts ta on ta.id=t.to_account_id and ta.workspace_id=t.workspace_id
      left join public.accounts ca on ca.id=t.counterpart_account_id and ca.workspace_id=t.workspace_id
      where t.workspace_id=wid and t.tx_date between v_from and v_to
      order by t.tx_date desc,t.created_at desc
      limit v_limit
    ) x;

  elsif p_source_key = 'settlements' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date desc,x.invoice_no desc nulls last,x.installment_no), '[]'::jsonb)
    into v_rows
    from (
      select i.invoice_no,i.invoice_date,p.name as party_name,s.installment_no,s.due_date,s.planned_method,
             s.amount,s.settled_amount,s.status,concat_ws(' — ',a.code,a.name) as financial_account,s.check_number
      from public.invoice_settlement_schedule s
      join public.invoices i on i.id=s.invoice_id and i.workspace_id=s.workspace_id
      left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      left join public.financial_accounts f on f.id=s.financial_account_id and f.workspace_id=s.workspace_id
      left join public.accounts a on a.id=f.ledger_account_id and a.workspace_id=f.workspace_id
      where s.workspace_id=wid and coalesce(s.due_date,i.invoice_date) between v_from and v_to
      order by s.due_date desc nulls last,i.invoice_no desc nulls last,s.installment_no
      limit v_limit
    ) x;

  elsif p_source_key = 'checks' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date desc nulls last,x.issue_date desc nulls last), '[]'::jsonb)
    into v_rows
    from (
      select c.issue_date,c.due_date,c.direction,c.check_number,c.bank_name,c.branch,c.account_number,
             p.name as party_name,i.invoice_no,c.amount,c.status
      from public.financial_checks c
      left join public.parties p on p.id=c.party_id and p.workspace_id=c.workspace_id
      left join public.invoices i on i.id=c.invoice_id and i.workspace_id=c.workspace_id
      where c.workspace_id=wid and coalesce(c.issue_date,c.due_date,c.created_at::date) between v_from and v_to
      order by c.due_date desc nulls last,c.issue_date desc nulls last,c.created_at desc
      limit v_limit
    ) x;

  elsif p_source_key = 'parties' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb)
    into v_rows
    from (
      select p.id,p.name,p.kind,p.phone,p.email,p.national_id,p.economic_code,p.postal_code,p.is_active
      from public.parties p where p.workspace_id=wid order by p.name limit v_limit
    ) x;

  elsif p_source_key = 'accounts' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.code), '[]'::jsonb)
    into v_rows
    from (
      select a.id,a.code,a.name,a.level,a.category,a.normal_balance,a.is_postable,a.is_system,a.is_active
      from public.accounts a where a.workspace_id=wid order by a.code limit v_limit
    ) x;

  elsif p_source_key = 'financial_accounts' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.kind,x.bank_name,x.account_number), '[]'::jsonb)
    into v_rows
    from (
      select f.id,f.kind,a.code as ledger_code,a.name as ledger_name,f.bank_name,f.account_number,
             f.card_number,f.iban,f.branch_name,f.is_active
      from public.financial_accounts f
      left join public.accounts a on a.id=f.ledger_account_id and a.workspace_id=f.workspace_id
      where f.workspace_id=wid order by f.kind,f.bank_name,f.account_number limit v_limit
    ) x;

  elsif p_source_key = 'inventory_items' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.item_name), '[]'::jsonb)
    into v_rows
    from (
      select i.id,i.sku,i.barcode,i.name as item_name,i.item_type,g.name as group_name,u.name as unit_name,
             u.symbol as unit_symbol,i.min_stock,i.is_active
      from public.inventory_items i
      left join public.inventory_item_groups g on g.id=i.group_id and g.workspace_id=i.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      where i.workspace_id=wid order by i.name limit v_limit
    ) x;

  elsif p_source_key = 'inventory_stock' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.item_name,x.warehouse_name), '[]'::jsonb)
    into v_rows
    from (
      select oh.item_id,oh.warehouse_id,i.sku,i.name as item_name,w.name as warehouse_name,u.name as unit_name,
             u.symbol as unit_symbol,oh.quantity_on_hand,oh.inventory_value,oh.average_unit_cost,i.min_stock,
             coalesce(oh.quantity_on_hand,0) < coalesce(i.min_stock,0) as below_min_stock
      from public.inventory_on_hand oh
      join public.inventory_items i on i.id=oh.item_id and i.workspace_id=oh.workspace_id
      join public.warehouses w on w.id=oh.warehouse_id and w.workspace_id=oh.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      where oh.workspace_id=wid order by i.name,w.name limit v_limit
    ) x;

  elsif p_source_key = 'inventory_movements' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.movement_date desc,x.posting_seq desc), '[]'::jsonb)
    into v_rows
    from (
      select m.id,m.posting_seq,m.movement_date,i.sku,i.name as item_name,w.name as warehouse_name,
             u.name as unit_name,u.symbol as unit_symbol,m.quantity_delta,m.unit_cost,m.value_delta,
             d.document_no,d.document_type,d.status as document_status
      from public.inventory_movements m
      join public.inventory_items i on i.id=m.item_id and i.workspace_id=m.workspace_id
      join public.warehouses w on w.id=m.warehouse_id and w.workspace_id=m.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      left join public.inventory_documents d on d.id=m.inventory_document_id and d.workspace_id=m.workspace_id
      where m.workspace_id=wid and m.movement_date between v_from and v_to
      order by m.movement_date desc,m.posting_seq desc limit v_limit
    ) x;

  elsif p_source_key = 'inventory_documents' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.document_date desc,x.document_no desc nulls last), '[]'::jsonb)
    into v_rows
    from (
      select d.document_no,d.document_date,d.document_type,d.status,d.source_type,d.description,j.journal_no
      from public.inventory_documents d
      left join public.journal_entries j on j.id=d.journal_entry_id and j.workspace_id=d.workspace_id
      where d.workspace_id=wid and d.document_date between v_from and v_to
      order by d.document_date desc,d.document_no desc nulls last limit v_limit
    ) x;

  elsif p_source_key = 'smart_documents' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.source_document_date desc nulls last), '[]'::jsonb)
    into v_rows
    from (
      select d.source_document_date,d.document_type,d.status,d.file_name,d.mime_type,d.size_bytes,
             p.name as party_name,d.total_amount,j.journal_no
      from public.documents d
      left join public.parties p on p.id=d.party_id and p.workspace_id=d.workspace_id
      left join public.journal_entries j on j.id=d.linked_journal_entry_id and j.workspace_id=d.workspace_id
      where d.workspace_id=wid and coalesce(d.source_document_date,d.created_at::date) between v_from and v_to
      order by d.source_document_date desc nulls last,d.created_at desc limit v_limit
    ) x;

  elsif p_source_key = 'composite_events' then
    with events as (
      select i.invoice_date as event_date,i.created_at as created_at,
        jsonb_build_object(
          'event_date',i.invoice_date,'event_domain','فاکتور','event_type',i.invoice_type,'reference_no',i.invoice_no::text,'status',i.status,'description',i.description,
          'company_name',w.name,'base_currency',w.base_currency,'party_name',p.name,'party_kind',p.kind,
          'invoice_no',i.invoice_no::text,'invoice_type',i.invoice_type,'invoice_due_date',i.due_date,'invoice_subtotal',i.subtotal_amount,'invoice_tax',i.tax_total,'invoice_total',i.total_amount,
          'journal_no',j.journal_no::text,'journal_source',j.source_type
        ) as row_data
      from public.invoices i
      join public.workspaces w on w.id=i.workspace_id
      left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      left join public.journal_entries j on j.id=i.journal_entry_id and j.workspace_id=i.workspace_id
      where i.workspace_id=wid and i.invoice_date between v_from and v_to

      union all
      select j.entry_date,j.created_at,
        jsonb_build_object(
          'event_date',j.entry_date,'event_domain','سند حسابداری','event_type',j.source_type,'reference_no',j.journal_no::text,'status',j.status,'description',j.description,
          'company_name',w.name,'base_currency',w.base_currency,'journal_no',j.journal_no::text,'journal_source',j.source_type,
          'journal_debit',coalesce(t.debit_total,0::numeric),'journal_credit',coalesce(t.credit_total,0::numeric)
        )
      from public.journal_entries j
      join public.workspaces w on w.id=j.workspace_id
      left join lateral (
        select sum(l.debit) as debit_total,sum(l.credit) as credit_total
        from public.journal_lines l where l.workspace_id=j.workspace_id and l.journal_entry_id=j.id
      ) t on true
      where j.workspace_id=wid and j.entry_date between v_from and v_to

      union all
      select t.tx_date,t.created_at,
        jsonb_build_object(
          'event_date',t.tx_date,'event_domain','خزانه','event_type',t.tx_type,'reference_no',left(t.id::text,8),'status',t.status,'description',t.description,
          'company_name',w.name,'base_currency',w.base_currency,'party_name',p.name,'party_kind',p.kind,
          'transaction_type',t.tx_type,'transaction_amount',t.amount,
          'from_account',concat_ws(' — ',fa.code,fa.name),'to_account',concat_ws(' — ',ta.code,ta.name),'counterpart_account',concat_ws(' — ',ca.code,ca.name),
          'journal_no',j.journal_no::text,'journal_source',j.source_type
        )
      from public.financial_transactions t
      join public.workspaces w on w.id=t.workspace_id
      left join public.parties p on p.id=t.party_id and p.workspace_id=t.workspace_id
      left join public.accounts fa on fa.id=t.from_account_id and fa.workspace_id=t.workspace_id
      left join public.accounts ta on ta.id=t.to_account_id and ta.workspace_id=t.workspace_id
      left join public.accounts ca on ca.id=t.counterpart_account_id and ca.workspace_id=t.workspace_id
      left join public.journal_entries j on j.id=t.journal_entry_id and j.workspace_id=t.workspace_id
      where t.workspace_id=wid and t.tx_date between v_from and v_to

      union all
      select m.movement_date,m.created_at,
        jsonb_build_object(
          'event_date',m.movement_date,'event_domain','انبار','event_type',d.document_type,'reference_no',d.document_no::text,'status',d.status,'description',d.description,
          'company_name',ws.name,'base_currency',ws.base_currency,'inventory_document_no',d.document_no::text,'inventory_document_type',d.document_type,
          'item_sku',it.sku,'item_name',it.name,'warehouse_name',wh.name,'quantity',m.quantity_delta,'unit_cost',m.unit_cost,'inventory_value',m.value_delta,
          'journal_no',j.journal_no::text,'journal_source',j.source_type
        )
      from public.inventory_movements m
      join public.workspaces ws on ws.id=m.workspace_id
      join public.inventory_items it on it.id=m.item_id and it.workspace_id=m.workspace_id
      join public.warehouses wh on wh.id=m.warehouse_id and wh.workspace_id=m.workspace_id
      left join public.inventory_documents d on d.id=m.inventory_document_id and d.workspace_id=m.workspace_id
      left join public.journal_entries j on j.id=d.journal_entry_id and j.workspace_id=d.workspace_id
      where m.workspace_id=wid and m.movement_date between v_from and v_to

      union all
      select coalesce(s.due_date,i.invoice_date),s.created_at,
        jsonb_build_object(
          'event_date',coalesce(s.due_date,i.invoice_date),'event_domain','تسویه','event_type',s.planned_method,'reference_no',concat(i.invoice_no::text,'/',s.installment_no::text),'status',s.status,
          'company_name',w.name,'base_currency',w.base_currency,'party_name',p.name,'party_kind',p.kind,'invoice_no',i.invoice_no::text,'invoice_type',i.invoice_type,
          'settlement_due_date',s.due_date,'settlement_method',s.planned_method,'settlement_amount',s.amount,'settled_amount',s.settled_amount,
          'check_number',s.check_number,'check_bank_name',s.check_bank_name
        )
      from public.invoice_settlement_schedule s
      join public.invoices i on i.id=s.invoice_id and i.workspace_id=s.workspace_id
      join public.workspaces w on w.id=s.workspace_id
      left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      where s.workspace_id=wid and coalesce(s.due_date,i.invoice_date) between v_from and v_to

      union all
      select coalesce(c.issue_date,c.due_date,c.created_at::date),c.created_at,
        jsonb_build_object(
          'event_date',coalesce(c.issue_date,c.due_date,c.created_at::date),'event_domain','چک','event_type',c.direction,'reference_no',c.check_number,'status',c.status,
          'company_name',w.name,'base_currency',w.base_currency,'party_name',p.name,'party_kind',p.kind,'invoice_no',i.invoice_no::text,
          'check_number',c.check_number,'check_bank_name',c.bank_name,'check_direction',c.direction,'check_due_date',c.due_date,'transaction_amount',c.amount
        )
      from public.financial_checks c
      join public.workspaces w on w.id=c.workspace_id
      left join public.parties p on p.id=c.party_id and p.workspace_id=c.workspace_id
      left join public.invoices i on i.id=c.invoice_id and i.workspace_id=c.workspace_id
      where c.workspace_id=wid and coalesce(c.issue_date,c.due_date,c.created_at::date) between v_from and v_to

      union all
      select coalesce(d.source_document_date,d.created_at::date),d.created_at,
        jsonb_build_object(
          'event_date',coalesce(d.source_document_date,d.created_at::date),'event_domain','اسناد هوشمند','event_type',d.document_type,'reference_no',left(d.id::text,8),'status',d.status,
          'company_name',w.name,'base_currency',w.base_currency,'party_name',p.name,'party_kind',p.kind,
          'smart_document_type',d.document_type,'smart_document_status',d.status,'smart_document_file_name',d.file_name,'smart_document_amount',d.total_amount,
          'journal_no',j.journal_no::text,'journal_source',j.source_type
        )
      from public.documents d
      join public.workspaces w on w.id=d.workspace_id
      left join public.parties p on p.id=d.party_id and p.workspace_id=d.workspace_id
      left join public.journal_entries j on j.id=d.linked_journal_entry_id and j.workspace_id=d.workspace_id
      where d.workspace_id=wid and coalesce(d.source_document_date,d.created_at::date) between v_from and v_to
    ), limited as (
      select event_date,created_at,row_data from events order by event_date desc,created_at desc limit v_limit
    )
    select coalesce(jsonb_agg(row_data order by event_date desc,created_at desc),'[]'::jsonb) into v_rows from limited;

  else
    raise exception 'REPORT_SOURCE_INVALID';
  end if;

  return jsonb_build_object('source',p_source_key,'from',p_from,'to',p_to,'rows',coalesce(v_rows,'[]'::jsonb));
end;
$$;

revoke all on function public.run_custom_report(uuid,text,date,date,integer) from public, anon;
grant execute on function public.run_custom_report(uuid,text,date,date,integer) to authenticated;
