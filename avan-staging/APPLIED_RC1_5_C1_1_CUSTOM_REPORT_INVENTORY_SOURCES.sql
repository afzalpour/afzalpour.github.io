-- Applied to Avan-production on 2026-09-08.
-- Adds safe Company-scoped inventory sources to the existing custom report runner.

create or replace function public.run_custom_report(
  wid uuid,
  p_source_key text,
  p_from date default null,
  p_to date default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,500),1000));
  v_from date:=coalesce(p_from,'1900-01-01'::date);
  v_to date:=coalesce(p_to,'2999-12-31'::date);
  v_rows jsonb;
begin
  if wid is null or not public.has_workspace_access(wid) then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
  if v_to<v_from then raise exception 'REPORT_DATE_RANGE_INVALID'; end if;

  if p_source_key='invoices' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_date desc,x.invoice_no desc nulls last),'[]'::jsonb) into v_rows
    from (select i.id,i.invoice_no,i.invoice_date,i.invoice_type,i.status,p.name as party_name,i.subtotal_amount,i.tax_total,i.total_amount
      from public.invoices i left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id
      where i.workspace_id=wid and i.invoice_date between v_from and v_to order by i.invoice_date desc,i.invoice_no desc nulls last limit v_limit) x;
  elsif p_source_key='journals' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc,x.journal_no desc nulls last),'[]'::jsonb) into v_rows
    from (select j.id,j.journal_no,j.entry_date,j.description,j.status,j.source_type,coalesce(sum(l.debit),0)::bigint as debit_total,coalesce(sum(l.credit),0)::bigint as credit_total
      from public.journal_entries j left join public.journal_lines l on l.journal_entry_id=j.id and l.workspace_id=j.workspace_id
      where j.workspace_id=wid and j.entry_date between v_from and v_to group by j.id,j.journal_no,j.entry_date,j.description,j.status,j.source_type
      order by j.entry_date desc,j.journal_no desc nulls last limit v_limit) x;
  elsif p_source_key='transactions' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.tx_date desc),'[]'::jsonb) into v_rows
    from (select t.id,t.tx_date,t.tx_type,t.amount,t.description,t.status,p.name as party_name
      from public.financial_transactions t left join public.parties p on p.id=t.party_id and p.workspace_id=t.workspace_id
      where t.workspace_id=wid and t.tx_date between v_from and v_to order by t.tx_date desc,t.created_at desc limit v_limit) x;
  elsif p_source_key='parties' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_rows
    from (select p.id,p.name,p.kind,p.phone,p.email,p.national_id,p.is_active from public.parties p where p.workspace_id=wid order by p.name limit v_limit) x;
  elsif p_source_key='inventory_items' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.item_name),'[]'::jsonb) into v_rows
    from (select i.id,i.sku,i.barcode,i.name as item_name,i.item_type,g.name as group_name,u.name as unit_name,u.symbol as unit_symbol,i.min_stock,i.is_active
      from public.inventory_items i left join public.inventory_item_groups g on g.id=i.group_id and g.workspace_id=i.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      where i.workspace_id=wid order by i.name limit v_limit) x;
  elsif p_source_key='inventory_stock' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.item_name,x.warehouse_name),'[]'::jsonb) into v_rows
    from (select oh.item_id,oh.warehouse_id,i.sku,i.name as item_name,w.name as warehouse_name,u.name as unit_name,u.symbol as unit_symbol,
      oh.quantity_on_hand,oh.inventory_value,oh.average_unit_cost,i.min_stock,
      case when coalesce(oh.quantity_on_hand,0) < coalesce(i.min_stock,0) then true else false end as below_min_stock
      from public.inventory_on_hand oh join public.inventory_items i on i.id=oh.item_id and i.workspace_id=oh.workspace_id
      join public.warehouses w on w.id=oh.warehouse_id and w.workspace_id=oh.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      where oh.workspace_id=wid order by i.name,w.name limit v_limit) x;
  elsif p_source_key='inventory_movements' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.movement_date desc,x.posting_seq desc),'[]'::jsonb) into v_rows
    from (select m.id,m.posting_seq,m.movement_date,i.sku,i.name as item_name,w.name as warehouse_name,u.name as unit_name,u.symbol as unit_symbol,
      m.quantity_delta,m.unit_cost,m.value_delta,d.document_no,d.document_type,d.status as document_status
      from public.inventory_movements m join public.inventory_items i on i.id=m.item_id and i.workspace_id=m.workspace_id
      join public.warehouses w on w.id=m.warehouse_id and w.workspace_id=m.workspace_id
      left join public.inventory_units u on u.id=i.base_unit_id and u.workspace_id=i.workspace_id
      left join public.inventory_documents d on d.id=m.inventory_document_id and d.workspace_id=m.workspace_id
      where m.workspace_id=wid and m.movement_date between v_from and v_to order by m.movement_date desc,m.posting_seq desc limit v_limit) x;
  else
    raise exception 'REPORT_SOURCE_INVALID';
  end if;

  return jsonb_build_object('source',p_source_key,'from',p_from,'to',p_to,'rows',coalesce(v_rows,'[]'::jsonb));
end;
$$;

revoke execute on function public.run_custom_report(uuid,text,date,date,integer) from public, anon;
grant execute on function public.run_custom_report(uuid,text,date,date,integer) to authenticated;
