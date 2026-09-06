-- Avan RC1.3-D — Invoice reversal link integrity fix
-- Final consolidated desired state after Full Regression discovered that legacy
-- trg_sync_invoice_status_from_journal changed invoice status to reversed before
-- reverse_journal_entry could store reversal_journal_entry_id.
--
-- Production migration history contains:
--   rc1_3_d_invoice_reversal_link_integrity (intermediate fail-closed diagnostic hardening)
--   rc1_3_d_invoice_reversal_trigger_and_backfill (final fix below)

create or replace function public.guard_invoice_mutation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op='DELETE' and old.status <> 'draft' then
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' and old.status='posted' then
    if new.status='reversed'
       and new.workspace_id=old.workspace_id
       and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no
       and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date
       and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id
       and new.description is not distinct from old.description
       and new.total_amount=old.total_amount
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.created_by is not distinct from old.created_by
       and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at
    then
      new.updated_at:=now();
      return new;
    end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  -- Controlled historical/defense-in-depth repair: a reversed invoice may only
  -- receive its missing reversal link when the target is a real posted reversal
  -- of the invoice posting journal. Authenticated Browser has no direct UPDATE
  -- privilege on invoices, so this remains an internal integrity path.
  if tg_op='UPDATE' and old.status='reversed' then
    if new.status='reversed'
       and old.reversal_journal_entry_id is null
       and new.reversal_journal_entry_id is not null
       and new.workspace_id=old.workspace_id
       and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no
       and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date
       and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id
       and new.description is not distinct from old.description
       and new.total_amount=old.total_amount
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.created_by is not distinct from old.created_by
       and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at
       and new.reversed_at is not distinct from old.reversed_at
       and exists(
         select 1
         from public.journal_entries r
         where r.id=new.reversal_journal_entry_id
           and r.workspace_id=old.workspace_id
           and r.reversal_of=old.journal_entry_id
           and r.status='posted'
       )
    then
      new.updated_at:=now();
      return new;
    end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' then new.updated_at:=now(); end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function public.sync_invoice_status_from_journal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_reversal_id uuid;
  v_invoice_link uuid;
begin
  if old.status is distinct from new.status
     and new.status='reversed'
     and new.source_id is not null
     and new.source_type in ('sales_invoice','purchase_invoice')
  then
    select r.id into v_reversal_id
    from public.journal_entries r
    where r.workspace_id=new.workspace_id
      and r.reversal_of=new.id
      and r.status='posted'
    order by r.created_at desc
    limit 1;

    if v_reversal_id is null then
      raise exception 'INVOICE_REVERSAL_JOURNAL_MISSING';
    end if;

    update public.invoices i
       set status='reversed',
           reversal_journal_entry_id=v_reversal_id,
           reversed_at=coalesce(i.reversed_at,now()),
           updated_at=now()
     where i.id=new.source_id
       and i.workspace_id=new.workspace_id
       and i.journal_entry_id=new.id
       and i.status='posted'
     returning i.reversal_journal_entry_id into v_invoice_link;

    if not found then
      select i.reversal_journal_entry_id into v_invoice_link
      from public.invoices i
      where i.id=new.source_id
        and i.workspace_id=new.workspace_id
        and i.journal_entry_id=new.id
        and i.status='reversed';

      if not found then
        raise exception 'INVOICE_SOURCE_LINK_MISSING';
      end if;
    end if;

    if v_invoice_link is distinct from v_reversal_id then
      raise exception 'INVOICE_REVERSAL_LINK_FAILED';
    end if;
  end if;

  return new;
end;
$$;

-- Historical backfill is allowed only when each missing link has exactly one
-- posted reversal journal candidate.
do $$
begin
  if exists(
    select i.id
    from public.invoices i
    left join public.journal_entries r
      on r.reversal_of=i.journal_entry_id
     and r.workspace_id=i.workspace_id
     and r.status='posted'
    where i.status='reversed'
      and i.reversal_journal_entry_id is null
    group by i.id
    having count(r.id) <> 1
  ) then
    raise exception 'INVOICE_REVERSAL_BACKFILL_AMBIGUOUS';
  end if;
end;
$$;

update public.invoices i
   set reversal_journal_entry_id=r.id,
       updated_at=now()
  from public.journal_entries r
 where i.status='reversed'
   and i.reversal_journal_entry_id is null
   and r.workspace_id=i.workspace_id
   and r.reversal_of=i.journal_entry_id
   and r.status='posted';

create or replace function private.reverse_journal_entry(
  jid uuid,
  reverse_date date,
  reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $$
declare
  src public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_invoice_link uuid;
  ln record;
begin
  select * into src
  from public.journal_entries
  where id=jid
  for update;

  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if not public.has_workspace_access(src.workspace_id) then raise exception 'FORBIDDEN'; end if;
  if src.status <> 'posted' then raise exception 'ENTRY_NOT_POSTED'; end if;
  if exists(select 1 from public.journal_entries where reversal_of=src.id) then
    raise exception 'ENTRY_ALREADY_REVERSED';
  end if;

  insert into public.journal_entries(
    workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,reversal_of,created_by
  ) values(
    src.workspace_id,
    src.fiscal_year_id,
    reverse_date,
    coalesce(reason,'برگشت سند')||' — '||src.description,
    'reversal',
    src.id,
    'draft',
    src.id,
    auth.uid()
  ) returning id into v_reversal_id;

  for ln in
    select * from public.journal_lines where journal_entry_id=src.id order by line_no
  loop
    insert into public.journal_lines(
      workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit
    ) values(
      src.workspace_id,
      v_reversal_id,
      ln.line_no,
      ln.account_id,
      ln.party_id,
      ln.description,
      ln.credit,
      ln.debit
    );
  end loop;

  perform public.post_journal_entry(v_reversal_id);

  update public.journal_entries
     set status='reversed',
         reversed_by=auth.uid(),
         reversed_at=now(),
         updated_at=now()
   where id=src.id;

  if src.source_id is not null
     and src.source_type in ('receipt','payment','transfer','opening_balance') then
    update public.financial_transactions
       set status='cancelled',updated_at=now()
     where id=src.source_id
       and workspace_id=src.workspace_id
       and journal_entry_id=src.id;

  elsif src.source_id is not null
        and src.source_type in ('sales_invoice','purchase_invoice') then
    select i.reversal_journal_entry_id into v_invoice_link
    from public.invoices i
    where i.id=src.source_id
      and i.workspace_id=src.workspace_id
      and i.journal_entry_id=src.id
      and i.status='reversed';

    if not found then
      raise exception 'INVOICE_SOURCE_LINK_MISSING';
    end if;
    if v_invoice_link is distinct from v_reversal_id then
      raise exception 'INVOICE_REVERSAL_LINK_FAILED';
    end if;
  end if;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(src.workspace_id,'reverse','journal_entry',src.id,'Journal reversed');

  return v_reversal_id;
end;
$$;

-- Acceptance invariant.
do $$
begin
  if exists(
    select 1
    from public.invoices i
    where i.status='reversed'
      and (
        i.reversal_journal_entry_id is null
        or not exists(
          select 1
          from public.journal_entries r
          where r.id=i.reversal_journal_entry_id
            and r.workspace_id=i.workspace_id
            and r.reversal_of=i.journal_entry_id
            and r.status='posted'
        )
      )
  ) then
    raise exception 'INVOICE_REVERSAL_INTEGRITY_FAILED';
  end if;
end;
$$;
