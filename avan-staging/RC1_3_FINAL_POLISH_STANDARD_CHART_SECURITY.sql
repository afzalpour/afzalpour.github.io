-- Avan RC1.3 final polish + operational security
-- Applied migration: rc1_3_final_polish_standard_chart_security_hardening
-- Completes the default chart through level 2 (معین), preserves existing/custom accounts,
-- closes internal SECURITY DEFINER helpers to browser execution and converts safe read-only RPCs to invoker.

begin;

create or replace function private.ensure_standard_account_chart(p_wid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid; v_liability uuid; v_equity uuid; v_income uuid; v_expense uuid;
  v_inserted integer := 0; v_n integer;
begin
  if not exists (select 1 from public.workspaces w where w.id=p_wid) then raise exception 'COMPANY_NOT_FOUND'; end if;
  select a.id into v_asset from public.accounts a where a.workspace_id=p_wid and a.code='100' limit 1;
  select a.id into v_liability from public.accounts a where a.workspace_id=p_wid and a.code='200' limit 1;
  select a.id into v_equity from public.accounts a where a.workspace_id=p_wid and a.code='300' limit 1;
  select a.id into v_income from public.accounts a where a.workspace_id=p_wid and a.code='400' limit 1;
  select a.id into v_expense from public.accounts a where a.workspace_id=p_wid and a.code='500' limit 1;
  if v_asset is null or v_liability is null or v_equity is null or v_income is null or v_expense is null then raise exception 'STANDARD_ROOT_ACCOUNTS_REQUIRED'; end if;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  select p_wid,v_asset,x.code,x.name,2,'asset',x.normal_balance,false,true
  from (values
    ('130','موجودی مواد و کالا','debit'),('140','پیش‌پرداخت‌ها و سفارشات','debit'),
    ('150','سپرده‌ها، مالیات و سایر دریافتنی‌ها','debit'),('160','دارایی‌های ثابت مشهود','debit'),
    ('170','استهلاک انباشته دارایی‌های ثابت','credit'),('180','دارایی‌های نامشهود','debit'),('190','سایر دارایی‌ها','debit')
  ) as x(code,name,normal_balance) on conflict (workspace_id,code) do nothing;
  get diagnostics v_n=row_count; v_inserted:=v_inserted+v_n;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  select p_wid,v_liability,x.code,x.name,2,'liability','credit',false,true
  from (values
    ('225','سایر حساب‌ها و هزینه‌های پرداختنی جاری'),('230','مالیات، عوارض و بیمه پرداختنی'),
    ('240','حقوق و دستمزد پرداختنی'),('250','پیش‌دریافت از مشتریان'),('260','تسهیلات مالی کوتاه‌مدت'),
    ('270','بدهی‌ها و تسهیلات بلندمدت'),('280','ذخایر و تعهدات')
  ) as x(code,name) on conflict (workspace_id,code) do nothing;
  get diagnostics v_n=row_count; v_inserted:=v_inserted+v_n;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  select p_wid,v_equity,x.code,x.name,2,'equity','credit',false,true
  from (values ('320','اندوخته قانونی و سایر اندوخته‌ها'),('330','سود و زیان انباشته'),('340','سود و زیان سال جاری')) as x(code,name)
  on conflict (workspace_id,code) do nothing;
  get diagnostics v_n=row_count; v_inserted:=v_inserted+v_n;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  select p_wid,v_income,x.code,x.name,2,'income','credit',false,true
  from (values ('425','سایر درآمدهای عملیاتی'),('430','درآمدهای غیرعملیاتی')) as x(code,name)
  on conflict (workspace_id,code) do nothing;
  get diagnostics v_n=row_count; v_inserted:=v_inserted+v_n;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  select p_wid,v_expense,x.code,x.name,2,'expense','debit',false,true
  from (values
    ('520','بهای تمام‌شده کالا و خدمات'),('530','هزینه‌های فروش و توزیع'),('540','هزینه‌های حقوق و مزایا'),
    ('550','هزینه استهلاک و آمورتایز'),('560','هزینه‌های مالی'),('570','سایر هزینه‌های عملیاتی'),
    ('580','هزینه‌های غیرعملیاتی'),('590','هزینه مالیات بر درآمد')
  ) as x(code,name) on conflict (workspace_id,code) do nothing;
  get diagnostics v_n=row_count; v_inserted:=v_inserted+v_n;
  return v_inserted;
end;
$$;
revoke all on function private.ensure_standard_account_chart(uuid) from public,anon,authenticated;

do $$ declare r record; begin
  for r in select w.id from public.workspaces w loop perform private.ensure_standard_account_chart(r.id); end loop;
end $$;

create or replace function public.create_avan_company(
  p_name text,p_money_unit text default 'toman',p_fiscal_name text default '۱۴۰۵',
  p_date_from date default '2026-03-21',p_date_to date default '2027-03-20',p_profile jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text; v_wid uuid; v_fyid uuid; v_profile jsonb;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  v_name:=nullif(btrim(p_name),''); if v_name is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  if char_length(v_name)>160 then raise exception 'COMPANY_NAME_TOO_LONG'; end if;
  if p_money_unit not in ('toman','rial') then raise exception 'MONEY_UNIT_INVALID'; end if;
  if p_date_from is null or p_date_to is null or p_date_from>p_date_to then raise exception 'FISCAL_DATE_RANGE_INVALID'; end if;
  if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'PROFILE_INVALID'; end if;
  v_wid:=public.create_workspace(v_name,'business',p_money_unit);
  v_fyid:=private.initialize_avan_company_core(v_wid,p_fiscal_name,p_date_from,p_date_to);
  perform private.ensure_standard_account_chart(v_wid);
  v_profile:=p_profile||jsonb_build_object('display_name',v_name);
  perform public.set_workspace_print_profile(v_wid,v_profile);
  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_wid,'company_created','workspace',v_wid,'Company tenant created through Avan onboarding');
  return jsonb_build_object('company_id',v_wid,'workspace_id',v_wid,'fiscal_year_id',v_fyid,'role','owner','created',true);
end;
$$;
revoke all on function public.create_avan_company(text,text,text,date,date,jsonb) from public,anon;
grant execute on function public.create_avan_company(text,text,text,date,date,jsonb) to authenticated;

revoke execute on function public.assert_account_postable(uuid,uuid) from authenticated;
revoke execute on function public.audit_avan_document() from authenticated;
revoke execute on function public.auto_sales_discount_on_income_role() from authenticated;
revoke execute on function public.ensure_sales_discount_account(uuid) from authenticated;
revoke execute on function public.next_journal_number(uuid,uuid) from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.sync_invoice_status_from_journal() from authenticated;

alter function public.avan_core_integrity(uuid) security invoker;
alter function public.avan_workspace_health(uuid) security invoker;
alter function public.invoice_integrity(uuid) security invoker;
alter function public.report_account_statement(uuid,uuid,date,date) security invoker;
alter function public.report_balance_sheet(uuid,date) security invoker;
alter function public.report_cash_bank_balances(uuid,date) security invoker;
alter function public.report_general_ledger(uuid,uuid,date,date) security invoker;
alter function public.report_journal(uuid,date,date) security invoker;
alter function public.report_profit_loss(uuid,date,date) security invoker;
alter function public.report_trial_balance(uuid,date,date) security invoker;

notify pgrst,'reload schema';
commit;
