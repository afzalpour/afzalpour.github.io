-- Avan RC1.2-E — Company print identity + private branding logo
-- Run once in Supabase SQL Editor before the RC1.2-E live gate.
-- No Ledger tables or journal lifecycle are changed.

begin;

create table if not exists public.workspace_print_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  display_name text,
  legal_name text,
  registration_no text,
  national_id text,
  economic_code text,
  tax_id text,
  phone text,
  email text,
  postal_code text,
  address text,
  logo_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint workspace_print_profiles_display_name_len check (display_name is null or char_length(display_name) <= 160),
  constraint workspace_print_profiles_legal_name_len check (legal_name is null or char_length(legal_name) <= 200),
  constraint workspace_print_profiles_registration_len check (registration_no is null or char_length(registration_no) <= 64),
  constraint workspace_print_profiles_national_id_len check (national_id is null or char_length(national_id) <= 64),
  constraint workspace_print_profiles_economic_code_len check (economic_code is null or char_length(economic_code) <= 64),
  constraint workspace_print_profiles_tax_id_len check (tax_id is null or char_length(tax_id) <= 96),
  constraint workspace_print_profiles_phone_len check (phone is null or char_length(phone) <= 64),
  constraint workspace_print_profiles_email_len check (email is null or char_length(email) <= 160),
  constraint workspace_print_profiles_postal_code_len check (postal_code is null or char_length(postal_code) <= 32),
  constraint workspace_print_profiles_address_len check (address is null or char_length(address) <= 600),
  constraint workspace_print_profiles_logo_path_len check (logo_path is null or char_length(logo_path) <= 500)
);

alter table public.workspace_print_profiles enable row level security;
revoke all on table public.workspace_print_profiles from public, anon, authenticated;

