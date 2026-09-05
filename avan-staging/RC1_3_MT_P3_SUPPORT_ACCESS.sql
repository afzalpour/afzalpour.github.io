begin;

create table if not exists private.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  access_mode text not null default 'read_only' check (access_mode='read_only'),
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_accessed_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  revocation_reason text null,
  check (expires_at > created_at)
);
alter table private.platform_support_sessions enable row level security;
revoke all on table private.platform_support_sessions from public,anon,authenticated;
create index if not exists idx_platform_support_sessions_tenant_active on private.platform_support_sessions(tenant_id,expires_at desc) where revoked_at is null;
create index if not exists idx_platform_support_sessions_actor on private.platform_support_sessions(actor_user_id,created_at desc);

create or replace function private.platform_admin_create_support_session_impl(p_company_id uuid,p_duration_minutes integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');v_tenant private.platform_tenants%rowtype;v_session_id uuid;v_expires timestamptz;
begin
 v_uid:=private.require_platform_admin();
 if p_duration_minutes is null or p_duration_minutes<5 or p_duration_minutes>60 then raise exception 'SUPPORT_DURATION_INVALID'; end if;
 if v_reason is null or char_length(v_reason)<10 or char_length(v_reason)>500 then raise exception 'SUPPORT_REASON_REQUIRED'; end if;
 select * into v_tenant from private.platform_tenants where workspace_id=p_company_id for update;
 if not found then raise exception 'TENANT_NOT_FOUND'; end if;
 if v_tenant.status='archived' then raise exception 'SUPPORT_ARCHIVED_TENANT_FORBIDDEN'; end if;
 if exists(select 1 from private.platform_support_sessions where tenant_id=p_company_id and revoked_at is null and expires_at>now()) then raise exception 'SUPPORT_SESSION_ALREADY_ACTIVE'; end if;
 v_expires:=now()+make_interval(mins=>p_duration_minutes);
 insert into private.platform_support_sessions(tenant_id,actor_user_id,reason,expires_at) values(p_company_id,v_uid,v_reason,v_expires) returning id into v_session_id;
 update private.platform_tenants set support_state='in_progress',updated_at=now() where workspace_id=p_company_id;
 insert into private.platform_audit_logs(actor_user_id,action,tenant_id,summary,metadata) values(v_uid,'support_session_created',p_company_id,'Read-only support session created',jsonb_build_object('session_id',v_session_id,'access_mode','read_only','reason',v_reason,'expires_at',v_expires));
 insert into public.audit_logs(workspace_id,actor_id,action,entity_type,entity_id,summary) values(p_company_id,v_uid,'support_access_started','support_session',v_session_id,'دسترسی موقت و فقط‌خواندنی پشتیبانی آوان فعال شد.');
 return jsonb_build_object('session_id',v_session_id,'company_id',p_company_id,'access_mode','read_only','reason',v_reason,'expires_at',v_expires,'active',true);
end $$;
revoke all on function private.platform_admin_create_support_session_impl(uuid,integer,text) from public,anon;
grant execute on function private.platform_admin_create_support_session_impl(uuid,integer,text) to authenticated;

create or replace function private.platform_admin_revoke_support_session_impl(p_session_id uuid,p_reason text default 'Support session closed by Platform Admin')
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');v_tenant uuid;
begin
 v_uid:=private.require_platform_admin();
 if v_reason is null or char_length(v_reason)<5 or char_length(v_reason)>500 then raise exception 'SUPPORT_REVOKE_REASON_REQUIRED'; end if;
 update private.platform_support_sessions set revoked_at=coalesce(revoked_at,now()),revoked_by=case when revoked_at is null then v_uid else revoked_by end,revocation_reason=case when revoked_at is null then v_reason else revocation_reason end where id=p_session_id returning tenant_id into v_tenant;
 if v_tenant is null then raise exception 'SUPPORT_SESSION_NOT_FOUND'; end if;
 if not exists(select 1 from private.platform_support_sessions where tenant_id=v_tenant and revoked_at is null and expires_at>now()) then update private.platform_tenants set support_state=case when support_state='in_progress' then 'resolved' else support_state end,updated_at=now() where workspace_id=v_tenant; end if;
 insert into private.platform_audit_logs(actor_user_id,action,tenant_id,summary,metadata) values(v_uid,'support_session_revoked',v_tenant,'Support session revoked by Platform Admin',jsonb_build_object('session_id',p_session_id,'reason',v_reason));
 insert into public.audit_logs(workspace_id,actor_id,action,entity_type,entity_id,summary) values(v_tenant,v_uid,'support_access_revoked','support_session',p_session_id,'دسترسی پشتیبانی آوان لغو شد.');
 return true;
end $$;
revoke all on function private.platform_admin_revoke_support_session_impl(uuid,text) from public,anon;
grant execute on function private.platform_admin_revoke_support_session_impl(uuid,text) to authenticated;

create or replace function private.platform_support_session_info_impl(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_row private.platform_support_sessions%rowtype;v_company_name text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.is_platform_admin(v_uid) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 select * into v_row from private.platform_support_sessions where id=p_session_id;
 if not found or v_row.actor_user_id<>v_uid then raise exception 'SUPPORT_SESSION_NOT_FOUND'; end if;
 select coalesce(p.display_name,w.name) into v_company_name from public.workspaces w left join public.workspace_print_profiles p on p.workspace_id=w.id where w.id=v_row.tenant_id;
 return jsonb_build_object('session_id',v_row.id,'company_id',v_row.tenant_id,'company_name',v_company_name,'access_mode',v_row.access_mode,'reason',v_row.reason,'created_at',v_row.created_at,'expires_at',v_row.expires_at,'last_accessed_at',v_row.last_accessed_at,'revoked_at',v_row.revoked_at,'active',(v_row.revoked_at is null and v_row.expires_at>now()));
end $$;
revoke all on function private.platform_support_session_info_impl(uuid) from public,anon;
grant execute on function private.platform_support_session_info_impl(uuid) to authenticated;

create or replace function private.platform_support_read_impl(p_session_id uuid,p_resource text,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_session private.platform_support_sessions%rowtype;v_resource text:=lower(btrim(coalesce(p_resource,'')));v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));v_result jsonb;v_count integer:=0;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.is_platform_admin(v_uid) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 select * into v_session from private.platform_support_sessions where id=p_session_id for update;
 if not found or v_session.actor_user_id<>v_uid then raise exception 'SUPPORT_SESSION_NOT_FOUND'; end if;
 if v_session.revoked_at is not null then raise exception 'SUPPORT_SESSION_REVOKED'; end if;
 if v_session.expires_at<=now() then raise exception 'SUPPORT_SESSION_EXPIRED'; end if;
 if v_session.access_mode<>'read_only' then raise exception 'SUPPORT_MODE_INVALID'; end if;
 if v_resource='overview' then
  select jsonb_build_object('company',jsonb_build_object('id',w.id,'display_name',coalesce(p.display_name,w.name),'legal_name',p.legal_name,'tenant_status',pt.status,'plan_code',pt.plan_code),'counts',jsonb_build_object('accounts',(select count(*) from public.accounts where workspace_id=w.id),'parties',(select count(*) from public.parties where workspace_id=w.id),'journals',(select count(*) from public.journal_entries where workspace_id=w.id),'invoices',(select count(*) from public.invoices where workspace_id=w.id),'documents',(select count(*) from public.documents where workspace_id=w.id),'fiscal_years',(select count(*) from public.fiscal_years where workspace_id=w.id),'active_members',(select count(*) from public.workspace_members where workspace_id=w.id and is_active))) into v_result from public.workspaces w join private.platform_tenants pt on pt.workspace_id=w.id left join public.workspace_print_profiles p on p.workspace_id=w.id where w.id=v_session.tenant_id;v_count:=1;
 elsif v_resource='accounts' then select coalesce(jsonb_agg(to_jsonb(x) order by x.code),'[]'::jsonb),count(*)::int into v_result,v_count from (select code,name,level,category,is_postable,is_active from public.accounts where workspace_id=v_session.tenant_id order by code limit v_limit)x;
 elsif v_resource='parties' then select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb),count(*)::int into v_result,v_count from (select name,kind,is_active from public.parties where workspace_id=v_session.tenant_id order by name limit v_limit)x;
 elsif v_resource='journals' then select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc,x.journal_no desc),'[]'::jsonb),count(*)::int into v_result,v_count from (select j.journal_no,j.entry_date,j.status,j.source_type,left(coalesce(j.description,''),160) description,(select count(*) from public.journal_lines l where l.journal_entry_id=j.id)::int line_count from public.journal_entries j where j.workspace_id=v_session.tenant_id order by j.entry_date desc,j.journal_no desc limit v_limit)x;
 elsif v_resource='invoices' then select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_date desc,x.invoice_no desc),'[]'::jsonb),count(*)::int into v_result,v_count from (select i.invoice_no,i.invoice_type,i.invoice_date,i.due_date,i.status,i.total_amount,p.name party_name,left(coalesce(i.description,''),160) description from public.invoices i left join public.parties p on p.id=i.party_id and p.workspace_id=i.workspace_id where i.workspace_id=v_session.tenant_id order by i.invoice_date desc,i.invoice_no desc limit v_limit)x;
 elsif v_resource='documents' then select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb),count(*)::int into v_result,v_count from (select document_type,status,file_name,mime_type,size_bytes,source_document_date,total_amount,(linked_journal_entry_id is not null) linked_to_ledger,created_at from public.documents where workspace_id=v_session.tenant_id order by created_at desc limit v_limit)x;
 elsif v_resource='fiscal_years' then select coalesce(jsonb_agg(to_jsonb(x) order by x.date_from desc),'[]'::jsonb),count(*)::int into v_result,v_count from (select name,date_from,date_to,status from public.fiscal_years where workspace_id=v_session.tenant_id order by date_from desc limit v_limit)x;
 else raise exception 'SUPPORT_RESOURCE_INVALID';end if;
 update private.platform_support_sessions set last_accessed_at=now() where id=v_session.id;
 insert into private.platform_audit_logs(actor_user_id,action,tenant_id,summary,metadata) values(v_uid,'support_data_read',v_session.tenant_id,'Read-only support data viewed',jsonb_build_object('session_id',v_session.id,'resource',v_resource,'row_count',v_count));
 return jsonb_build_object('resource',v_resource,'read_only',true,'row_count',v_count,'data',coalesce(v_result,'[]'::jsonb));
