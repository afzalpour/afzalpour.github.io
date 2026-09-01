-- =========================================================
-- AVAN DELIVERY-3
-- Document Intelligence Foundation
-- Image / PDF -> OCR -> Extraction -> Review -> Ledger Link
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1) Documents metadata
-- ---------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  party_id uuid null
    references public.parties(id)
    on delete set null,

  document_type text not null default 'other'
    check (
      document_type in (
        'receipt',
        'invoice',
        'purchase_invoice',
        'sales_invoice',
        'bank_slip',
        'other'
      )
    ),

  status text not null default 'uploaded'
    check (
      status in (
        'uploaded',
        'ocr_processing',
        'extracted',
        'reviewed',
        'linked',
        'rejected'
      )
    ),

  file_name text not null,
  file_path text not null,
  mime_type text not null,

  size_bytes bigint null
    check (
      size_bytes is null
      or size_bytes >= 0
    ),

  file_hash text null,

  source_document_date date null,

  total_amount numeric null
    check (
      total_amount is null
      or total_amount >= 0
    ),

  ocr_text text null,

  extracted_data jsonb not null
    default '{}'::jsonb,

  confidence jsonb not null
    default '{}'::jsonb,

  linked_journal_entry_id uuid null
    references public.journal_entries(id)
    on delete set null,

  created_by uuid not null
  default auth.uid(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index if not exists
  idx_documents_workspace_created
on public.documents(
  workspace_id,
  created_at desc
);

create index if not exists
  idx_documents_workspace_status
on public.documents(
  workspace_id,
  status
);

create index if not exists
  idx_documents_party
on public.documents(
  party_id
);

create index if not exists
  idx_documents_hash
on public.documents(
  workspace_id,
  file_hash
);

-- ---------------------------------------------------------
-- 2) updated_at
-- ---------------------------------------------------------

create or replace function
public.touch_avan_document_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists
  trg_documents_updated_at
on public.documents;

create trigger
  trg_documents_updated_at
before update
on public.documents
for each row
execute function
  public.touch_avan_document_updated_at();


-- ---------------------------------------------------------
-- 2.1) Workspace / lineage integrity
-- ---------------------------------------------------------

create or replace function
public.guard_avan_document_integrity()
returns trigger
language plpgsql
set search_path=public
as $$
begin

  if tg_op='UPDATE'
     and old.linked_journal_entry_id
         is not null
  then
    raise exception
      'LINKED_DOCUMENT_IMMUTABLE';
  end if;

  if tg_op='DELETE' then

    if old.linked_journal_entry_id
       is not null
    then
      raise exception
        'LINKED_DOCUMENT_IMMUTABLE';
    end if;

    return old;
  end if;

  if tg_op='UPDATE'
     and new.workspace_id
         is distinct from
         old.workspace_id
  then
    raise exception
      'DOCUMENT_WORKSPACE_IMMUTABLE';
  end if;

  if new.party_id is not null
     and not exists (
       select 1
       from public.parties p
       where p.id=new.party_id
         and p.workspace_id=
             new.workspace_id
     )
  then
    raise exception
      'DOCUMENT_PARTY_WORKSPACE_MISMATCH';
  end if;

  if new.linked_journal_entry_id
     is not null
  then

    if not exists (
      select 1
      from public.journal_entries j
      where
        j.id=
          new.linked_journal_entry_id
        and j.workspace_id=
          new.workspace_id
        and j.status<>'draft'
    )
    then
      raise exception
        'DOCUMENT_JOURNAL_WORKSPACE_MISMATCH';
    end if;

    if new.status<>'linked' then
      raise exception
        'DOCUMENT_LINK_STATUS_INVALID';
    end if;

  elsif new.status='linked' then

    raise exception
      'DOCUMENT_LINK_REQUIRED';

  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_documents_integrity
on public.documents;

create trigger
  trg_documents_integrity
before insert
or update
or delete
on public.documents
for each row
execute function
  public.guard_avan_document_integrity();

