# Stock Hunter 4.1.6 — Capture Backend HMAC Hardening Audit

DATE: 2026-09-19
STATUS: LIVE_HARDENING_APPLIED / CI_PENDING

## Before

The capture Edge Function used a dedicated Vault-backed static token transported on every request as `X-Stock-Hunter-Capture-Token`.

The boundary was narrow and service-specific, but a captured header could be replayed until rotation.

## After

Protocol: `VAULT_HMAC_NONCE_V2`

The Vault secret is now a signing key and never leaves Postgres.

Every cron invocation generates:
- current Unix timestamp;
- random UUID nonce;
- HMAC-SHA256 signature.

The Edge Function accepts only the signed v2 headers and calls the service-role-only validator before lease claim / market scan / writes.

Validator requirements:
- timestamp within ±180 seconds;
- UUID nonce;
- lowercase 64-char HMAC;
- exact HMAC match;
- nonce first-use only.

The private nonce ledger has no direct `anon`, `authenticated`, or `service_role` DML access.

## Live evidence

- database migrations applied:
  - `stock_hunter_capture_hmac_replay_hardening_v416`
  - `stock_hunter_capture_hmac_function_fix_v416`
- deployed Edge Function version: 6
- deployed ezbr sha256: `b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af`
- real private-signer invocation request id: 55
- request id 55 response: HTTP 200 / `outside-market-window`
- replay validator drill: PASS (same signed nonce accepted once, rejected on second validation)
- cron job ids 15/16/17 preserve schedules and now contain only:
  `select private.invoke_stock_hunter_capture_v416();`

## Compatibility / JWT decision

`verify_jwt=false` is retained intentionally. The endpoint is not user-authenticated and does not trust browser JWTs. Current Supabase guidance for backend/pg_net integrations with modern opaque secret keys uses in-code authorization rather than relying on legacy platform `verify_jwt`.

The active boundary is stronger than the previous static-token transport because interception of one signed request does not create a reusable credential.

## Non-changes

No change to:
- Hunt formulas or thresholds;
- parity fixtures;
- source_version values;
- prospective start boundary;
- capture lease semantics;
- integrated-market read scope;
- Hunt/shadow record RPCs.

## Pending before closure

- repository CI parity/security regression on the deployed v6 endpoint;
- database privilege/cron verification snapshot;
- Supabase Security Advisor recheck;
- final canonical handoff update.
