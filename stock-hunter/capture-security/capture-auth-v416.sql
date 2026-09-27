-- Stock Hunter 4.1.6 capture authentication — HMAC + nonce replay resistance.
-- Canonical source matching live migrations applied 2026-09-19.
-- Contains no secret values.

create table if not exists private.stock_hunter_capture_request_nonces_v416 (
  nonce uuid primary key,
  request_epoch bigint not null,
  consumed_at timestamptz not null default now()
);

create index if not exists stock_hunter_capture_request_nonces_v416_consumed_idx
  on private.stock_hunter_capture_request_nonces_v416(consumed_at);

revoke all on private.stock_hunter_capture_request_nonces_v416 from public, anon, authenticated, service_role;

create or replace function public.stock_hunter_validate_capture_request_v416(
  p_timestamp bigint,
  p_nonce text,
  p_signature text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now bigint;
  v_secret text;
  v_expected text;
  v_nonce uuid;
begin
  v_now := extract(epoch from pg_catalog.clock_timestamp())::bigint;

  if p_timestamp is null or pg_catalog.abs(v_now-p_timestamp)>180 then
    return false;
  end if;

  if p_nonce is null
     or p_nonce !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select v.decrypted_secret into v_secret
  from vault.decrypted_secrets v
  where v.name='stock_hunter_capture_token_v416'
  order by v.created_at desc
  limit 1;

  if pg_catalog.length(coalesce(v_secret,''))<32 then
    return false;
  end if;

  v_expected := pg_catalog.encode(
    extensions.hmac(
      'stock-hunter-capture-v416:v2:'||p_timestamp::text||':'||pg_catalog.lower(p_nonce),
      v_secret,
      'sha256'
    ),
    'hex'
  );

  if v_expected is distinct from p_signature then
    return false;
  end if;

  delete from private.stock_hunter_capture_request_nonces_v416
  where consumed_at < pg_catalog.now()-interval '10 minutes';

  insert into private.stock_hunter_capture_request_nonces_v416(nonce,request_epoch)
  values(p_nonce::uuid,p_timestamp)
  on conflict(nonce) do nothing
  returning nonce into v_nonce;

  return v_nonce is not null;
end;
$function$;

revoke all on function public.stock_hunter_validate_capture_request_v416(bigint,text,text)
  from public,anon,authenticated;
grant execute on function public.stock_hunter_validate_capture_request_v416(bigint,text,text)
  to service_role;

create or replace function private.invoke_stock_hunter_capture_v416()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ts bigint;
  v_nonce text;
  v_secret text;
  v_project_url text;
  v_signature text;
  v_request_id bigint;
begin
  v_ts := extract(epoch from pg_catalog.clock_timestamp())::bigint;
  v_nonce := pg_catalog.gen_random_uuid()::text;

  select v.decrypted_secret into v_secret
  from vault.decrypted_secrets v
  where v.name='stock_hunter_capture_token_v416'
  order by v.created_at desc limit 1;

  select v.decrypted_secret into v_project_url
  from vault.decrypted_secrets v
  where v.name='stock_hunter_project_url_v416'
  order by v.created_at desc limit 1;

  if pg_catalog.length(coalesce(v_secret,''))<32 then
    raise exception 'capture signer secret unavailable';
  end if;
  if nullif(pg_catalog.btrim(v_project_url),'') is null then
    raise exception 'capture project url unavailable';
  end if;

  v_signature := pg_catalog.encode(
    extensions.hmac(
      'stock-hunter-capture-v416:v2:'||v_ts::text||':'||v_nonce,
      v_secret,
      'sha256'
    ),
    'hex'
  );

  select net.http_post(
    url:=pg_catalog.rtrim(v_project_url,'/')||'/functions/v1/stock-hunter-capture-v416',
    headers:=pg_catalog.jsonb_build_object(
      'Content-Type','application/json',
      'X-Stock-Hunter-Capture-Auth','hmac-sha256-v2',
      'X-Stock-Hunter-Capture-Timestamp',v_ts::text,
      'X-Stock-Hunter-Capture-Nonce',v_nonce,
      'X-Stock-Hunter-Capture-Signature',v_signature
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=15000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function private.invoke_stock_hunter_capture_v416()
  from public,anon,authenticated,service_role;

-- Preserve the legacy validator for controlled rollback only.
revoke all on function public.stock_hunter_validate_capture_token_v416(text)
  from public,anon,authenticated;
grant execute on function public.stock_hunter_validate_capture_token_v416(text)
  to service_role;

revoke all on function public.claim_stock_hunter_capture_v416()
  from public,anon,authenticated;
grant execute on function public.claim_stock_hunter_capture_v416()
  to service_role;

revoke all on function public.finish_stock_hunter_capture_v416(integer,text)
  from public,anon,authenticated;
grant execute on function public.finish_stock_hunter_capture_v416(integer,text)
  to service_role;

alter table public.stock_hunter_capture_state_v416 enable row level security;
revoke all on table public.stock_hunter_capture_state_v416 from public,anon,authenticated;

do $cron$
declare r record; v_count integer:=0;
begin
  for r in
    select jobid from cron.job
    where jobname in (
      'stock-hunter-capture-v416-open',
      'stock-hunter-capture-v416-mid',
      'stock-hunter-capture-v416-close'
    )
  loop
    perform cron.alter_job(job_id:=r.jobid,command:='select private.invoke_stock_hunter_capture_v416();');
    v_count:=v_count+1;
  end loop;
  if v_count<>3 then
    raise exception 'capture HMAC contract failed: expected three capture cron jobs, found %',v_count;
  end if;
end;
$cron$;

do $verify$
begin
  if not exists(select 1 from vault.secrets where name='stock_hunter_capture_token_v416') then
    raise exception 'capture HMAC contract failed: Vault secret metadata missing';
  end if;

  if has_function_privilege('anon','public.stock_hunter_validate_capture_request_v416(bigint,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.stock_hunter_validate_capture_request_v416(bigint,text,text)','EXECUTE') then
    raise exception 'capture HMAC contract failed: public roles can validate signed requests';
  end if;

  if not has_function_privilege('service_role','public.stock_hunter_validate_capture_request_v416(bigint,text,text)','EXECUTE') then
    raise exception 'capture HMAC contract failed: service_role cannot validate signed requests';
  end if;

  if has_function_privilege('service_role','private.invoke_stock_hunter_capture_v416()','EXECUTE')
     or has_function_privilege('anon','private.invoke_stock_hunter_capture_v416()','EXECUTE')
     or has_function_privilege('authenticated','private.invoke_stock_hunter_capture_v416()','EXECUTE') then
    raise exception 'capture HMAC contract failed: private signer has unexpected execute grant';
  end if;

  if has_table_privilege('anon','private.stock_hunter_capture_request_nonces_v416','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','private.stock_hunter_capture_request_nonces_v416','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','private.stock_hunter_capture_request_nonces_v416','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'capture HMAC contract failed: nonce ledger directly accessible';
  end if;
end;
$verify$;
