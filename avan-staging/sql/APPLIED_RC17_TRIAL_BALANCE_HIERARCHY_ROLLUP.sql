-- APPLIED to Avan-production / dkyqsxnllvxypigxpygo
-- RC1.7 accounting correctness: hierarchical trial-balance rollup.
-- Parent accounts aggregate all descendants; leaf/postable balances remain exact.
-- SECURITY INVOKER; authenticated workspace access remains mandatory.

create or replace function public.report_trial_balance_hierarchy(wid uuid, dfrom date, dto date)
returns table(
  account_id uuid,
  account_code text,
  account_name text,
  parent_id uuid,
  account_level integer,
  is_postable boolean,
  debit_turnover numeric,
  credit_turnover numeric,
  net numeric
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with recursive
  scoped_accounts as (
    select a.id, a.code, a.name, a.parent_id, a.level, a.is_postable
    from public.accounts a
    where a.workspace_id = wid
      and public.has_workspace_access(wid)
  ),
  tree as (
    select
      a.id, a.code, a.name, a.parent_id, a.level, a.is_postable,
      array[coalesce(a.code, '')]::text[] as sort_path
    from scoped_accounts a
    where a.parent_id is null

    union all

    select
      c.id, c.code, c.name, c.parent_id, c.level, c.is_postable,
      t.sort_path || coalesce(c.code, '')
    from scoped_accounts c
    join tree t on t.id = c.parent_id
  ),
  descendants as (
    select a.id as ancestor_id, a.id as descendant_id
    from scoped_accounts a

    union all

    select d.ancestor_id, c.id
    from descendants d
    join scoped_accounts c on c.parent_id = d.descendant_id
  ),
  direct as (
    select
      l.account_id,
      coalesce(sum(l.debit), 0) as debit_turnover,
      coalesce(sum(l.credit), 0) as credit_turnover,
      coalesce(sum(l.debit - l.credit), 0) as net
    from public.v_posted_ledger l
    where l.workspace_id = wid
      and l.entry_date between dfrom and dto
    group by l.account_id
  )
  select
    t.id as account_id,
    t.code as account_code,
    t.name as account_name,
    t.parent_id,
    t.level as account_level,
    t.is_postable,
    coalesce(sum(x.debit_turnover), 0) as debit_turnover,
    coalesce(sum(x.credit_turnover), 0) as credit_turnover,
    coalesce(sum(x.net), 0) as net
  from tree t
  join descendants d on d.ancestor_id = t.id
  left join direct x on x.account_id = d.descendant_id
  group by t.id, t.code, t.name, t.parent_id, t.level, t.is_postable, t.sort_path
  order by t.sort_path;
$function$;

revoke all on function public.report_trial_balance_hierarchy(uuid,date,date) from public;
revoke all on function public.report_trial_balance_hierarchy(uuid,date,date) from anon;
grant execute on function public.report_trial_balance_hierarchy(uuid,date,date) to authenticated;
grant execute on function public.report_trial_balance_hierarchy(uuid,date,date) to service_role;
