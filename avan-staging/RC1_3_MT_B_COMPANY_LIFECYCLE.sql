-- Avan RC1.3-MT-B — Company Lifecycle / Onboarding
-- ADR-0014 / ADR-0015
-- Explicit Company creation for authenticated users; does not change Ledger lifecycle.

begin;

create schema if not exists private;

create or replace function private.initialize_avan_company_core(
  p_wid uuid,
  p_fiscal_name text,
  p_date_from date,
  p_date_to date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fyid uuid;
  a_asset uuid; a_cashbank uuid; a_cash uuid; a_bank uuid; a_ar_group uuid; a_ar uuid;
  a_liab uuid; a_ap_group uuid; a_ap uuid;
  a_equity_group uuid; a_capital_group uuid; a_opening uuid;
  a_income_group uuid; a_income_sub uuid; a_income uuid;
  a_expense_group uuid; a_expense_sub uuid; a_expense uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then
    raise exception 'FISCAL_DATE_RANGE_INVALID';
  end if;

  if nullif(btrim(p_fiscal_name), '') is null or char_length(btrim(p_fiscal_name)) > 80 then
    raise exception 'FISCAL_NAME_INVALID';
  end if;

  if not exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_wid
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.is_active
  ) then
    raise exception 'COMPANY_OWNER_REQUIRED';
  end if;

  if exists (select 1 from public.fiscal_years fy where fy.workspace_id = p_wid)
     or exists (select 1 from public.accounts a where a.workspace_id = p_wid) then
    raise exception 'COMPANY_ALREADY_INITIALIZED';
  end if;

  insert into public.fiscal_years(workspace_id,name,date_from,date_to,status)
  values(p_wid,btrim(p_fiscal_name),p_date_from,p_date_to,'open')
  returning id into fyid;

  -- Assets
  insert into public.accounts(workspace_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,'100','دارایی‌ها',1,'asset','debit',false,true) returning id into a_asset;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_asset,'110','وجوه نقد و بانک',2,'asset','debit',false,true) returning id into a_cashbank;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_cashbank,'1101','صندوق',3,'asset','debit',true,true) returning id into a_cash;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_cashbank,'1102','بانک',3,'asset','debit',true,true) returning id into a_bank;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_asset,'120','حساب‌های دریافتنی',2,'asset','debit',false,true) returning id into a_ar_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_ar_group,'1201','دریافتنی تجاری',3,'asset','debit',true,true) returning id into a_ar;

  -- Liabilities
  insert into public.accounts(workspace_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,'200','بدهی‌ها',1,'liability','credit',false,true) returning id into a_liab;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_liab,'210','حساب‌های پرداختنی',2,'liability','credit',false,true) returning id into a_ap_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_ap_group,'2101','پرداختنی تجاری',3,'liability','credit',true,true) returning id into a_ap;

  -- Equity
  insert into public.accounts(workspace_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,'300','حقوق مالکانه',1,'equity','credit',false,true) returning id into a_equity_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_equity_group,'310','سرمایه',2,'equity','credit',false,true) returning id into a_capital_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_capital_group,'3101','سرمایه مالک / افتتاحیه',3,'equity','credit',true,true) returning id into a_opening;

  -- Income
  insert into public.accounts(workspace_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,'400','درآمدها',1,'income','credit',false,true) returning id into a_income_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_income_group,'410','درآمد عملیاتی',2,'income','credit',false,true) returning id into a_income_sub;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_income_sub,'4101','درآمد خدمات و فروش',3,'income','credit',true,true) returning id into a_income;

  -- Expenses
  insert into public.accounts(workspace_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,'500','هزینه‌ها',1,'expense','debit',false,true) returning id into a_expense_group;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_expense_group,'510','هزینه‌های عمومی',2,'expense','debit',false,true) returning id into a_expense_sub;
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values(p_wid,a_expense_sub,'5101','هزینه عمومی و اداری',3,'expense','debit',true,true) returning id into a_expense;

  insert into public.account_roles(workspace_id,role_key,account_id) values
    (p_wid,'cash',a_cash),
    (p_wid,'bank',a_bank),
    (p_wid,'receivable',a_ar),
    (p_wid,'payable',a_ap),
    (p_wid,'opening_equity',a_opening),
    (p_wid,'default_income',a_income),
    (p_wid,'default_expense',a_expense);

  insert into public.financial_accounts(workspace_id,ledger_account_id,kind) values
    (p_wid,a_cash,'cash'),
    (p_wid,a_bank,'bank');

  return fyid;
end;
$$;

revoke all on function private.initialize_avan_company_core(uuid,text,date,date)
  from public, anon, authenticated;

create or replace function public.create_avan_company(
  p_name text,
  p_money_unit text default 'toman',
  p_fiscal_name text default '۱۴۰۵',
  p_date_from date default '2026-03-21',
  p_date_to date default '2027-03-20',
  p_profile jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_wid uuid;
  v_fyid uuid;
  v_profile jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_name := nullif(btrim(p_name), '');
  if v_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;
  if char_length(v_name) > 160 then
    raise exception 'COMPANY_NAME_TOO_LONG';
  end if;
  if p_money_unit not in ('toman','rial') then
    raise exception 'MONEY_UNIT_INVALID';
  end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then
    raise exception 'FISCAL_DATE_RANGE_INVALID';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'PROFILE_INVALID';
  end if;

  -- create_workspace assigns the current authenticated user as owner and
  -- creates the Company-level money setting. Unlike legacy bootstrap, this
  -- intentionally creates a fresh Company every time.
  v_wid := public.create_workspace(v_name, 'business', p_money_unit);
  v_fyid := private.initialize_avan_company_core(
    v_wid,
    p_fiscal_name,
    p_date_from,
    p_date_to
  );

  v_profile := p_profile || jsonb_build_object('display_name', v_name);
  perform public.set_workspace_print_profile(v_wid, v_profile);

  insert into public.audit_logs(workspace_id, action, entity_type, entity_id, summary)
  values(v_wid, 'company_created', 'workspace', v_wid, 'Company tenant created through Avan onboarding');

  return jsonb_build_object(
    'company_id', v_wid,
    'workspace_id', v_wid,
    'fiscal_year_id', v_fyid,
    'role', 'owner',
    'created', true
  );
end;
$$;

revoke all on function public.create_avan_company(text,text,text,date,date,jsonb)
  from public, anon;
grant execute on function public.create_avan_company(text,text,text,date,date,jsonb)
  to authenticated;

create or replace function public.rename_avan_company(
  wid uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_role text;
  v_profile jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_role := public.workspace_role(wid);
  if v_role not in ('owner','manager','financial_manager') then
    raise exception 'FORBIDDEN';
  end if;

  v_name := nullif(btrim(p_name), '');
  if v_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;
  if char_length(v_name) > 160 then
    raise exception 'COMPANY_NAME_TOO_LONG';
  end if;

  update public.workspaces
  set name = v_name
  where id = wid;

  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  v_profile := coalesce(public.get_workspace_print_profile(wid), '{}'::jsonb)
    || jsonb_build_object('display_name', v_name);
  perform public.set_workspace_print_profile(wid, v_profile);

  insert into public.audit_logs(workspace_id, action, entity_type, entity_id, summary)
  values(wid, 'company_renamed', 'workspace', wid, 'Company display identity renamed');

  return public.get_workspace_print_profile(wid);
end;
$$;

revoke all on function public.rename_avan_company(uuid,text)
  from public, anon;
grant execute on function public.rename_avan_company(uuid,text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
