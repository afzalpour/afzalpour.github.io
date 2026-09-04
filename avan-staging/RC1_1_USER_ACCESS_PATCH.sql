-- Avan Core 1.0 — RC1.1-D Workspace user access management
-- Safe migration for the current Core 1.0 database.
-- Browser never receives a service_role key; all membership mutation is RPC-only.

begin;

-- ---------------------------------------------------------
-- 1) Soft access state on memberships
-- ---------------------------------------------------------
alter table public.workspace_members
  add column if not exists is_active boolean not null default true;

alter table public.workspace_members
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_workspace_members_active_user
  on public.workspace_members(user_id, workspace_id)
  where is_active;

-- Active membership becomes the single access predicate used by Core/RLS.
create or replace function public.has_workspace_access(wid uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.workspace_members m
    where m.workspace_id=wid
      and m.user_id=(select auth.uid())
      and m.is_active
  );
$$;

create or replace function public.workspace_role(wid uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id=wid
    and m.user_id=(select auth.uid())
    and m.is_active
  limit 1;
$$;

revoke all on function public.has_workspace_access(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
grant execute on function public.has_workspace_access(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

-- Membership writes are RPC-only from this Gate onward.
revoke insert, update, delete on public.workspace_members from authenticated;
drop policy if exists members_manage on public.workspace_members;

-- ---------------------------------------------------------
-- 2) Pending invitations (no direct browser table access)
-- ---------------------------------------------------------
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','manager','accountant')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz
);

create unique index if not exists uq_workspace_pending_invitation_email
  on public.workspace_invitations(workspace_id, lower(email))
  where status='pending';

alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon, authenticated;

-- ---------------------------------------------------------
-- 3) Read model for Owner/Admin UI
-- ---------------------------------------------------------
create or replace function public.list_workspace_access(wid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_role text;
  v_members jsonb;
  v_invites jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_role := public.workspace_role(wid);
  if v_role not in ('owner','manager','financial_manager') then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'email', coalesce(u.email,''),
        'role', m.role,
        'is_active', m.is_active,
        'is_current', m.user_id=auth.uid(),
        'created_at', m.created_at,
        'updated_at', m.updated_at
      )
      order by
        case m.role when 'owner' then 1 when 'manager' then 2 when 'financial_manager' then 2 else 3 end,
        lower(coalesce(u.email,''))
    ),
    '[]'::jsonb
  )
  into v_members
  from public.workspace_members m
  left join auth.users u on u.id=m.user_id
  where m.workspace_id=wid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'role', i.role,
        'status', i.status,
        'created_at', i.created_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_invites
  from public.workspace_invitations i
  where i.workspace_id=wid
    and i.status='pending';

  return jsonb_build_object(
    'actor_role', v_role,
    'members', v_members,
    'invitations', v_invites
  );
end $$;

revoke all on function public.list_workspace_access(uuid) from public;
grant execute on function public.list_workspace_access(uuid) to authenticated;

