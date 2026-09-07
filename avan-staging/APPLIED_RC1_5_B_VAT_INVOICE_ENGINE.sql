-- Applied to Supabase project Avan-production
-- Migration: rc1_5_b_vat_invoice_engine
-- Version: 20260907212157

alter table public.invoices
  add column subtotal_amount numeric(20,0) null check (subtotal_amount is null or subtotal_amount >= 0),
  add column tax_total numeric(20,0) not null default 0 check (tax_total >= 0);

create or replace function private.apply_invoice_tax_snapshot(p_invoice_id uuid,p_input_lines jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_inv public.invoices%rowtype;
  v_enabled boolean:=false;
  v_line record;
  v_input jsonb;
  v_profile_id uuid;
  v_profile public.tax_profiles%rowtype;
  v_rule public.tax_rule_versions%rowtype;
  v_tax bigint;
  v_subtotal numeric(20,0);
  v_tax_total numeric(20,0);
begin
  select * into v_inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_inv.workspace_id);
  if v_inv.status<>'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;
  select coalesce(s.tax_enabled,false) into v_enabled from public.workspace_tax_settings s where s.workspace_id=v_inv.workspace_id;

  if not v_enabled then
    update public.invoice_lines
       set tax_profile_id=null,tax_rule_version_id=null,tax_rate=null,taxable_amount=null,tax_amount=0
     where invoice_id=v_inv.id and workspace_id=v_inv.workspace_id;
  else
    for v_line in
      select l.* from public.invoice_lines l
      where l.invoice_id=v_inv.id and l.workspace_id=v_inv.workspace_id
      order by l.line_no
    loop
      v_input:=coalesce(p_input_lines->(v_line.line_no-1),'{}'::jsonb);
      v_profile_id:=nullif(v_input->>'tax_profile_id','')::uuid;
      if v_profile_id is null and v_line.item_id is not null then
        select ii.tax_profile_id into v_profile_id
        from public.inventory_items ii
        where ii.id=v_line.item_id and ii.workspace_id=v_inv.workspace_id;
      end if;
      if v_profile_id is null then raise exception 'TAX_PROFILE_REQUIRED'; end if;

      select * into v_profile
      from public.tax_profiles tp
      where tp.id=v_profile_id and tp.workspace_id=v_inv.workspace_id and tp.is_active;
      if not found then raise exception 'TAX_PROFILE_INVALID'; end if;
      if v_profile.applies_to not in ('both',v_inv.invoice_type) then raise exception 'TAX_PROFILE_NOT_APPLICABLE'; end if;

      if v_profile.rule_version_id is not null then
        select * into v_rule from public.tax_rule_versions tr where tr.id=v_profile.rule_version_id;
        if not found or v_rule.status<>'active'
           or v_inv.invoice_date<v_rule.effective_from
           or (v_rule.effective_to is not null and v_inv.invoice_date>v_rule.effective_to)
        then raise exception 'TAX_RULE_NOT_EFFECTIVE'; end if;
        if v_profile.treatment='standard' and v_profile.rate is distinct from v_rule.standard_vat_rate then
          raise exception 'TAX_STANDARD_RATE_MISMATCH';
        end if;
      elsif v_profile.treatment='standard' then
        raise exception 'TAX_RULE_REQUIRED';
      end if;

      v_tax:=round(v_line.line_total*v_profile.rate/100.0,0)::bigint;
      update public.invoice_lines
         set tax_profile_id=v_profile.id,
             tax_rule_version_id=v_profile.rule_version_id,
             tax_rate=v_profile.rate,
             taxable_amount=v_line.line_total::bigint,
             tax_amount=v_tax
       where id=v_line.id;
    end loop;
  end if;

  select coalesce(sum(line_total),0)::numeric(20,0),
         coalesce(sum(coalesce(tax_amount,0)),0)::numeric(20,0)
    into v_subtotal,v_tax_total
  from public.invoice_lines
  where invoice_id=v_inv.id and workspace_id=v_inv.workspace_id;

  update public.invoices
     set subtotal_amount=v_subtotal,
         tax_total=v_tax_total,
         total_amount=v_subtotal+v_tax_total,
         updated_at=now()
   where id=v_inv.id;
  return v_inv.id;
end $$;