create or replace function public.get_workspace_print_profile(wid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace_name text;
  v_profile public.workspace_print_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.has_workspace_access(wid) then
    raise exception 'FORBIDDEN';
  end if;

  select name into v_workspace_name
  from public.workspaces
  where id = wid;

  if not found then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;

  select * into v_profile
  from public.workspace_print_profiles
  where workspace_id = wid;

  return jsonb_build_object(
    'workspace_id', wid,
    'display_name', coalesce(v_profile.display_name, v_workspace_name),
    'legal_name', v_profile.legal_name,
    'registration_no', v_profile.registration_no,
    'national_id', v_profile.national_id,
    'economic_code', v_profile.economic_code,
    'tax_id', v_profile.tax_id,
    'phone', v_profile.phone,
    'email', v_profile.email,
    'postal_code', v_profile.postal_code,
    'address', v_profile.address,
    'logo_path', v_profile.logo_path,
    'updated_at', v_profile.updated_at
  );
end $$;

revoke all on function public.get_workspace_print_profile(uuid) from public;
grant execute on function public.get_workspace_print_profile(uuid) to authenticated;

create or replace function public.set_workspace_print_profile(
  wid uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_display_name text;
  v_legal_name text;
  v_registration_no text;
  v_national_id text;
  v_economic_code text;
  v_tax_id text;
  v_phone text;
  v_email text;
  v_postal_code text;
  v_address text;
  v_logo_path text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.has_workspace_access(wid) then
    raise exception 'FORBIDDEN';
  end if;

  v_role := public.workspace_role(wid);
  if v_role not in ('owner', 'manager') then
    raise exception 'FORBIDDEN';
  end if;

  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'PROFILE_INVALID';
  end if;

  v_display_name := nullif(btrim(p_profile->>'display_name'), '');
  v_legal_name := nullif(btrim(p_profile->>'legal_name'), '');
  v_registration_no := nullif(btrim(p_profile->>'registration_no'), '');
  v_national_id := nullif(btrim(p_profile->>'national_id'), '');
  v_economic_code := nullif(btrim(p_profile->>'economic_code'), '');
  v_tax_id := nullif(btrim(p_profile->>'tax_id'), '');
  v_phone := nullif(btrim(p_profile->>'phone'), '');
  v_email := nullif(btrim(p_profile->>'email'), '');
  v_postal_code := nullif(btrim(p_profile->>'postal_code'), '');
  v_address := nullif(btrim(p_profile->>'address'), '');
  v_logo_path := nullif(btrim(p_profile->>'logo_path'), '');

  if char_length(coalesce(v_display_name, '')) > 160
     or char_length(coalesce(v_legal_name, '')) > 200
     or char_length(coalesce(v_registration_no, '')) > 64
     or char_length(coalesce(v_national_id, '')) > 64
     or char_length(coalesce(v_economic_code, '')) > 64
     or char_length(coalesce(v_tax_id, '')) > 96
     or char_length(coalesce(v_phone, '')) > 64
     or char_length(coalesce(v_email, '')) > 160
     or char_length(coalesce(v_postal_code, '')) > 32
     or char_length(coalesce(v_address, '')) > 600
     or char_length(coalesce(v_logo_path, '')) > 500 then
    raise exception 'PROFILE_FIELD_TOO_LONG';
  end if;

  if v_logo_path is not null and v_logo_path not like wid::text || '/%' then
    raise exception 'PROFILE_LOGO_PATH_INVALID';
  end if;

  insert into public.workspace_print_profiles (
    workspace_id,
    display_name,
    legal_name,
    registration_no,
    national_id,
    economic_code,
    tax_id,
    phone,
    email,
    postal_code,
    address,
    logo_path,
    updated_at,
    updated_by
  ) values (
    wid,
    v_display_name,
    v_legal_name,
    v_registration_no,
    v_national_id,
    v_economic_code,
    v_tax_id,
    v_phone,
    v_email,
    v_postal_code,
    v_address,
    v_logo_path,
    now(),
    auth.uid()
  )
  on conflict (workspace_id) do update set
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    registration_no = excluded.registration_no,
    national_id = excluded.national_id,
    economic_code = excluded.economic_code,
    tax_id = excluded.tax_id,
    phone = excluded.phone,
    email = excluded.email,
    postal_code = excluded.postal_code,
    address = excluded.address,
    logo_path = excluded.logo_path,
    updated_at = now(),
    updated_by = auth.uid();

  insert into public.audit_logs(
    workspace_id,
    action,
    entity_type,
    entity_id,
    summary
  ) values (
    wid,
    'workspace_print_profile_changed',
    'workspace_print_profile',
    wid,
    'Workspace print identity updated'
  );

  return public.get_workspace_print_profile(wid);
end $$;

revoke all on function public.set_workspace_print_profile(uuid,jsonb) from public;
grant execute on function public.set_workspace_print_profile(uuid,jsonb) to authenticated;

-- Private logo bucket. Only members can read signed originals; only Owner/Manager can mutate.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avan-branding',
  'avan-branding',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avan_branding_member_read on storage.objects;
create policy avan_branding_member_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avan-branding'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.has_workspace_access(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists avan_branding_admin_insert on storage.objects;
create policy avan_branding_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avan-branding'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_role(((storage.foldername(name))[1])::uuid) in ('owner','manager')
    else false
  end
);

drop policy if exists avan_branding_admin_update on storage.objects;
create policy avan_branding_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avan-branding'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_role(((storage.foldername(name))[1])::uuid) in ('owner','manager')
    else false
  end
)
with check (
  bucket_id = 'avan-branding'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_role(((storage.foldername(name))[1])::uuid) in ('owner','manager')
    else false
  end
);

drop policy if exists avan_branding_admin_delete on storage.objects;
create policy avan_branding_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avan-branding'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.workspace_role(((storage.foldername(name))[1])::uuid) in ('owner','manager')
    else false
  end
);

commit;

-- Verification examples after applying:
-- select public.get_workspace_print_profile('<workspace-uuid>'::uuid);
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='avan-branding';
