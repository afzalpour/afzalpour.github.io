# Stock Hunter 4.1.6 — Capture Backend HMAC Hardening Audit

DATE: 2026-09-19
STATUS: LIVE_HARDENING_PASS

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

## Closure evidence

- deployed endpoint parity/security workflow run `35467654427`: PASS;
- Browser↔Backend frozen fixture parity after hardening: PASS;
- missing signed headers: HTTP 401;
- legacy static-token header: HTTP 401;
- forged well-shaped HMAC: HTTP 401;
- bearer-only credential: HTTP 401;
- base GET and parity POST method boundaries: PASS;
- production Hunt contract unchanged: PASS;
- Main Integration run `35467690043`: PASS;
- hardened active cron jobs: 3/3;
- raw-secret cron command count: 0;
- anon/authenticated HMAC-validator execute: false;
- service_role HMAC-validator execute: true;
- service_role/anon private-signer execute: false;
- service_role/anon nonce-ledger direct DML: false;
- Security Advisor: no Capture-related finding.

The two remaining Security Advisor findings are unrelated to this Capture boundary: pre-existing private Canary RLS/no-policy INFO and Auth Leaked Password Protection WARN.

## Exit status

Capture Backend Security Hardening is **DONE / PASS** for the 4.1.6 active capture path. `verify_jwt=false` remains intentional and is paired with replay-resistant HMAC service authentication; it is not an unauthenticated write surface.
