-- RC1.5-A — Versioned Tax Data Foundation (draft / rehearsal source)
-- No external tax submission is enabled in Gate A.

create table if not exists public.tax_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null,
  version_no integer not null check (version_no > 0),
  name_fa text not null,
  effective_from date not null,
  effective_to date null,
  standard_vat_rate numeric(7,4) not null check (standard_vat_rate >= 0 and standard_vat_rate <= 100),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  source_title text null,
  source_reference text null,
  rule_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(rule_code, version_no),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.workspace_tax_settings (
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

create table if not exists public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name_fa text not null,
  treatment text not null check (treatment in ('standard','exempt','zero','custom')),
  rate numeric(7,4) not null check (rate >= 0 and rate <= 100),
  applies_to text not null default 'both' check (applies_to in ('sale','purchase','both')),
  rule_version_id uuid null references public.tax_rule_versions(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, code),
  check ((treatment in ('exempt','zero') and rate = 0) or treatment in ('standard','custom'))
);

alter table public.inventory_items
  add column if not exists tax_profile_id uuid null;

-- Historical invoice snapshots are intentionally nullable for legacy rows.
alter table public.invoice_lines
  add column if not exists tax_profile_id uuid null,
  add column if not exists tax_rate numeric(7,4) null,
  add column if not exists taxable_amount bigint null,
  add column if not exists tax_amount bigint null;

-- Company-scoped composite references are added by the migration after validating existing schema keys.
-- Gate A rehearsal must verify RLS, indexes, grants, effective-date lookup and unchanged Ledger baseline.
