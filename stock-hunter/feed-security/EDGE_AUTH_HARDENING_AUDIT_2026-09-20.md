# Stock Hunter — Edge Auth Hardening Audit

DATE: 2026-09-20
STATUS: LIVE_HARDENING_PASS

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
Deployment completed from the exact reviewed branch sources.

Live deployments:
- `stock-hunter-local-ingest-v4`: version 3, `verify_jwt=false`, deployed SHA-256 `ec28a00699ebd33546b7f91b74950ad95716df0e5d205c6eb3cfc46f11068974`;
- `stock-hunter-capture-v417`: version 2, `verify_jwt=false`, deployed SHA-256 `066cc265d990a9673aff0d755acebe142a89170e0479616ea2fc76fe4974a543`.

Post-deploy source verification:
- deployed local-ingest source is byte-identical to the reviewed repository source;
- no raw Feed-key constant is present in the deployed local-ingest source;
- the SHA-256 Feed-key digest contract is present;
- deployed v417 capture source is byte-identical to the reviewed repository source;
- the legacy static capture-token validator is absent;
- the HMAC timestamp/nonce validator is present.

GitHub Actions evidence:
- workflow: `Stock Hunter Edge Auth Hardening`;
- run: `35492777241`;
- post-deploy contract job: `106030648342` — PASS;
- post-deploy live-negative job: `106030634765` — PASS;
- v417 parity GET: PASS, protocol `4.1.7-capture-parity-v1`, 9 fixtures;
- missing/legacy/forged v417 capture callers: 401 PASS;
- missing/wrong local Feed callers: 401 PASS;
- Main Integration run `35492777243`: PASS.

## Safety result
No 4.1.6 scorer, threshold, model, prospective-data rule, Calibration/OOS state, routing state, challenger traffic, or kill-switch setting was modified by this repair.

The 4.1.7 capture endpoint remains dark/no-traffic. This hardening does not authorize lifecycle advancement.

The local Feed caller contract remains `x-feed-key` with the same accepted caller credential, so no Feed Agent credential rotation was required by this source-hardening step.

Future optional improvement: move the Feed caller credential into a Supabase Edge Function project secret when an authorized secrets-management path is available. Until then, the deployed source no longer contains the plaintext credential.
