-- RC1.3-MT-P1 registry visibility patch
-- Keep tenant registry anomalies visible to Platform Admin instead of dropping them via INNER JOIN.

begin;

create or replace function private.platform_admin_companies_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'company_id',w.id,
        'name',w.name,
        'display_name',coalesce(p.display_name,w.name),
        'legal_name',p.legal_name,
        'status',pt.status,
        'registry_state',case
          when w.owner_user_id is null then 'missing_owner'
          when u.id is null then 'missing_owner_user'
          else 'ok'
        end,
        'owner_email',u.email,
        'active_members',(
          select count(*) from public.workspace_members m
          where m.workspace_id=w.id and m.is_active
        ),
        'created_at',w.created_at,
        'updated_at',pt.updated_at
      )
      order by w.created_at desc nulls last
    )
    from private.platform_tenants pt
    join public.workspaces w on w.id=pt.workspace_id
    left join auth.users u on u.id=w.owner_user_id
    left join public.workspace_print_profiles p on p.workspace_id=w.id
  ),'[]'::jsonb);
end;
$$;

notify pgrst, 'reload schema';
commit;
