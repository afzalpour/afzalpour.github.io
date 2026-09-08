-- Applied migration: 20260907214750 — rc1_5_c_tax_ux_reporting_contract
-- Source of truth: supabase_migrations.schema_migrations

alter table public.invoice_lines
  add column if not exists tax_treatment text null,
  add column if not exists tax_profile_code text null,
  add column if not exists tax_profile_name_fa text null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.invoice_lines'::regclass
      and conname='invoice_lines_tax_treatment_check'
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_tax_treatment_check
      check (tax_treatment is null or tax_treatment in ('standard','exempt','zero','custom'));
  end if;
end $$;

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
       set tax_profile_id=null,
           tax_rule_version_id=null,
           tax_rate=null,
           taxable_amount=null,
           tax_amount=0,
           tax_treatment=null,
           tax_profile_code=null,
           tax_profile_name_fa=null
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
             tax_amount=v_tax,
             tax_treatment=v_profile.treatment,
             tax_profile_code=v_profile.code,
             tax_profile_name_fa=v_profile.name_fa
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

-- Company Tax settings are configuration, not ordinary accounting data.
-- Only owner/manager may change them; all Company members retain read access.
drop policy if exists workspace_tax_settings_insert on public.workspace_tax_settings;
drop policy if exists workspace_tax_settings_update on public.workspace_tax_settings;
create policy workspace_tax_settings_insert on public.workspace_tax_settings
  for insert to authenticated
  with check (public.workspace_role(workspace_id) in ('owner','manager'));
create policy workspace_tax_settings_update on public.workspace_tax_settings
  for update to authenticated
  using (public.workspace_role(workspace_id) in ('owner','manager'))
  with check (public.workspace_role(workspace_id) in ('owner','manager'));

-- TRUNCATE bypasses RLS and is never required by the browser role.
revoke truncate, references, trigger on public.workspace_tax_settings from authenticated;
revoke delete, truncate, references, trigger on public.tax_profiles from authenticated;
revoke truncate, references, trigger on public.tax_rule_versions from authenticated;

create or replace function public.set_workspace_tax_settings(
  wid uuid,
  p_tax_enabled boolean,
  p_taxpayer_type text,
  p_tax_identifier text default null,
  p_economic_code text default null,
  p_taxpayer_memory_id text default null
) returns public.workspace_tax_settings
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_row public.workspace_tax_settings%rowtype;
  v_role text;
begin
  if wid is null then raise exception 'WORKSPACE_REQUIRED'; end if;
  v_role:=public.workspace_role(wid);
  if v_role not in ('owner','manager') then raise exception 'TAX_SETTINGS_ROLE_NOT_ALLOWED'; end if;
  if p_taxpayer_type not in ('unspecified','individual','legal_entity','nonprofit','other') then
    raise exception 'TAXPAYER_TYPE_INVALID';
  end if;
  if coalesce(p_tax_enabled,false) and not exists (
    select 1
    from public.workspace_tax_settings s
    join public.tax_rule_versions r on r.id=s.default_rule_version_id
    where s.workspace_id=wid and r.status='active'
  ) then raise exception 'ACTIVE_TAX_RULE_REQUIRED'; end if;

  insert into public.workspace_tax_settings(
    workspace_id,tax_enabled,taxpayer_type,tax_identifier,economic_code,taxpayer_memory_id,updated_at
  ) values(
    wid,coalesce(p_tax_enabled,false),p_taxpayer_type,
    nullif(btrim(p_tax_identifier),''),nullif(btrim(p_economic_code),''),nullif(btrim(p_taxpayer_memory_id),''),now()
  )
  on conflict(workspace_id) do update set
    tax_enabled=excluded.tax_enabled,
    taxpayer_type=excluded.taxpayer_type,
    tax_identifier=excluded.tax_identifier,
    economic_code=excluded.economic_code,
    taxpayer_memory_id=excluded.taxpayer_memory_id,
    updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

revoke all on function public.set_workspace_tax_settings(uuid,boolean,text,text,text,text) from public;
revoke all on function public.set_workspace_tax_settings(uuid,boolean,text,text,text,text) from anon;
grant execute on function public.set_workspace_tax_settings(uuid,boolean,text,text,text,text) to authenticated;

create or replace function public.report_vat_transactions(
  wid uuid,
  dfrom date,
  dto date
) returns table(
  event_date date,
  event_kind text,
  invoice_id uuid,
  invoice_no bigint,
  invoice_type text,
  party_id uuid,
  party_name text,
  tax_treatment text,
  tax_profile_code text,
  tax_profile_name_fa text,
  tax_rate numeric,
  taxable_amount numeric,
  tax_amount numeric
)
language sql
stable
security invoker
set search_path to ''
as $$
  with base as (
    select
      i.id invoice_id,
      i.invoice_no,
      i.invoice_type,
      i.party_id,
      p.name party_name,
      i.journal_entry_id,
      i.reversal_journal_entry_id,
      coalesce(il.tax_treatment,'standard') tax_treatment,
      coalesce(il.tax_profile_code,'—') tax_profile_code,
      coalesce(il.tax_profile_name_fa,'پروفایل مالیاتی') tax_profile_name_fa,
      coalesce(il.tax_rate,0)::numeric tax_rate,
      coalesce(sum(il.taxable_amount),0)::numeric taxable_amount,
      coalesce(sum(il.tax_amount),0)::numeric tax_amount
    from public.invoices i
    join public.invoice_lines il
      on il.invoice_id=i.id and il.workspace_id=i.workspace_id
    left join public.parties p
      on p.id=i.party_id and p.workspace_id=i.workspace_id
    where i.workspace_id=wid
      and i.status in ('posted','reversed')
      and il.tax_profile_id is not null
    group by i.id,i.invoice_no,i.invoice_type,i.party_id,p.name,i.journal_entry_id,i.reversal_journal_entry_id,
      coalesce(il.tax_treatment,'standard'),coalesce(il.tax_profile_code,'—'),
      coalesce(il.tax_profile_name_fa,'پروفایل مالیاتی'),coalesce(il.tax_rate,0)
  ), events as (
    select
      je.entry_date event_date,
      'invoice'::text event_kind,
      b.invoice_id,b.invoice_no,b.invoice_type,b.party_id,b.party_name,
      b.tax_treatment,b.tax_profile_code,b.tax_profile_name_fa,b.tax_rate,
      b.taxable_amount,b.tax_amount
    from base b
    join public.journal_entries je on je.id=b.journal_entry_id
    where je.workspace_id=wid and je.entry_date between dfrom and dto

    union all

    select
      rje.entry_date event_date,
      'reversal'::text event_kind,
      b.invoice_id,b.invoice_no,b.invoice_type,b.party_id,b.party_name,
      b.tax_treatment,b.tax_profile_code,b.tax_profile_name_fa,b.tax_rate,
      -b.taxable_amount,-b.tax_amount
    from base b
    join public.journal_entries rje on rje.id=b.reversal_journal_entry_id
    where rje.workspace_id=wid and rje.entry_date between dfrom and dto
  )
  select * from events
  order by event_date desc,invoice_no desc nulls last,invoice_id,tax_profile_code;
$$;

revoke all on function public.report_vat_transactions(uuid,date,date) from public;
revoke all on function public.report_vat_transactions(uuid,date,date) from anon;
grant execute on function public.report_vat_transactions(uuid,date,date) to authenticated;