-- ---------------------------------------------------------
-- 4) Invite/add existing user by exact email
-- ---------------------------------------------------------
create or replace function public.invite_workspace_member(
  wid uuid,
  p_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_actor_role text;
  v_email text;
  v_user_id uuid;
  v_confirmed_at timestamptz;
  v_existing public.workspace_members%rowtype;
  v_invite_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_actor_role := public.workspace_role(wid);
  if v_actor_role not in ('owner','manager','financial_manager') then
    raise exception 'FORBIDDEN';
  end if;

  v_email := lower(trim(coalesce(p_email,'')));
  if v_email='' or position('@' in v_email)<=1 then
    raise exception 'EMAIL_INVALID';
  end if;

  if p_role not in ('owner','manager','accountant') then
    raise exception 'ROLE_INVALID';
  end if;

  -- Admin/manager may manage accountants only. Owner may manage all three roles.
  if v_actor_role in ('manager','financial_manager') and p_role<>'accountant' then
    raise exception 'FORBIDDEN';
  end if;

  select u.id, u.email_confirmed_at
    into v_user_id, v_confirmed_at
  from auth.users u
  where lower(u.email)=v_email
  limit 1;

  if v_user_id=auth.uid() then
    raise exception 'SELF_ACCESS_CHANGE_FORBIDDEN';
  end if;

  if v_user_id is not null then
    select * into v_existing
    from public.workspace_members m
    where m.workspace_id=wid and m.user_id=v_user_id
    for update;

    if found then
      if v_actor_role in ('manager','financial_manager')
         and v_existing.role<>'accountant' then
        raise exception 'FORBIDDEN';
      end if;

      if v_existing.is_active then
        return jsonb_build_object(
          'status','already_member',
          'user_id',v_user_id,
          'role',v_existing.role
        );
      end if;

      update public.workspace_members
         set role=p_role,
             is_active=true,
             updated_at=now()
       where workspace_id=wid and user_id=v_user_id;

      insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
      values(wid,'workspace_member_reactivated','workspace_member',v_user_id,
             'Workspace member reactivated as '||p_role);

      return jsonb_build_object(
        'status','member_reactivated',
        'user_id',v_user_id,
        'role',p_role
      );
    end if;

    -- Existing confirmed account can be added immediately.
    if v_confirmed_at is not null then
      insert into public.workspace_members(workspace_id,user_id,role,is_active)
      values(wid,v_user_id,p_role,true);

      insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
      values(wid,'workspace_member_added','workspace_member',v_user_id,
             'Workspace member added as '||p_role);

      return jsonb_build_object(
        'status','member_added',
        'user_id',v_user_id,
        'role',p_role
      );
    end if;
  end if;

  -- No confirmed account yet: persist a pending invitation. No email is sent here.
  update public.workspace_invitations
     set role=p_role,
         invited_by=auth.uid(),
         updated_at=now()
   where workspace_id=wid
     and lower(email)=v_email
     and status='pending'
  returning id into v_invite_id;

  if v_invite_id is null then
    insert into public.workspace_invitations(
      workspace_id,email,role,status,invited_by
    ) values(
      wid,v_email,p_role,'pending',auth.uid()
    ) returning id into v_invite_id;
  end if;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(wid,'workspace_invitation_created','workspace_invitation',v_invite_id,
         'Pending workspace invitation for '||v_email||' as '||p_role);

  return jsonb_build_object(
    'status','invitation_pending',
    'invitation_id',v_invite_id,
    'email',v_email,
    'role',p_role
  );
end $$;

revoke all on function public.invite_workspace_member(uuid,text,text) from public;
grant execute on function public.invite_workspace_member(uuid,text,text) to authenticated;

-- ---------------------------------------------------------
-- 5) Controlled role + active/inactive change
-- ---------------------------------------------------------
create or replace function public.manage_workspace_member(
  wid uuid,
  p_user_id uuid,
  p_role text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor_role text;
  v_target public.workspace_members%rowtype;
  v_owner_count integer;
  v_primary_owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_actor_role := public.workspace_role(wid);
  if v_actor_role not in ('owner','manager','financial_manager') then
    raise exception 'FORBIDDEN';
  end if;

  if p_role not in ('owner','manager','accountant') then
    raise exception 'ROLE_INVALID';
  end if;

  select * into v_target
  from public.workspace_members m
  where m.workspace_id=wid and m.user_id=p_user_id
  for update;

  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  -- Never let an operator accidentally lock themselves out from this UI.
  if p_user_id=auth.uid()
     and (p_role is distinct from v_target.role or p_active is distinct from v_target.is_active) then
    raise exception 'SELF_ACCESS_CHANGE_FORBIDDEN';
  end if;

  -- Admin/manager manages accountants only; Owner manages all roles.
  if v_actor_role in ('manager','financial_manager') then
    if v_target.role<>'accountant' or p_role<>'accountant' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  -- The original workspaces.owner_user_id remains protected until a dedicated
  -- ownership-transfer workflow is implemented. This also avoids stale owner
  -- visibility under older workspace SELECT policies.
  select w.owner_user_id into v_primary_owner
  from public.workspaces w
  where w.id=wid;

  if p_user_id=v_primary_owner
     and (p_role<>'owner' or not p_active) then
    raise exception 'PRIMARY_OWNER_PROTECTED';
  end if;

  -- The workspace must always retain at least one active Owner.
  if v_target.role='owner'
     and v_target.is_active
     and (p_role<>'owner' or not p_active) then
    select count(*) into v_owner_count
    from public.workspace_members m
    where m.workspace_id=wid
      and m.role='owner'
      and m.is_active;

    if v_owner_count<=1 then
      raise exception 'LAST_OWNER_PROTECTED';
    end if;
  end if;

  update public.workspace_members
     set role=p_role,
         is_active=p_active,
         updated_at=now()
   where workspace_id=wid and user_id=p_user_id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(wid,'workspace_member_changed','workspace_member',p_user_id,
         'Workspace member changed to role='||p_role||', active='||p_active::text);

  return jsonb_build_object(
    'status','member_updated',
    'user_id',p_user_id,
    'role',p_role,
    'is_active',p_active
  );
end $$;

revoke all on function public.manage_workspace_member(uuid,uuid,text,boolean) from public;
grant execute on function public.manage_workspace_member(uuid,uuid,text,boolean) to authenticated;

-- ---------------------------------------------------------
-- 6) Cancel pending invitation
-- ---------------------------------------------------------
create or replace function public.cancel_workspace_invitation(
  wid uuid,
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor_role text;
  v_inv public.workspace_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_actor_role := public.workspace_role(wid);
  if v_actor_role not in ('owner','manager','financial_manager') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_inv
  from public.workspace_invitations i
  where i.id=p_invitation_id
    and i.workspace_id=wid
    and i.status='pending'
  for update;

  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;

  if v_actor_role in ('manager','financial_manager') and v_inv.role<>'accountant' then
    raise exception 'FORBIDDEN';
  end if;

  update public.workspace_invitations
     set status='cancelled',
         cancelled_at=now(),
         updated_at=now()
   where id=p_invitation_id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(wid,'workspace_invitation_cancelled','workspace_invitation',p_invitation_id,
         'Workspace invitation cancelled');

  return true;
end $$;

revoke all on function public.cancel_workspace_invitation(uuid,uuid) from public;
grant execute on function public.cancel_workspace_invitation(uuid,uuid) to authenticated;

-- ---------------------------------------------------------
-- 7) Claim confirmed invitations at login
-- ---------------------------------------------------------
create or replace function public.claim_workspace_invitations()
returns integer
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text;
  v_confirmed_at timestamptz;
  v_inv record;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed_at
  from auth.users u
  where u.id=auth.uid();

  if v_email is null or v_confirmed_at is null then
    return 0;
  end if;

  for v_inv in
    select *
    from public.workspace_invitations i
    where lower(i.email)=v_email
      and i.status='pending'
    order by i.created_at
    for update
  loop
    insert into public.workspace_members(
      workspace_id,user_id,role,is_active
    ) values(
      v_inv.workspace_id,auth.uid(),v_inv.role,true
    )
    on conflict(workspace_id,user_id)
    do update set
      role=excluded.role,
      is_active=true,
      updated_at=now();

    update public.workspace_invitations
       set status='accepted',
           accepted_by=auth.uid(),
           accepted_at=now(),
           updated_at=now()
     where id=v_inv.id;

    insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
    values(v_inv.workspace_id,'workspace_invitation_accepted','workspace_member',auth.uid(),
           'Workspace invitation accepted');

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.claim_workspace_invitations() from public;
grant execute on function public.claim_workspace_invitations() to authenticated;

commit;

-- Read-only verification examples after migration:
-- select column_name,data_type from information_schema.columns
-- where table_schema='public' and table_name='workspace_members'
--   and column_name in ('is_active','updated_at');
-- select proname from pg_proc where proname in (
--   'list_workspace_access','invite_workspace_member','manage_workspace_member',
--   'cancel_workspace_invitation','claim_workspace_invitations'
-- );
