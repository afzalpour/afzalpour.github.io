# Stock Hunter 4.1.6 Capture Authentication Contract

CAPTURE_AUTH_CONTRACT: VAULT_HMAC_NONCE_V2

## Scope

This contract covers the deployed Supabase Edge Function `stock-hunter-capture-v416` in project `summnepwuziwulzvpcms`.

The function intentionally remains `verify_jwt = false` because capture is a database-cron/service-to-service endpoint, not a browser/user-JWT endpoint. Current Supabase API-key guidance also requires in-code authorization for opaque server secret keys when `verify_jwt` is not the appropriate platform verifier.

The boundary is no longer a static capture bearer token on the wire. The dedicated Vault secret is now used only as an HMAC signing key inside Postgres.

## Required request boundary — HMAC v2

Capture POST requests require all of:

- `X-Stock-Hunter-Capture-Auth: hmac-sha256-v2`
- `X-Stock-Hunter-Capture-Timestamp: <unix seconds>`
- `X-Stock-Hunter-Capture-Nonce: <uuid>`
- `X-Stock-Hunter-Capture-Signature: <64 lowercase hex chars>`

Canonical signing input:

`stock-hunter-capture-v416:v2:<timestamp>:<nonce>`

Signature:

`HMAC-SHA256(canonical_input, Vault capture secret)`

Security properties:

1. The dedicated Vault secret is never transmitted to the Edge Function.
2. Signed requests are accepted only within ±180 seconds of database time.
3. The nonce must be a UUID and is inserted into a private one-shot nonce ledger.
4. Reuse of the same valid nonce is rejected.
5. Invalid/missing/stale/malformed signatures fail closed as HTTP 401.
6. The legacy `X-Stock-Hunter-Capture-Token` header is explicitly rejected by the deployed Edge Function.
7. Generic `Authorization` bearer credentials never substitute for the signed capture boundary.
8. The first capture-authorizing database operation is `stock_hunter_validate_capture_request_v416`; claim/scan/write happens only after it returns true.

## Database signer

The three production pg_cron jobs run as `postgres` and now execute only:

`select private.invoke_stock_hunter_capture_v416();`

The private signer:

- reads the project URL and capture HMAC secret from Vault;
- generates a fresh Unix timestamp and UUID nonce;
- computes HMAC-SHA256;
- sends the signed POST through `pg_net`.

The signer has no execute grant for `PUBLIC`, `anon`, `authenticated`, or `service_role`.

Cron schedules and job ids are unchanged.

## Nonce ledger

`private.stock_hunter_capture_request_nonces_v416` stores only nonce/request-time/consumption time. It stores no signing secret.

Direct table access is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. The validator cleans expired nonce rows after a valid signature and uses a primary-key insert to make replay rejection atomic.

## Supabase database privilege boundary

`stock_hunter_validate_capture_request_v416(bigint,text,text)` is executable by `service_role` because the Edge Function uses its internal admin client to call the validator after cheap header-shape checks.

`anon` and `authenticated` cannot execute:

- HMAC validator;
- legacy token validator;
- capture lease claim;
- capture finish.

`stock_hunter_capture_state_v416` remains RLS-enabled with no public-role DML.

## Parity endpoint

`?parity=1` remains GET-only and returns only deterministic parity fixtures. It does not validate/consume a nonce, claim a capture lease, scan market rows, or write data.

## Live hardening evidence — 2026-09-19

- Edge Function deployed version: 6.
- Edge Function `verify_jwt`: false, paired with HMAC v2 in-code authorization.
- deployed ezbr sha256: `b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af`.
- real DB-signed request: HTTP 200 and `outside-market-window` after authorization.
- nonce validator replay drill: first validation true; second identical nonce validation false.
- production cron jobs 15/16/17 keep their original schedules and now call the private signer only.
- raw capture secret is absent from cron command text.
- browser↔backend parity was already final-revalidated before this hardening.

## Rollback note

The legacy validator remains service-role-only so the archived previous Edge Function can still be used in a controlled rollback. The active Edge Function no longer calls it and explicitly rejects the legacy token header.

## CI regression boundary

The parity/security workflow must prove against the deployed endpoint:

- missing signed headers => 401;
- legacy static-token header => 401;
- forged but well-shaped HMAC request => 401;
- bearer-only credential => 401;
- base GET => 405;
- parity POST => 405;
- public deterministic parity output still exactly matches browser fixtures;
- repo security contract contains HMAC/nonce/timestamp and private signer invariants.

No Capture hardening may alter Hunt formulas, thresholds, source versions, prospective boundaries, or capture data semantics.
