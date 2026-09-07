-- Applied to Supabase project Avan-production
-- Migration: rc1_5_b_vat_account_roles
-- Version: 20260907211545

with parents as (
  select a.workspace_id,a.id,a.code,a.category,a.normal_balance,
         case a.code when '150' then 'vat_input_receivable' when '230' then 'vat_output_payable' end role_key,
         case a.code when '150' then 'اعتبار مالیاتی ارزش افزوده خرید' when '230' then 'مالیات بر ارزش افزوده فروش پرداختنی' end child_name
  from public.accounts a
  where a.code in ('150','230') and a.level=2 and a.is_active
), ins as (
  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system,is_active)
  select p.workspace_id,p.id,'',p.child_name,3,p.category,p.normal_balance,true,true,true
  from parents p
  where not exists(select 1 from public.account_roles ar where ar.workspace_id=p.workspace_id and ar.role_key=p.role_key)
  returning workspace_id,id,name
)
insert into public.account_roles(workspace_id,role_key,account_id)
select i.workspace_id,
       case when i.name='اعتبار مالیاتی ارزش افزوده خرید' then 'vat_input_receivable' else 'vat_output_payable' end,
       i.id
from ins i;
