-- Avan RC1.4-D1 Invoice/Inventory hardening
-- Mandatory companion to RC1_4_D_SALES_PURCHASE_INVENTORY_INTEGRATION_DRAFT.sql
-- STATUS: NOT APPLIED TO PRODUCTION.

-- Preserve up to six quantity decimals for item-based invoice lines even though the
-- legacy financial draft helper internally uses numeric(20,3). The legacy helper is
-- retained as the financial validator; this wrapper restores the validated exact item
-- quantity and recomputes canonical integer-Toman line/total amounts deterministically.
create or replace function private.save_draft_invoice_with_inventory(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_invoice_id uuid,
  p_invoice_type text,
  p_invoice_date date,
  p_due_date date,
  p_party_id uuid,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb := coalesce(p_lines,'[]'::jsonb);
  v_fin_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_norm jsonb;
  v_iid uuid;
  v_idx integer := 0;
  v_item_id uuid;
  v_unit_id uuid;
  v_warehouse_id uuid;
  v_receipt_line_id uuid;
  v_item_type text;
  v_base_unit uuid;
  v_decimal_places smallint;
  v_qty numeric(20,6);
  v_price numeric(20,0);
  v_discount numeric(20,0);
  v_gross numeric(30,0);
  v_line_total numeric(20,0);
  v_inventory_asset uuid;
  v_grni uuid;
begin
  if jsonb_typeof(v_lines) <> 'array' then raise exception 'LINES_MUST_BE_ARRAY'; end if;
  perform private.assert_financial_write_access(p_workspace_id);
  perform private.ensure_inventory_account_roles(p_workspace_id);

  select ar.account_id into v_inventory_asset from public.account_roles ar
   where ar.workspace_id=p_workspace_id and ar.role_key='inventory_asset';
  select ar.account_id into v_grni from public.account_roles ar
   where ar.workspace_id=p_workspace_id and ar.role_key='inventory_grni';
  if v_inventory_asset is null or v_grni is null then raise exception 'INVENTORY_ACCOUNT_ROLE_MISSING'; end if;

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_norm:=v_item;
    v_item_id:=nullif(v_item->>'item_id','')::uuid;
    v_unit_id:=nullif(v_item->>'unit_id','')::uuid;
    v_warehouse_id:=nullif(v_item->>'warehouse_id','')::uuid;
    v_receipt_line_id:=nullif(v_item->>'receipt_line_id','')::uuid;

    if v_item_id is not null then
      v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1)::numeric(20,6);
      v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,0)::numeric(20,0);
      v_discount:=coalesce(nullif(v_item->>'discount','')::numeric,0)::numeric(20,0);
      if v_qty<=0 or v_price<0 or v_discount<0 then raise exception 'INVOICE_LINE_INVALID'; end if;

      select ii.item_type,ii.base_unit_id,iu.decimal_places
        into v_item_type,v_base_unit,v_decimal_places
      from public.inventory_items ii
      join public.inventory_units iu on iu.id=ii.base_unit_id and iu.workspace_id=ii.workspace_id
      where ii.id=v_item_id and ii.workspace_id=p_workspace_id and ii.is_active and iu.is_active;
      if v_item_type is null then raise exception 'INVENTORY_ITEM_INVALID'; end if;

      v_unit_id:=coalesce(v_unit_id,v_base_unit);
      if v_unit_id is distinct from v_base_unit then raise exception 'INVOICE_ITEM_UNIT_MUST_BE_BASE_UNIT'; end if;
      if v_qty is distinct from round(v_qty,v_decimal_places) then raise exception 'INVOICE_QUANTITY_SCALE_INVALID'; end if;

      if v_item_type='inventory' and p_invoice_type='sale' then
        if v_warehouse_id is null or v_receipt_line_id is not null then raise exception 'SALE_INVENTORY_METADATA_INVALID'; end if;
      elsif v_item_type='inventory' and p_invoice_type='purchase' then
        if v_receipt_line_id is null or v_warehouse_id is not null then raise exception 'PURCHASE_INVENTORY_METADATA_INVALID'; end if;
        v_norm:=jsonb_set(v_norm,'{account_id}',to_jsonb(v_inventory_asset::text),true);
      else
        if v_warehouse_id is not null or v_receipt_line_id is not null then raise exception 'NON_INVENTORY_LINE_MUST_BE_STOCK_NEUTRAL'; end if;
      end if;

      -- Let the legacy helper validate the financial account/party semantics using a
      -- three-decimal compatibility quantity; exact item quantity is restored below.
      v_norm:=jsonb_set(v_norm,'{quantity}',to_jsonb(round(v_qty,3)),true);
    else
      if v_unit_id is not null or v_warehouse_id is not null or v_receipt_line_id is not null then
        raise exception 'INVOICE_STOCK_METADATA_WITHOUT_ITEM';
      end if;
    end if;

    v_fin_lines:=v_fin_lines||jsonb_build_array(v_norm);
  end loop;

  v_iid:=private.save_draft_invoice(
    p_workspace_id,p_fiscal_year_id,p_invoice_id,p_invoice_type,p_invoice_date,p_due_date,
    p_party_id,p_description,v_fin_lines
  );

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_idx:=v_idx+1;
    v_item_id:=nullif(v_item->>'item_id','')::uuid;
    v_unit_id:=nullif(v_item->>'unit_id','')::uuid;
    v_warehouse_id:=nullif(v_item->>'warehouse_id','')::uuid;
    v_receipt_line_id:=nullif(v_item->>'receipt_line_id','')::uuid;
    v_item_type:=null;
    v_base_unit:=null;

    if v_item_id is not null then
      v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1)::numeric(20,6);
      v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,0)::numeric(20,0);
      v_discount:=coalesce(nullif(v_item->>'discount','')::numeric,0)::numeric(20,0);
      select ii.item_type,ii.base_unit_id into v_item_type,v_base_unit
      from public.inventory_items ii where ii.id=v_item_id and ii.workspace_id=p_workspace_id;
      v_unit_id:=coalesce(v_unit_id,v_base_unit);
      v_gross:=round(v_qty*v_price,0);
      if v_discount>v_gross then raise exception 'DISCOUNT_TOO_LARGE'; end if;
      v_line_total:=(v_gross-v_discount)::numeric(20,0);
      if v_line_total<=0 then raise exception 'INVOICE_LINE_TOTAL_INVALID'; end if;

      update public.invoice_lines l
         set item_id=v_item_id,unit_id=v_unit_id,warehouse_id=v_warehouse_id,
             receipt_line_id=v_receipt_line_id,quantity=v_qty,line_total=v_line_total,
             account_id=case when p_invoice_type='purchase' and v_item_type='inventory' then v_grni else l.account_id end
       where l.invoice_id=v_iid and l.workspace_id=p_workspace_id and l.line_no=v_idx;
    else
      update public.invoice_lines l
         set item_id=null,unit_id=null,warehouse_id=null,receipt_line_id=null
       where l.invoice_id=v_iid and l.workspace_id=p_workspace_id and l.line_no=v_idx;
    end if;
  end loop;

  update public.invoices i
     set total_amount=(select coalesce(sum(l.line_total),0)::numeric(20,0) from public.invoice_lines l where l.invoice_id=v_iid)
   where i.id=v_iid and i.workspace_id=p_workspace_id and i.status='draft';

  return v_iid;
end;
$$;

-- The old private implementations are now internal implementation details. Browser-facing
-- execution must pass through the public SECURITY INVOKER wrappers and the new D wrappers.
revoke all on function private.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to service_role;
revoke all on function private.post_invoice(uuid) from public,anon,authenticated;
grant execute on function private.post_invoice(uuid) to service_role;

-- SECURITY DEFINER trigger function stays trigger-only, not an authenticated RPC surface.
revoke all on function public.sync_invoice_status_from_journal() from public,anon,authenticated;

-- Public wrappers keep the existing signatures and authenticated execution.
revoke all on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public,anon;
grant execute on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to authenticated,service_role;
revoke all on function public.post_invoice(uuid) from public,anon;
grant execute on function public.post_invoice(uuid) to authenticated,service_role;
