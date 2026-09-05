-- RC1.3 standard chart v2 correction
-- Applied to Supabase project dkyqsxnllvxypigxpygo on 2026-09-06.
-- Purpose:
-- 1) complete the default system chart through level 2 (معین),
-- 2) create headings only (no balances / no journal postings),
-- 3) preserve existing custom accounts,
-- 4) support correct contra-account normal balances for selected system headings.

create or replace function private.ensure_standard_account_chart(p_wid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid;
  v_liability uuid;
  v_equity uuid;
  v_income uuid;
  v_expense uuid;
  v_inserted integer := 0;
begin
  if not exists (select 1 from public.workspaces w where w.id=p_wid) then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  select a.id into v_asset from public.accounts a where a.workspace_id=p_wid and a.code='100' limit 1;
  select a.id into v_liability from public.accounts a where a.workspace_id=p_wid and a.code='200' limit 1;
  select a.id into v_equity from public.accounts a where a.workspace_id=p_wid and a.code='300' limit 1;
  select a.id into v_income from public.accounts a where a.workspace_id=p_wid and a.code='400' limit 1;
  select a.id into v_expense from public.accounts a where a.workspace_id=p_wid and a.code='500' limit 1;

  if v_asset is null or v_liability is null or v_equity is null or v_income is null or v_expense is null then
    raise exception 'STANDARD_ROOT_ACCOUNTS_REQUIRED';
  end if;

  insert into public.accounts(
    workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system
  )
  select
    p_wid,
    case x.category
      when 'asset' then v_asset
      when 'liability' then v_liability
      when 'equity' then v_equity
      when 'income' then v_income
      when 'expense' then v_expense
    end,
    x.code,x.name,2,x.category,x.normal_balance,false,true
  from (values
    ('110','وجوه نقد و بانک','asset','debit'),
    ('115','سرمایه‌گذاری‌های کوتاه‌مدت','asset','debit'),
    ('120','حساب‌های دریافتنی','asset','debit'),
    ('125','اسناد و سایر دریافتنی‌های تجاری','asset','debit'),
    ('130','موجودی مواد و کالا','asset','debit'),
    ('140','پیش‌پرداخت‌ها و سفارشات','asset','debit'),
    ('150','سپرده‌ها، مالیات و سایر دریافتنی‌ها','asset','debit'),
    ('160','دارایی‌های ثابت مشهود','asset','debit'),
    ('165','دارایی‌های حق استفاده','asset','debit'),
    ('170','استهلاک انباشته دارایی‌های ثابت','asset','credit'),
    ('175','سرمایه‌گذاری‌های بلندمدت','asset','debit'),
    ('180','دارایی‌های نامشهود','asset','debit'),
    ('185','استهلاک و آمورتایز انباشته دارایی‌های نامشهود','asset','credit'),
    ('190','سایر دارایی‌ها','asset','debit'),
    ('195','دارایی مالیات انتقالی','asset','debit'),

    ('210','حساب‌های پرداختنی','liability','credit'),
    ('215','اسناد پرداختنی تجاری','liability','credit'),
    ('225','سایر حساب‌ها و هزینه‌های پرداختنی جاری','liability','credit'),
    ('230','مالیات، عوارض و بیمه پرداختنی','liability','credit'),
    ('240','حقوق و دستمزد پرداختنی','liability','credit'),
    ('245','ذخیره مزایای پایان خدمت کارکنان','liability','credit'),
    ('250','پیش‌دریافت از مشتریان','liability','credit'),
    ('260','تسهیلات مالی کوتاه‌مدت','liability','credit'),
    ('265','حصه جاری بدهی‌ها و تسهیلات بلندمدت','liability','credit'),
    ('270','بدهی‌ها و تسهیلات بلندمدت','liability','credit'),
    ('275','بدهی‌های اجاره','liability','credit'),
    ('280','ذخایر و تعهدات','liability','credit'),
    ('285','بدهی مالیات انتقالی','liability','credit'),
    ('290','سایر بدهی‌های غیرجاری','liability','credit'),

    ('310','سرمایه','equity','credit'),
    ('315','افزایش سرمایه در جریان','equity','credit'),
    ('320','اندوخته قانونی و سایر اندوخته‌ها','equity','credit'),
    ('325','سهام خزانه یا سهم‌الشرکه بازخریدشده','equity','debit'),
    ('330','سود و زیان انباشته','equity','credit'),
    ('335','تعدیلات سنواتی','equity','credit'),
    ('340','سود و زیان سال جاری','equity','credit'),
    ('345','مازاد تجدید ارزیابی و سایر اقلام حقوق مالکانه','equity','credit'),

    ('410','درآمد عملیاتی','income','credit'),
    ('425','سایر درآمدهای عملیاتی','income','credit'),
    ('430','درآمدهای غیرعملیاتی','income','credit'),
    ('435','درآمدهای مالی و سرمایه‌گذاری','income','credit'),
    ('440','سود فروش دارایی‌ها و سرمایه‌گذاری‌ها','income','credit'),

    ('510','هزینه‌های عمومی','expense','debit'),
    ('520','بهای تمام‌شده کالا و خدمات','expense','debit'),
    ('530','هزینه‌های فروش و توزیع','expense','debit'),
    ('540','هزینه‌های حقوق و مزایا','expense','debit'),
    ('550','هزینه استهلاک و آمورتایز','expense','debit'),
    ('560','هزینه‌های مالی','expense','debit'),
    ('570','سایر هزینه‌های عملیاتی','expense','debit'),
    ('580','هزینه‌های غیرعملیاتی','expense','debit'),
    ('585','زیان کاهش ارزش و فروش دارایی‌ها','expense','debit'),
    ('590','هزینه مالیات بر درآمد','expense','debit')
  ) as x(code,name,category,normal_balance)
  on conflict (workspace_id,code) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function private.ensure_standard_account_chart(uuid) from public, anon, authenticated;

create or replace function public.guard_account_structure()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  p public.accounts%rowtype;
  expected_normal text;
begin
  if new.category in ('liability','equity','income') then expected_normal := 'credit';
  else expected_normal := 'debit'; end if;

  if new.parent_id is null then
    if new.level <> 1 then raise exception 'ROOT_ACCOUNT_LEVEL_MUST_BE_1'; end if;
  else
    select * into p from public.accounts where id = new.parent_id;
    if not found then raise exception 'PARENT_ACCOUNT_NOT_FOUND'; end if;
    if p.workspace_id <> new.workspace_id then raise exception 'PARENT_ACCOUNT_WORKSPACE_MISMATCH'; end if;
    if p.level >= 3 then raise exception 'MAX_ACCOUNT_LEVEL'; end if;
    new.level := p.level + 1;
    new.category := p.category;
    expected_normal := p.normal_balance;
  end if;

  if new.is_system and new.level = 2 then
    if new.category='asset' and new.code in ('170','185') then expected_normal := 'credit';
    elsif new.category='equity' and new.code='325' then expected_normal := 'debit';
    end if;
  end if;

  if exists (
    select 1 from public.account_roles ar
    where ar.workspace_id=new.workspace_id
      and ar.account_id=new.id
      and ar.role_key='sales_discount'
  ) then expected_normal := 'debit'; end if;

  new.normal_balance := expected_normal;
  new.is_postable := (new.level=3);
  new.updated_at := now();
  return new;
end
$$;

-- Migration-controlled metadata correction. The system-account protection trigger
-- is disabled only inside the migration transaction and re-enabled immediately.
alter table public.accounts disable trigger trg_guard_account_update;
update public.accounts set normal_balance='credit'
where is_system and level=2 and category='asset' and code in ('170','185');
update public.accounts set normal_balance='debit'
where is_system and level=2 and category='equity' and code='325';
alter table public.accounts enable trigger trg_guard_account_update;

DO $$
declare r record;
begin
  for r in select id from public.workspaces loop
    perform private.ensure_standard_account_chart(r.id);
  end loop;
end
$$;
