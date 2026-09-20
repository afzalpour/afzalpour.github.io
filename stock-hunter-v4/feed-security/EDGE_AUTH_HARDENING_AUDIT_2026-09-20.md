# Stock Hunter — Edge Auth Hardening Audit

DATE: 2026-09-20
STATUS: PREPARED / LIVE_DEPLOY_PENDING

## Scope
This security repair is limited to two already-deployed Edge Functions:
- `stock-hunter-local-ingest-v4`;
- dark/no-traffic `stock-hunter-capture-v417`.

It does not change the 4.1.6 Hunt engine, scoring formulas, thresholds, prospective boundaries, Calibration/OOS state, routing, traffic percentage, or kill-switch state.

## Finding 1 — local Feed secret embedded in deployed source
The deployed local-ingest function contained the accepted `x-feed-key` value directly in source.

Hardening:
- keep the existing caller/header contract unchanged;
- remove the raw secret from source;
- store only a SHA-256 digest;
- hash the presented header with Web Crypto before comparison;
- preserve the same high-entropy accepted secret so the external Feed Agent does not require a coordinated credential change.

The repository now contains the deployable source at:
`stock-hunter-v4/feed-security/stock-hunter-local-ingest-v4/index.ts`.

A future operator may move this credential to a Supabase Edge Function project secret when a secrets-management path is available; no weaker browser-side credential path is acceptable.

## Finding 2 — dark 4.1.7 capture still used legacy static-token validation
The dark-deployed `stock-hunter-capture-v417` predated the 4.1.6 HMAC+nonce hardening and still called the legacy static-token validator.

Hardening:
- reject the legacy `x-stock-hunter-capture-token` header;
- require `hmac-sha256-v2`;
- require timestamp + nonce + 64-hex signature;
- authorize through `stock_hunter_validate_capture_request_v416`, reusing the existing Vault-backed replay-resistant validator/nonce ledger;
- preserve the entire 4.1.7 scorer/parity implementation and dark/no-caller state.

## CI
Workflow:
`.github/workflows/stock-hunter-edge-auth-hardening.yml`

It requires:
- Deno type-check of both sources;
- static absence of the raw Feed-key constant pattern;
- static HMAC contract for v417 capture;
- deployed v417 parity GET remains 9 fixtures;
- missing/legacy/forged capture callers return 401;
- missing/wrong local Feed callers return 401.

## Live closure
Pending. This section must be updated with deployed versions/hashes and CI run evidence before merge.