create or replace function public.save_draft_invoice(
  p_workspace_id uuid,p_fiscal_year_id uuid,p_invoice_id uuid,p_invoice_type text,
  p_invoice_date date,p_due_date date,p_party_id uuid,p_description text,p_lines jsonb
) returns uuid language sql set search_path to '' as $$
  select private.apply_invoice_tax_snapshot(
    private.save_draft_invoice_with_inventory(
      p_workspace_id,p_fiscal_year_id,p_invoice_id,p_invoice_type,p_invoice_date,p_due_date,p_party_id,p_description,p_lines
    ),
    p_lines
  )
$$;

create or replace function private.post_invoice(iid uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth','pg_temp' as $$
declare
  inv public.invoices%rowtype;
  ln record;
  jid uuid;
  posted public.journal_entries%rowtype;
  control_id uuid;
  discount_id uuid;
  vat_id uuid;
  ino bigint;
  idx integer:=0;
  expected_subtotal numeric(20,0);
  expected_tax numeric(20,0);
  expected_total numeric(20,0);
  total_discount numeric(20,0):=0;
  r text;
  v_tax_enabled boolean:=false;
begin
  select * into inv from public.invoices where id=iid for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  if not public.has_workspace_access(inv.workspace_id) then raise exception 'FORBIDDEN'; end if;
  r:=public.workspace_role(inv.workspace_id);
  if r not in ('owner','manager','accountant') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if not exists(select 1 from public.fiscal_years fy where fy.id=inv.fiscal_year_id and fy.workspace_id=inv.workspace_id) then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if inv.status<>'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;
  if inv.total_amount<=0 or not exists(select 1 from public.invoice_lines where invoice_id=inv.id) then raise exception 'INVOICE_EMPTY'; end if;

  select coalesce(s.tax_enabled,false) into v_tax_enabled
  from public.workspace_tax_settings s where s.workspace_id=inv.workspace_id;
  if v_tax_enabled and exists(select 1 from public.invoice_lines where invoice_id=inv.id and tax_profile_id is null) then
    raise exception 'TAX_SNAPSHOT_REQUIRED';
  end if;

  select coalesce(sum(line_total),0)::numeric(20,0),
         coalesce(sum(coalesce(tax_amount,0)),0)::numeric(20,0),
         coalesce(sum(discount),0)::numeric(20,0)
    into expected_subtotal,expected_tax,total_discount
  from public.invoice_lines where invoice_id=inv.id;
  expected_total:=expected_subtotal+expected_tax;

  -- Legacy drafts created before RC1.5 are normalized only while still Draft.
  if inv.subtotal_amount is null then
    update public.invoices set subtotal_amount=expected_subtotal,tax_total=expected_tax,total_amount=expected_total where id=inv.id;
    inv.subtotal_amount:=expected_subtotal;
    inv.tax_total:=expected_tax;
    inv.total_amount:=expected_total;
  end if;
  if expected_subtotal is distinct from inv.subtotal_amount
     or expected_tax is distinct from inv.tax_total
     or expected_total is distinct from inv.total_amount
  then raise exception 'INVOICE_TOTAL_MISMATCH'; end if;

  select account_id into control_id
  from public.account_roles
  where workspace_id=inv.workspace_id
    and role_key=case when inv.invoice_type='sale' then 'receivable' else 'payable' end;
  if control_id is null then raise exception 'INVOICE_CONTROL_ACCOUNT_MISSING'; end if;
  perform public.assert_account_postable(control_id,inv.workspace_id);

  if inv.invoice_type='sale' and total_discount>0 then
    select account_id into discount_id from public.account_roles where workspace_id=inv.workspace_id and role_key='sales_discount';
    if discount_id is null then raise exception 'SALES_DISCOUNT_ACCOUNT_MISSING'; end if;
    perform public.assert_account_postable(discount_id,inv.workspace_id);
  end if;

  if expected_tax>0 then
    select account_id into vat_id from public.account_roles
    where workspace_id=inv.workspace_id
      and role_key=case when inv.invoice_type='sale' then 'vat_output_payable' else 'vat_input_receivable' end;
    if vat_id is null then raise exception 'VAT_ACCOUNT_ROLE_MISSING'; end if;
    perform public.assert_account_postable(vat_id,inv.workspace_id);
  end if;

  insert into public.journal_entries(workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,created_by)
  values(inv.workspace_id,inv.fiscal_year_id,inv.invoice_date,
         coalesce(inv.description,case when inv.invoice_type='sale' then 'فاکتور فروش' else 'فاکتور خرید' end),
         case when inv.invoice_type='sale' then 'sales_invoice' else 'purchase_invoice' end,
         inv.id,'draft',auth.uid()) returning id into jid;

  if inv.invoice_type='sale' then
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit)
    values(inv.workspace_id,jid,1,control_id,inv.party_id,'حساب دریافتنی فاکتور',inv.total_amount,0);
    idx:=1;
    for ln in select * from public.invoice_lines where invoice_id=inv.id order by line_no loop
      idx:=idx+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(inv.workspace_id,jid,idx,ln.account_id,ln.description,0,ln.line_total+ln.discount);
    end loop;
    if total_discount>0 then
      idx:=idx+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(inv.workspace_id,jid,idx,discount_id,'تخفیفات فروش',total_discount,0);
    end if;
    if expected_tax>0 then
      idx:=idx+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(inv.workspace_id,jid,idx,vat_id,'مالیات بر ارزش افزوده فروش',0,expected_tax);
    end if;
  else
    idx:=0;
    for ln in select * from public.invoice_lines where invoice_id=inv.id order by line_no loop
      idx:=idx+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(inv.workspace_id,jid,idx,ln.account_id,ln.description,ln.line_total,0);
    end loop;
    if expected_tax>0 then
      idx:=idx+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(inv.workspace_id,jid,idx,vat_id,'اعتبار مالیاتی ارزش افزوده خرید',expected_tax,0);
    end if;
    idx:=idx+1;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit)
    values(inv.workspace_id,jid,idx,control_id,inv.party_id,'حساب پرداختنی فاکتور',0,inv.total_amount);
  end if;

  select * into posted from public.post_journal_entry(jid);
  insert into public.invoice_number_sequences as seq(workspace_id,fiscal_year_id,invoice_type,last_number)
  values(inv.workspace_id,inv.fiscal_year_id,inv.invoice_type,1)
  on conflict(workspace_id,fiscal_year_id,invoice_type)
  do update set last_number=seq.last_number+1 returning last_number into ino;

  update public.invoices
  set invoice_no=ino,status='posted',journal_entry_id=jid,posted_at=now(),updated_at=now()
  where id=inv.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(inv.workspace_id,'post','invoice',inv.id,'فاکتور ثبت قطعی شد؛ شماره سند حسابداری '||posted.journal_no);

  return jsonb_build_object('invoice_id',inv.id,'invoice_no',ino,'journal_entry_id',jid,'journal_no',posted.journal_no,'status','posted');