end $$;
revoke all on function private.platform_support_read_impl(uuid,text,integer) from public,anon;
grant execute on function private.platform_support_read_impl(uuid,text,integer) to authenticated;

create or replace function private.company_support_sessions_impl(wid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_role text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select role into v_role from public.workspace_members where workspace_id=wid and user_id=v_uid and is_active limit 1;
 if v_role not in ('owner','manager','financial_manager') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('session_id',s.id,'access_mode',s.access_mode,'reason',s.reason,'created_at',s.created_at,'expires_at',s.expires_at,'last_accessed_at',s.last_accessed_at,'revoked_at',s.revoked_at,'active',(s.revoked_at is null and s.expires_at>now())) order by s.created_at desc) from (select * from private.platform_support_sessions where tenant_id=wid order by created_at desc limit 20)s),'[]'::jsonb);
end $$;
revoke all on function private.company_support_sessions_impl(uuid) from public,anon;
grant execute on function private.company_support_sessions_impl(uuid) to authenticated;

create or replace function private.company_revoke_support_session_impl(wid uuid,p_session_id uuid,p_reason text default 'Revoked by Company admin')
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_role text;v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select role into v_role from public.workspace_members where workspace_id=wid and user_id=v_uid and is_active limit 1;
 if v_role not in ('owner','manager','financial_manager') then raise exception 'FORBIDDEN'; end if;
 if v_reason is null or char_length(v_reason)<5 or char_length(v_reason)>500 then raise exception 'SUPPORT_REVOKE_REASON_REQUIRED'; end if;
 update private.platform_support_sessions set revoked_at=now(),revoked_by=v_uid,revocation_reason=v_reason where id=p_session_id and tenant_id=wid and revoked_at is null and expires_at>now();
 if not found then raise exception 'SUPPORT_SESSION_NOT_ACTIVE'; end if;
 update private.platform_tenants set support_state=case when support_state='in_progress' then 'resolved' else support_state end,updated_at=now() where workspace_id=wid;
 insert into private.platform_audit_logs(actor_user_id,action,tenant_id,summary,metadata) values(v_uid,'support_session_revoked_by_tenant',wid,'Support session revoked by Company admin',jsonb_build_object('session_id',p_session_id,'reason',v_reason));
 insert into public.audit_logs(workspace_id,actor_id,action,entity_type,entity_id,summary) values(wid,v_uid,'support_access_revoked','support_session',p_session_id,'دسترسی پشتیبانی آوان توسط مدیر شرکت لغو شد.');return true;
