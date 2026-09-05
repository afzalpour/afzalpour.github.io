-- Avan RC1.3-B — Company operational profile completion
-- Extends the existing workspace_print_profiles source of truth.
-- No Ledger, Journal lifecycle, invoice posting, RLS boundary or tax-rate logic changes.

begin;

alter table public.workspace_print_profiles
  add column if not exists entity_type text,
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists invoice_footer text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_print_profiles_entity_type_check'
  ) then
    alter table public.workspace_print_profiles
      add constraint workspace_print_profiles_entity_type_check
      check (entity_type is null or entity_type in ('individual','legal','other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_print_profiles_province_len'
  ) then
    alter table public.workspace_print_profiles
      add constraint workspace_print_profiles_province_len
      check (province is null or char_length(province) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_print_profiles_city_len'
  ) then
    alter table public.workspace_print_profiles
      add constraint workspace_print_profiles_city_len
      check (city is null or char_length(city) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workspace_print_profiles_invoice_footer_len'
  ) then
    alter table public.workspace_print_profiles
      add constraint workspace_print_profiles_invoice_footer_len
      check (invoice_footer is null or char_length(invoice_footer) <= 600);
  end if;
end $$;

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
    'entity_type', v_profile.entity_type,
    'registration_no', v_profile.registration_no,
    'national_id', v_profile.national_id,
    'economic_code', v_profile.economic_code,
    'tax_id', v_profile.tax_id,
    'phone', v_profile.phone,
    'email', v_profile.email,
    'postal_code', v_profile.postal_code,
    'province', v_profile.province,
    'city', v_profile.city,
    'address', v_profile.address,
    'invoice_footer', v_profile.invoice_footer,
    'logo_path', v_profile.logo_path,
    'updated_at', v_profile.updated_at
  );
end $$;

revoke all on function public.get_workspace_print_profile(uuid) from public, anon;
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
  v_entity_type text;
  v_registration_no text;
  v_national_id text;
  v_economic_code text;
  v_tax_id text;
  v_phone text;
  v_email text;
  v_postal_code text;
  v_province text;
  v_city text;
  v_address text;
  v_invoice_footer text;
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
  v_entity_type := nullif(btrim(p_profile->>'entity_type'), '');
  v_registration_no := nullif(btrim(p_profile->>'registration_no'), '');
  v_national_id := nullif(btrim(p_profile->>'national_id'), '');
  v_economic_code := nullif(btrim(p_profile->>'economic_code'), '');
  v_tax_id := nullif(btrim(p_profile->>'tax_id'), '');
  v_phone := nullif(btrim(p_profile->>'phone'), '');
  v_email := nullif(btrim(p_profile->>'email'), '');
  v_postal_code := nullif(btrim(p_profile->>'postal_code'), '');
  v_province := nullif(btrim(p_profile->>'province'), '');
  v_city := nullif(btrim(p_profile->>'city'), '');
  v_address := nullif(btrim(p_profile->>'address'), '');
  v_invoice_footer := nullif(btrim(p_profile->>'invoice_footer'), '');
  v_logo_path := nullif(btrim(p_profile->>'logo_path'), '');

  if v_entity_type is not null and v_entity_type not in ('individual','legal','other') then
    raise exception 'PROFILE_ENTITY_TYPE_INVALID';
  end if;

  if char_length(coalesce(v_display_name, '')) > 160
     or char_length(coalesce(v_legal_name, '')) > 200
     or char_length(coalesce(v_registration_no, '')) > 64
     or char_length(coalesce(v_national_id, '')) > 64
     or char_length(coalesce(v_economic_code, '')) > 64
     or char_length(coalesce(v_tax_id, '')) > 96
     or char_length(coalesce(v_phone, '')) > 64
     or char_length(coalesce(v_email, '')) > 160
     or char_length(coalesce(v_postal_code, '')) > 32
     or char_length(coalesce(v_province, '')) > 120
     or char_length(coalesce(v_city, '')) > 120
     or char_length(coalesce(v_address, '')) > 600
     or char_length(coalesce(v_invoice_footer, '')) > 600
     or char_length(coalesce(v_logo_path, '')) > 500 then
    raise exception 'PROFILE_FIELD_TOO_LONG';
  end if;

  if v_logo_path is not null and v_logo_path not like wid::text || '/%' then
    raise exception 'PROFILE_LOGO_PATH_INVALID';
  end if;

  insert into public.workspace_print_profiles (
    workspace_id, display_name, legal_name, entity_type, registration_no,
    national_id, economic_code, tax_id, phone, email, postal_code,
    province, city, address, invoice_footer, logo_path, updated_at, updated_by
  ) values (
    wid, v_display_name, v_legal_name, v_entity_type, v_registration_no,
    v_national_id, v_economic_code, v_tax_id, v_phone, v_email, v_postal_code,
    v_province, v_city, v_address, v_invoice_footer, v_logo_path, now(), auth.uid()
  )
  on conflict (workspace_id) do update set
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    entity_type = excluded.entity_type,
    registration_no = excluded.registration_no,
    national_id = excluded.national_id,
    economic_code = excluded.economic_code,
    tax_id = excluded.tax_id,
    phone = excluded.phone,
    email = excluded.email,
    postal_code = excluded.postal_code,
    province = excluded.province,
    city = excluded.city,
    address = excluded.address,
    invoice_footer = excluded.invoice_footer,
    logo_path = excluded.logo_path,
    updated_at = now(),
    updated_by = auth.uid();

  insert into public.audit_logs(workspace_id, action, entity_type, entity_id, summary)
  values (
    wid,
    'workspace_print_profile_changed',
    'workspace_print_profile',
    wid,
    'Workspace company identity and operational print settings updated'
  );

  return public.get_workspace_print_profile(wid);
end $$;

revoke all on function public.set_workspace_print_profile(uuid,jsonb) from public, anon;
grant execute on function public.set_workspace_print_profile(uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
