-- Applied to Supabase project Avan-production
-- Migration: rc1_5_a_versioned_tax_foundation

create table public.tax_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null,
  version_no integer not null check (version_no > 0),
  name_fa text not null check (btrim(name_fa) <> ''),
  effective_from date not null,
  effective_to date null,
  standard_vat_rate numeric(7,4) not null check (standard_vat_rate >= 0 and standard_vat_rate <= 100),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  source_title text null,
  source_reference text null,
  rule_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(rule_code, version_no),
  unique(rule_code, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.workspace_tax_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  tax_enabled boolean not null default false,
  default_rule_version_id uuid null references public.tax_rule_versions(id),
  taxpayer_type text not null default 'unspecified' check (taxpayer_type in ('unspecified','individual','legal_entity','nonprofit','other')),
  tax_identifier text null,
  economic_code text null,
  taxpayer_memory_id text null,
  e_invoice_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (btrim(code) <> ''),
  name_fa text not null check (btrim(name_fa) <> ''),
  treatment text not null check (treatment in ('standard','exempt','zero','custom')),
  rate numeric(7,4) not null check (rate >= 0 and rate <= 100),
  applies_to text not null default 'both' check (applies_to in ('sale','purchase','both')),
  rule_version_id uuid null references public.tax_rule_versions(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, code),
  unique(workspace_id, id),
  check ((treatment in ('exempt','zero') and rate = 0) or treatment in ('standard','custom'))
);

alter table public.inventory_items add column tax_profile_id uuid null;
alter table public.invoice_lines
  add column tax_profile_id uuid null,
  add column tax_rule_version_id uuid null,
  add column tax_rate numeric(7,4) null check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  add column taxable_amount bigint null check (taxable_amount is null or taxable_amount >= 0),
  add column tax_amount bigint null check (tax_amount is null or tax_amount >= 0);

alter table public.inventory_items add constraint inventory_items_tax_profile_fk
  foreign key (workspace_id,tax_profile_id) references public.tax_profiles(workspace_id,id);
alter table public.invoice_lines add constraint invoice_lines_tax_profile_fk
  foreign key (workspace_id,tax_profile_id) references public.tax_profiles(workspace_id,id);
alter table public.invoice_lines add constraint invoice_lines_tax_rule_version_fk
  foreign key (tax_rule_version_id) references public.tax_rule_versions(id);

create index tax_profiles_workspace_active_idx on public.tax_profiles(workspace_id,is_active);
create index inventory_items_workspace_tax_profile_idx on public.inventory_items(workspace_id,tax_profile_id) where tax_profile_id is not null;
create index invoice_lines_workspace_tax_profile_idx on public.invoice_lines(workspace_id,tax_profile_id) where tax_profile_id is not null;
create index invoice_lines_tax_rule_version_idx on public.invoice_lines(tax_rule_version_id) where tax_rule_version_id is not null;

alter table public.tax_rule_versions enable row level security;
alter table public.workspace_tax_settings enable row level security;
alter table public.tax_profiles enable row level security;

create policy tax_rule_versions_select on public.tax_rule_versions for select to authenticated using (true);
create policy workspace_tax_settings_select on public.workspace_tax_settings for select to authenticated using (public.has_workspace_access(workspace_id));
create policy workspace_tax_settings_insert on public.workspace_tax_settings for insert to authenticated with check (public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));
create policy workspace_tax_settings_update on public.workspace_tax_settings for update to authenticated using (public.workspace_role(workspace_id)=any(array['owner','manager','accountant'])) with check (public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));
create policy tax_profiles_select on public.tax_profiles for select to authenticated using (public.has_workspace_access(workspace_id));
create policy tax_profiles_insert on public.tax_profiles for insert to authenticated with check (public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));
create policy tax_profiles_update on public.tax_profiles for update to authenticated using (public.workspace_role(workspace_id)=any(array['owner','manager','accountant'])) with check (public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));

grant select on public.tax_rule_versions to authenticated;
grant select,insert,update on public.workspace_tax_settings to authenticated;
grant select,insert,update on public.tax_profiles to authenticated;
revoke insert,update,delete on public.tax_rule_versions from authenticated;

insert into public.tax_rule_versions(rule_code,version_no,name_fa,effective_from,effective_to,standard_vat_rate,status,source_title,source_reference,rule_payload)
values ('IR_GENERAL_VAT',1,'نرخ عمومی مالیات بر ارزش افزوده ۱۴۰۵',date '2026-03-21',date '2027-03-20',10.0000,'active','احکام مالیاتی قانون بودجه ۱۴۰۵','بخشنامه سازمان امور مالیاتی ۲۰۰/۱۰۰۵/ص - ۱۴۰۵/۰۱/۳۱',jsonb_build_object('jurisdiction','IR','tax_year',1405,'rate_basis','general_vat'));
