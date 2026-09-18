# Stock Hunter First-Capture Incident Readiness

AUDIT_DATE: 2026-09-18
STATUS: LIVE_DIAGNOSTIC_PASS / FIRST_REAL_CAPTURE_PENDING
TARGET_PROJECT: summnepwuziwulzvpcms
PROSPECTIVE_START_UTC: 2026-09-19T05:30:00Z
PROSPECTIVE_START_TEHRAN: 2026-09-19 09:00

## Purpose

This is a read-only incident classifier for the first real prospective capture window.

It does not:

- call either capture Edge Function;
- retry pg_cron;
- restart pg_net;
- change Vault;
- edit capture state;
- backfill Shadow/Hunt rows;
- alter timestamps;
- unlock OOS;
- advance Promotion/Activation/Release.

## Live pre-window result

Current diagnostic result:

- verifier = stock-hunter-first-capture-incident-readiness-v416
- severity = PASS
- diagnostic_state = WAITING_FOR_FIRST_MARKET_WINDOW
- collection_state = ARMED_AWAITING_FIRST_MARKET_WINDOW
- pg_cron scheduler = alive
- pg_net worker = alive
- capture cron runs after prospective start = 0
- capture success after prospective start = 0
- capture last error = null
- prospective Shadow rows = 0
- prospective Hunt events = 0

This is expected before 2026-09-19 05:30 UTC.

## Platform diagnostics

Live extensions/workers:

- pg_cron = 1.6.4
- pg_net = 0.20.4
- pg_cron scheduler worker is alive
- pg_net worker is alive

Current Supabase guidance identifies these same primitives as the first diagnostics when scheduled Edge Function delivery fails:

- check pg_cron scheduler;
- inspect cron.job_run_details;
- check pg_net background worker;
- inspect HTTP response errors;
- preserve Vault-based secret delivery.

## Scheduler contract

The classifier freezes the first-capture scheduler contract:

- exactly three active capture jobs;
- all target stock-hunter-capture-v416;
- all resolve project URL from Vault;
- all resolve the custom capture token from Vault;
- all send X-Stock-Hunter-Capture-Token;
- zero active cron caller targets stock-hunter-capture-v417.

The dark v417 deployment therefore cannot silently enter the prospective experiment.

## Vault contract

Only Vault secret names are validated:

- stock_hunter_project_url_v416
- stock_hunter_capture_token_v416

Secret values are not exported, logged, or committed.

## Capture RPC security

Live ACL audit confirms these internal SECURITY DEFINER RPCs are not executable by anon/authenticated:

- claim_stock_hunter_capture_v416()
- finish_stock_hunter_capture_v416(integer,text)
- stock_hunter_validate_capture_token_v416(text)

They remain executable by service_role/postgres as required by the Edge Function path.

## Incident states

The classifier emits:

- WAITING_FOR_FIRST_MARKET_WINDOW
- WITHIN_FIRST_CAPTURE_GRACE
- CRON_SCHEDULER_DOWN
- PG_NET_WORKER_DOWN
- CAPTURE_CRON_NOT_RUN
- CAPTURE_CRON_FAILED
- CAPTURE_NOT_CLAIMED
- CAPTURE_REPORTED_ERROR
- CAPTURE_NO_SUCCESS
- CAPTURE_SUCCESS_STALE
- CAPTURE_SUCCESS_ZERO_SHADOW_OBSERVED
- FIRST_CAPTURE_HEALTHY

ERROR states are operational incidents.

CAPTURE_SUCCESS_ZERO_SHADOW_OBSERVED is WARN only during first capture because zero Shadow in a single real batch is not, by itself, proof of a broken data path.

## Fail-safe remediation policy

Automatic repair is prohibited.

The classifier returns a manual_next_action for each incident.

The allowed diagnostic/remediation order is:

1. scheduler worker and cron history;
2. pg_net worker / HTTP response failures;
3. Vault/token/Edge Function path;
4. capture claim/finish state;
5. actual prospective Shadow/Hunt evidence;
6. only then an operator decision.

No repair may fabricate an observation timestamp or backfill missed prospective market evidence.

If an observation window is missed, the correct scientific response is to preserve the gap and continue with future real observations, not recreate historical samples.

## Current completion state

LIVE_DIAGNOSTIC_PASS / FIRST_REAL_CAPTURE_PENDING

No production mutation was performed in this step.
