-- آوان — RC1.2-C.4.3
-- حذف امن سند هوشمندِ بدون اتصال
-- این Patch فقط Metadata سند را حذف می‌کند؛ فایل Storage بعد از موفقیت RPC
-- توسط Client احراز‌شده حذف می‌شود.

begin;

create or replace function public.protect_linked_smart_document_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'linked' or old.linked_journal_entry_id is not null then
    raise exception 'LINKED_DOCUMENT_IMMUTABLE';
  end if;

  if coalesce(old.extracted_data #>> '{accounting_draft,entity_id}', '') <> '' then
    raise exception 'DOCUMENT_HAS_ACCOUNTING_DRAFT';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_protect_linked_smart_document_delete
  on public.documents;

create trigger trg_protect_linked_smart_document_delete
before delete on public.documents
for each row
execute function public.protect_linked_smart_document_delete();

create or replace function public.delete_unlinked_smart_document(
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;

  select wm.role
    into v_role
  from public.workspace_members wm
  where wm.workspace_id = v_doc.workspace_id
    and wm.user_id = auth.uid()
    and coalesce(wm.is_active, true)
  limit 1;

  if v_role is null then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  if v_role not in ('owner','manager','financial_manager','accountant') then
    raise exception 'DOCUMENT_DELETE_ROLE_DENIED';
  end if;

  if v_doc.status = 'linked' or v_doc.linked_journal_entry_id is not null then
    raise exception 'LINKED_DOCUMENT_IMMUTABLE';
  end if;

  if coalesce(v_doc.extracted_data #>> '{accounting_draft,entity_id}', '') <> '' then
    raise exception 'DOCUMENT_HAS_ACCOUNTING_DRAFT';
  end if;

  delete from public.documents
  where id = v_doc.id;

  return jsonb_build_object(
    'id', v_doc.id,
    'workspace_id', v_doc.workspace_id,
    'file_path', v_doc.file_path,
    'file_name', v_doc.file_name,
    'deleted', true
  );
end;
$$;

revoke all on function public.delete_unlinked_smart_document(uuid) from public;
grant execute on function public.delete_unlinked_smart_document(uuid) to authenticated;

-- اجازه پاکسازی فایل خصوصی پس از حذف Metadata.
-- مسیر فایل‌های آوان با workspace_id شروع می‌شود؛ کاربر باید عضو فعال همان workspace باشد.
drop policy if exists avan_documents_storage_delete on storage.objects;
create policy avan_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avan-documents'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and coalesce(wm.is_active, true)
      and wm.workspace_id::text = split_part(name, '/', 1)
      and wm.role in ('owner','manager','financial_manager','accountant')
  )
);

commit;
