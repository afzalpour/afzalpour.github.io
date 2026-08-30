-- Avan Core Gate B-4.1 — True Draft lifecycle fix
-- Drafts may be incomplete/unbalanced. Balance and minimum-two-lines are enforced only when Posting.

create or replace function public.save_draft_journal(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_journal_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  jid uuid;
  item jsonb;
  idx integer := 0;
  st text;
  aid uuid;
  pid uuid;
  d numeric(20,0);
  c numeric(20,0);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(p_workspace_id) then raise exception 'FORBIDDEN'; end if;
  if p_entry_date is null then raise exception 'ENTRY_DATE_REQUIRED'; end if;
  if p_lines is null then p_lines := '[]'::jsonb; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'LINES_MUST_BE_ARRAY'; end if;

  if p_journal_id is null then
    insert into public.journal_entries(
      workspace_id,fiscal_year_id,entry_date,description,source_type,status,created_by
    ) values(
      p_workspace_id,p_fiscal_year_id,p_entry_date,
      coalesce(nullif(trim(p_description),''),'سند دستی'),
      'manual','draft',auth.uid()
    ) returning id into jid;
  else
    select status into st
    from public.journal_entries
    where id=p_journal_id and workspace_id=p_workspace_id
    for update;
    if st is null then raise exception 'ENTRY_NOT_FOUND'; end if;
    if st <> 'draft' then raise exception 'POSTED_ENTRY_IMMUTABLE'; end if;
    jid := p_journal_id;
    delete from public.journal_lines where journal_entry_id=jid;
    update public.journal_entries
       set fiscal_year_id=p_fiscal_year_id,
           entry_date=p_entry_date,
           description=coalesce(nullif(trim(p_description),''),'سند دستی'),
           updated_at=now()
     where id=jid;
  end if;

  for item in select value from jsonb_array_elements(p_lines) loop
    aid := nullif(item->>'account_id','')::uuid;
    pid := nullif(item->>'party_id','')::uuid;
    d := coalesce(nullif(item->>'debit','')::numeric,0);
    c := coalesce(nullif(item->>'credit','')::numeric,0);
    if aid is null then raise exception 'ACCOUNT_REQUIRED'; end if;
    if d < 0 or c < 0 or (d > 0 and c > 0) or (d = 0 and c = 0) then
      raise exception 'INVALID_DRAFT_LINE';
    end if;
    perform public.assert_account_postable(aid,p_workspace_id);
    if pid is not null and not exists(
      select 1 from public.parties p where p.id=pid and p.workspace_id=p_workspace_id and p.is_active
    ) then raise exception 'PARTY_NOT_FOUND'; end if;
    idx := idx + 1;
    insert into public.journal_lines(
      workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit
    ) values(
      p_workspace_id,jid,idx,aid,pid,nullif(item->>'description',''),d,c
    );
  end loop;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(p_workspace_id,'save_draft','journal_entry',jid,
         case when idx=0 then 'Draft journal saved without lines'
              else 'Draft journal saved with '||idx||' line(s)' end);
  return jid;
end $$;

revoke all on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) from public;
grant execute on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) to authenticated;
