-- AVAN RC1.6-B — atomic bank statement import boundary
-- Additive migration after RC1.6-A. Applied history must not be rewritten.
-- SECURITY INVOKER + RLS. No journal or financial transaction is created here.

create or replace function public.avan_import_bank_statement(
  wid uuid,
  p_financial_account_id uuid,
  p_file_name text,
  p_file_sha256 text,
  p_statement_from date default null,
  p_statement_to date default null,
  p_opening_balance numeric default null,
  p_closing_balance numeric default null,
  p_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_row_count integer;
  v_row jsonb;
  v_line_no integer;
  v_booking_date date;
  v_value_date date;
  v_direction text;
  v_amount numeric;
  v_description text;
  v_reference_no text;
  v_counterparty text;
  v_balance_after numeric;
  v_fingerprint text;
begin
  if not public.has_workspace_access(wid) then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;
  if public.workspace_role(wid) not in ('owner','manager','accountant') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  if not exists (
    select 1
    from public.financial_accounts fa
    where fa.workspace_id = wid
      and fa.id = p_financial_account_id
      and fa.kind = 'bank'
      and fa.is_active
  ) then
    raise exception 'BANK_ACCOUNT_REQUIRED';
  end if;
  if nullif(btrim(p_file_name), '') is null then
    raise exception 'BANK_STATEMENT_FILE_NAME_REQUIRED';
  end if;
  if p_file_sha256 is null or p_file_sha256 !~ '^[0-9A-Fa-f]{64}$' then
    raise exception 'BANK_STATEMENT_FILE_HASH_INVALID';
  end if;
  if p_statement_from is not null and p_statement_to is not null and p_statement_from > p_statement_to then
    raise exception 'BANK_STATEMENT_DATE_RANGE_INVALID';
  end if;
  if p_opening_balance is not null and p_opening_balance * 10 <> trunc(p_opening_balance * 10) then
    raise exception 'SUB_RIAL_VALUE';
  end if;
  if p_closing_balance is not null and p_closing_balance * 10 <> trunc(p_closing_balance * 10) then
    raise exception 'SUB_RIAL_VALUE';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'BANK_STATEMENT_ROWS_INVALID';
  end if;

  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 then
    raise exception 'BANK_STATEMENT_ROWS_REQUIRED';
  end if;
  if v_row_count > 5000 then
    raise exception 'BANK_STATEMENT_ROW_LIMIT_EXCEEDED';
  end if;

  insert into public.bank_statement_imports (
    workspace_id,
    financial_account_id,
    source_format,
    file_name,
    file_sha256,
    statement_from,
    statement_to,
    opening_balance,
    closing_balance,
    row_count,
    status
  ) values (
    wid,
    p_financial_account_id,
    'csv',
    btrim(p_file_name),
    lower(p_file_sha256),
    p_statement_from,
    p_statement_to,
    p_opening_balance,
    p_closing_balance,
    0,
    'draft'
  ) returning id into v_import_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'BANK_STATEMENT_ROW_INVALID';
    end if;

    begin
      v_line_no := (v_row->>'line_no')::integer;
      v_booking_date := (v_row->>'booking_date')::date;
      v_value_date := nullif(v_row->>'value_date', '')::date;
      v_direction := nullif(btrim(v_row->>'direction'), '');
      v_amount := (v_row->>'amount')::numeric;
      v_description := coalesce(v_row->>'description', '');
      v_reference_no := nullif(btrim(v_row->>'reference_no'), '');
      v_counterparty := nullif(btrim(v_row->>'counterparty'), '');
      v_balance_after := nullif(v_row->>'balance_after', '')::numeric;
      v_fingerprint := nullif(btrim(v_row->>'fingerprint'), '');
    exception when others then
      raise exception 'BANK_STATEMENT_ROW_INVALID';
    end;

    if v_line_no is null or v_line_no < 1 then raise exception 'BANK_STATEMENT_LINE_NO_INVALID'; end if;
    if v_booking_date is null then raise exception 'BANK_STATEMENT_DATE_INVALID'; end if;
    if v_direction not in ('credit','debit') then raise exception 'BANK_STATEMENT_DIRECTION_INVALID'; end if;
    if v_amount is null or v_amount <= 0 then raise exception 'BANK_STATEMENT_AMOUNT_INVALID'; end if;
    if v_amount * 10 <> trunc(v_amount * 10) then raise exception 'SUB_RIAL_VALUE'; end if;
    if v_balance_after is not null and v_balance_after * 10 <> trunc(v_balance_after * 10) then raise exception 'SUB_RIAL_VALUE'; end if;
    if v_fingerprint is null or length(v_fingerprint) > 256 then raise exception 'BANK_STATEMENT_FINGERPRINT_INVALID'; end if;

    insert into public.bank_statement_lines (
      workspace_id,
      import_id,
      financial_account_id,
      line_no,
      booking_date,
      value_date,
      direction,
      amount,
      description,
      reference_no,
      counterparty,
      balance_after,
      fingerprint
    ) values (
      wid,
      v_import_id,
      p_financial_account_id,
      v_line_no,
      v_booking_date,
      v_value_date,
      v_direction,
      v_amount,
      v_description,
      v_reference_no,
      v_counterparty,
      v_balance_after,
      v_fingerprint
    );
  end loop;

  update public.bank_statement_imports
  set status = 'ready'
  where workspace_id = wid and id = v_import_id;

  return v_import_id;
end;
$$;

revoke all on function public.avan_import_bank_statement(uuid,uuid,text,text,date,date,numeric,numeric,jsonb) from public, anon;
grant execute on function public.avan_import_bank_statement(uuid,uuid,text,text,date,date,numeric,numeric,jsonb) to authenticated;