-- ---------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------

alter table public.documents
enable row level security;

drop policy if exists
  documents_select
on public.documents;

create policy
  documents_select
on public.documents
for select
to authenticated
using (
  public.has_workspace_access(
    workspace_id
  )
);

drop policy if exists
  documents_insert
on public.documents;

create policy
  documents_insert
on public.documents
for insert
to authenticated
with check (
  public.has_workspace_access(
    workspace_id
  )
  and created_by =
    (select auth.uid())
);

drop policy if exists
  documents_update
on public.documents;

create policy
  documents_update
on public.documents
for update
to authenticated
using (
  public.has_workspace_access(
    workspace_id
  )
  and public.workspace_role(
    workspace_id
  ) in (
    'owner',
    'manager',
    'financial_manager',
    'accountant'
  )
)
with check (
  public.has_workspace_access(
    workspace_id
  )
  and public.workspace_role(
    workspace_id
  ) in (
    'owner',
    'manager',
    'financial_manager',
    'accountant'
  )
);

drop policy if exists
  documents_delete
on public.documents;

create policy
  documents_delete
on public.documents
for delete
to authenticated
using (
  linked_journal_entry_id is null
  and public.workspace_role(
    workspace_id
  ) in (
    'owner',
    'manager',
    'financial_manager'
  )
);

revoke all
on public.documents
from authenticated;

grant
  select,
  insert,
  update,
  delete
on public.documents
to authenticated;

-- ---------------------------------------------------------
-- 4) Storage bucket
-- Max 10 MB
-- ---------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avan-documents',
  'avan-documents',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id)
do update set
  public=false,
  file_size_limit=10485760,
  allowed_mime_types=
    excluded.allowed_mime_types;

-- ---------------------------------------------------------
-- 5) Storage RLS
-- Path convention:
-- workspace_id/user_id/file
-- ---------------------------------------------------------

drop policy if exists
  avan_documents_storage_select
on storage.objects;

create policy
  avan_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id='avan-documents'
  and
  public.has_workspace_access(
    (
      (storage.foldername(name))[1]
    )::uuid
  )
);

drop policy if exists
  avan_documents_storage_insert
on storage.objects;

create policy
  avan_documents_storage_insert
on storage.objects
for insert
to authenticated

  with check (
  bucket_id='avan-documents'

  and public.has_workspace_access(
    (
      (storage.foldername(name))[1]
    )::uuid
  )

  and (
    (storage.foldername(name))[2]
  ) = (
    (select auth.uid())::text
  )
);

-- Source files are immutable after upload.
drop policy if exists
  avan_documents_storage_update
on storage.objects;

drop policy if exists
  avan_documents_storage_delete
on storage.objects;

create policy
  avan_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='avan-documents'
  and
  public.workspace_role(
    (
      (storage.foldername(name))[1]
    )::uuid
  ) in (
    'owner',
    'manager',
    'financial_manager'
  )
);

-- ---------------------------------------------------------
-- 6) Audit trail
-- ---------------------------------------------------------

create or replace function
public.audit_avan_document()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin

  if tg_op='INSERT' then

    insert into public.audit_logs(
      workspace_id,
      action,
      entity_type,
      entity_id,
      summary
    )
    values(
      new.workspace_id,
      'upload',
      'document',
      new.id,
      'Document uploaded'
    );

  elsif
    tg_op='UPDATE'
    and new.status is distinct
        from old.status
  then

    insert into public.audit_logs(
      workspace_id,
      action,
      entity_type,
      entity_id,
      summary
    )
    values(
      new.workspace_id,
      'status_change',
      'document',
      new.id,
      'Document status: '
      || old.status
      || ' -> '
      || new.status
    );

  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_documents_audit
on public.documents;

create trigger
  trg_documents_audit
after insert
or update of status
on public.documents
for each row
execute function
  public.audit_avan_document();

-- =========================================================
-- END DELIVERY-3A
-- =========================================================
