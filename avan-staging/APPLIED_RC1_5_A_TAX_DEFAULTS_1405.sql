-- Applied to Supabase project Avan-production
-- Migration: rc1_5_a_tax_defaults_1405
-- Tax remains disabled by default for every Company.

insert into public.workspace_tax_settings(workspace_id,tax_enabled,default_rule_version_id,taxpayer_type,e_invoice_enabled)
select w.id,false,r.id,'unspecified',false
from public.workspaces w
cross join lateral (
  select id from public.tax_rule_versions
  where rule_code='IR_GENERAL_VAT' and version_no=1
  limit 1
) r
on conflict (workspace_id) do nothing;

insert into public.tax_profiles(workspace_id,code,name_fa,treatment,rate,applies_to,rule_version_id,is_active)
select w.id,v.code,v.name_fa,v.treatment,v.rate,v.applies_to,r.id,true
from public.workspaces w
cross join lateral (
  select id from public.tax_rule_versions
  where rule_code='IR_GENERAL_VAT' and version_no=1
  limit 1
) r
cross join (values
  ('VAT_STD_1405','مشمول نرخ عمومی ارزش افزوده ۱۴۰۵','standard'::text,10.0000::numeric,'both'::text),
  ('VAT_EXEMPT','معاف از مالیات بر ارزش افزوده','exempt'::text,0.0000::numeric,'both'::text),
  ('VAT_ZERO','مشمول نرخ صفر','zero'::text,0.0000::numeric,'both'::text)
) as v(code,name_fa,treatment,rate,applies_to)
on conflict (workspace_id,code) do nothing;
