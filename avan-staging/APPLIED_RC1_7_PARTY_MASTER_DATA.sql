-- RC1.7 Party Master Data
-- Applied to Avan-production before committing this audit copy.
-- Additive only: preserves existing party IDs, accounting links and RLS policy.

alter table public.parties
  add column if not exists entity_type text not null default 'unspecified',
  add column if not exists legal_name text,
  add column if not exists registration_no text,
  add column if not exists tax_id text,
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists website text,
  add column if not exists contact_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parties'::regclass
      and conname = 'parties_entity_type_check'
  ) then
    alter table public.parties
      add constraint parties_entity_type_check
      check (entity_type = any (array['unspecified'::text, 'individual'::text, 'legal'::text]));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parties'::regclass
      and conname = 'parties_legal_name_len_chk'
  ) then
    alter table public.parties
      add constraint parties_legal_name_len_chk
      check (legal_name is null or char_length(btrim(legal_name)) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parties'::regclass
      and conname = 'parties_registration_no_len_chk'
  ) then
    alter table public.parties
      add constraint parties_registration_no_len_chk
      check (registration_no is null or char_length(btrim(registration_no)) between 1 and 64);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parties'::regclass
      and conname = 'parties_tax_id_len_chk'
  ) then
    alter table public.parties
      add constraint parties_tax_id_len_chk
      check (tax_id is null or char_length(btrim(tax_id)) between 1 and 96);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.parties'::regclass
      and conname = 'parties_address_len_chk'
  ) then
    alter table public.parties
      add constraint parties_address_len_chk
      check (address is null or char_length(btrim(address)) between 1 and 600);
  end if;
end $$;

create index if not exists parties_workspace_entity_type_idx
  on public.parties(workspace_id, entity_type);

create index if not exists parties_workspace_tax_id_idx
  on public.parties(workspace_id, tax_id)
  where tax_id is not null;

comment on column public.parties.entity_type is
  'Counterparty legal form: individual, legal, or unspecified for legacy records.';
comment on column public.parties.kind is
  'Counterparty commercial role: customer, vendor, both, or other.';
