-- RC1.5-C.1.2 applied backend changes
-- 1) Platform tax draft editing for authorized platform admins.
-- 2) Custom report privilege hardening.

create or replace function private.platform_admin_update_tax_rule_impl(
  p_rule_id uuid,
  p_name_fa text,
  p_effective_from date,
  p_effective_to date,
  p_standard_vat_rate numeric,
  p_source_title text,
  p_source_reference text,
  p_rule_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_rule public.tax_rule_versions%rowtype;
  v_name text := nullif(btrim(coalesce(p_name_fa,'')),'');
begin
  v_uid := private.require_platform_admin();
  select * into v_rule from public.tax_rule_versions where id=p_rule_id for update;
  if not found then raise exception 'TAX_RULE_NOT_FOUND'; end if;
  if v_rule.status <> 'draft' then raise exception 'TAX_RULE_IMMUTABLE_AFTER_PUBLISH'; end if;
  if v_name is null or char_length(v_name)>160 then raise exception 'TAX_RULE_NAME_INVALID'; end if;
  if p_effective_from is null then raise exception 'TAX_RULE_START_REQUIRED'; end if;
  if p_effective_to is not null and p_effective_to<p_effective_from then raise exception 'TAX_RULE_DATE_INVALID'; end if;
  if p_standard_vat_rate is null or p_standard_vat_rate<0 or p_standard_vat_rate>100 then raise exception 'TAX_RATE_INVALID'; end if;

  update public.tax_rule_versions
     set name_fa=v_name,
         effective_from=p_effective_from,
         effective_to=p_effective_to,
         standard_vat_rate=p_standard_vat_rate,
         source_title=nullif(btrim(p_source_title),''),
         source_reference=nullif(btrim(p_source_reference),''),
         rule_payload=coalesce(p_rule_payload,'{}'::jsonb)
   where id=p_rule_id;

  insert into private.platform_audit_logs(actor_user_id,action,summary,metadata)
  values(v_uid,'tax_rule_draft_updated','پیش‌نویس قانون مالیاتی ویرایش شد',
    jsonb_build_object('rule_id',p_rule_id,'rule_code',v_rule.rule_code,'version_no',v_rule.version_no));
  return true;
end;
$$;

create or replace function public.platform_admin_update_tax_rule(
  p_rule_id uuid,
  p_name_fa text,
  p_effective_from date,
  p_effective_to date,
  p_standard_vat_rate numeric,
  p_source_title text,
  p_source_reference text,
  p_rule_payload jsonb default '{}'::jsonb
)
returns boolean
language sql
set search_path to ''
as $$
  select private.platform_admin_update_tax_rule_impl(
    p_rule_id,p_name_fa,p_effective_from,p_effective_to,p_standard_vat_rate,
    p_source_title,p_source_reference,p_rule_payload
  );
$$;

revoke all on function public.platform_admin_update_tax_rule(uuid,text,date,date,numeric,text,text,jsonb) from public, anon;
grant execute on function public.platform_admin_update_tax_rule(uuid,text,date,date,numeric,text,text,jsonb) to authenticated, service_role;
revoke all on function public.platform_admin_create_tax_rule(text,text,date,date,numeric,text,text,jsonb) from anon;
revoke all on function public.platform_admin_publish_tax_rule(uuid,text) from anon;

revoke all privileges on table public.custom_reports from anon;
revoke references, trigger, truncate on table public.custom_reports from authenticated;
grant select, insert, update, delete on table public.custom_reports to authenticated;