end $$;

create or replace function public.guard_invoice_mutation()
returns trigger language plpgsql set search_path to '' as $$
begin
  if tg_op='DELETE' and old.status<>'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;

  if tg_op='UPDATE' and old.status='posted' then
    if new.status='reversed'
       and new.workspace_id=old.workspace_id
       and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no
       and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date
       and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id
       and new.description is not distinct from old.description
       and new.total_amount=old.total_amount
       and new.subtotal_amount is not distinct from old.subtotal_amount
       and new.tax_total=old.tax_total
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.inventory_document_id is not distinct from old.inventory_document_id
       and new.created_by is not distinct from old.created_by
       and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at
       and new.reversal_journal_entry_id is not null
       and exists(select 1 from public.journal_entries r where r.id=new.reversal_journal_entry_id and r.workspace_id=old.workspace_id and r.reversal_of=old.journal_entry_id and r.status='posted')
       and ((old.inventory_document_id is null and new.reversal_inventory_document_id is null)
         or (old.inventory_document_id is not null and new.reversal_inventory_document_id is not null and exists(
           select 1 from public.inventory_documents rd where rd.id=new.reversal_inventory_document_id and rd.workspace_id=old.workspace_id and rd.reversal_of=old.inventory_document_id and rd.status='posted')))
    then new.updated_at:=now(); return new; end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' and old.status='reversed' then
    if new.status='reversed'
       and new.workspace_id=old.workspace_id and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id and new.description is not distinct from old.description
       and new.total_amount=old.total_amount
       and new.subtotal_amount is not distinct from old.subtotal_amount
       and new.tax_total=old.tax_total
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.inventory_document_id is not distinct from old.inventory_document_id
       and new.created_by is not distinct from old.created_by and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at and new.reversed_at is not distinct from old.reversed_at
       and (old.reversal_journal_entry_id is not null or new.reversal_journal_entry_id is not null)
       and (old.reversal_inventory_document_id is not null or new.reversal_inventory_document_id is not null or old.inventory_document_id is null)
    then new.updated_at:=now(); return new; end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' then new.updated_at:=now(); end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