end $$;
revoke all on function private.company_revoke_support_session_impl(uuid,uuid,text) from public,anon;
grant execute on function private.company_revoke_support_session_impl(uuid,uuid,text) to authenticated;

create or replace function public.platform_admin_create_support_session(p_company_id uuid,p_duration_minutes integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.platform_admin_create_support_session_impl(p_company_id,p_duration_minutes,p_reason)$$;
create or replace function public.platform_admin_revoke_support_session(p_session_id uuid,p_reason text default 'Support session closed by Platform Admin') returns boolean language sql security invoker set search_path='' as $$select private.platform_admin_revoke_support_session_impl(p_session_id,p_reason)$$;
create or replace function public.platform_support_session_info(p_session_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.platform_support_session_info_impl(p_session_id)$$;
create or replace function public.platform_support_read(p_session_id uuid,p_resource text,p_limit integer default 50) returns jsonb language sql security invoker set search_path='' as $$select private.platform_support_read_impl(p_session_id,p_resource,p_limit)$$;
create or replace function public.company_support_sessions(wid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.company_support_sessions_impl(wid)$$;
create or replace function public.company_revoke_support_session(wid uuid,p_session_id uuid,p_reason text default 'Revoked by Company admin') returns boolean language sql security invoker set search_path='' as $$select private.company_revoke_support_session_impl(wid,p_session_id,p_reason)$$;
revoke all on function public.platform_admin_create_support_session(uuid,integer,text) from public,anon;
revoke all on function public.platform_admin_revoke_support_session(uuid,text) from public,anon;
revoke all on function public.platform_support_session_info(uuid) from public,anon;
revoke all on function public.platform_support_read(uuid,text,integer) from public,anon;
revoke all on function public.company_support_sessions(uuid) from public,anon;
revoke all on function public.company_revoke_support_session(uuid,uuid,text) from public,anon;
grant execute on function public.platform_admin_create_support_session(uuid,integer,text) to authenticated;
grant execute on function public.platform_admin_revoke_support_session(uuid,text) to authenticated;
grant execute on function public.platform_support_session_info(uuid) to authenticated;
grant execute on function public.platform_support_read(uuid,text,integer) to authenticated;
grant execute on function public.company_support_sessions(uuid) to authenticated;
grant execute on function public.company_revoke_support_session(uuid,uuid,text) to authenticated;

-- P3 also extends private.platform_admin_companies_impl() with `active_support_session`
-- metadata and private.platform_admin_overview_impl() with `active_support_sessions`.
-- Those definitions are applied in the Supabase migration `rc1_3_mt_p3_controlled_support_access`.

notify pgrst,'reload schema';
commit;
