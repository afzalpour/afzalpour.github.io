# Stock Hunter 4.1.7 Capture Dark Deployment Audit

AUDIT_DATE: 2026-09-18
LAST_HARDENING_UPDATE: 2026-09-20
STATUS: DARK_DEPLOYED / NO_TRAFFIC / NO_FINAL_ATTESTATION / HMAC_HARDENED
TARGET_PROJECT: summnepwuziwulzvpcms
FUNCTION_SLUG: stock-hunter-capture-v417
FUNCTION_ID: 21dc3f37-1f23-4ff9-b6da-68393b238989
DEPLOYMENT_VERSION: 2
DEPLOYMENT_SHA256: 066cc265d990a9673aff0d755acebe142a89170e0479616ea2fc76fe4974a543

## Purpose

The 4.1.7 capture component is deployed in advance of any real challenger traffic so final-release component readiness can be hardened and verified without changing the production Champion.

This deployment does not activate 4.1.7 traffic and does not create a final release attestation or manifest.

## Source provenance and scorer freeze

The deployed source is committed at:

`stock-hunter-v4/release/capture-v417/stock-hunter-capture-v417/index.ts`

Supabase Management retrieval after the 2026-09-20 hardening confirms that deployed `index.ts` is byte-for-byte identical to the reviewed repository source.

The scorer remains derived from the archived 4.1.6 capture implementation with only:
- 4.1.7 source/protocol identity fields;
- 4.1.7 component/storage identity fields;
- the approved request-authentication hardening described below.

No scoring, eligibility, activity, risk, timing, evidence, or candidate-state formula changed.

Frozen identity deltas:
- `4.1.6-shadow-v2-parity` → `4.1.7-shadow-capture-v1-parity`;
- `4.1.6-server-v4-parity` → `4.1.7-server-v1-parity`;
- `4.1.6-browser-server-parity-v1` → `4.1.7-capture-parity-v1`;
- `componentVersion/component_version = 4.1.7`;
- `storageProtocol/storage_protocol = v416-stable-schema`.

## Stable database protocol

The v417 component intentionally continues to use the frozen v416 storage/control RPC contract:
- `claim_stock_hunter_capture_v416`;
- `record_stock_hunter_hunt_events_v416`;
- `record_stock_hunter_shadow_samples_v416`;
- `finish_stock_hunter_capture_v416`.

Request authorization now uses the hardened shared validator:
- `stock_hunter_validate_capture_request_v416`.

This is a stable database protocol dependency, not a request to activate the 4.1.6 runtime engine.

## Authentication hardening — 2026-09-20

The original dark deployment used the legacy static-token validator. Before any 4.1.7 traffic existed, that surface was upgraded to the same replay-resistant request contract already proven on live 4.1.6 capture.

Supabase metadata remains:
- status = ACTIVE;
- `verify_jwt = false` by design because this service-to-service endpoint performs custom authorization in function code;
- import map = false.

For POST, the function:
1. explicitly rejects the legacy `x-stock-hunter-capture-token` header;
2. requires `x-stock-hunter-capture-auth: hmac-sha256-v2`;
3. requires timestamp, nonce and 64-hex signature headers;
4. calls `stock_hunter_validate_capture_request_v416`;
5. reaches claim/scan/write paths only after that validator returns true.

The shared validator is Vault-backed, enforces timestamp freshness and atomically rejects nonce replay.

Public `GET ?parity=1` remains read-only.

## Dependency pinning

The Edge source pins:

`npm:@supabase/supabase-js@2.116.0`

No unpinned npm dependency was introduced.

## Dark deployment isolation

No routing change was performed by either the initial deployment or the HMAC hardening.

The canonical control plane remains fail-closed until the real lifecycle permits a transition:
- production Champion = 4.1.6;
- 4.1.7 challenger traffic = 0%;
- kill switch remains engaged.

The HMAC hardening does not authorize a caller, enable a cron target, create an Activation Review, or advance the lifecycle.

## Current Management API identity

After the 2026-09-20 hardening:
- id: `21dc3f37-1f23-4ff9-b6da-68393b238989`;
- slug: `stock-hunter-capture-v417`;
- status: ACTIVE;
- version: 2;
- verify_jwt: false;
- `ezbr_sha256: 066cc265d990a9673aff0d755acebe142a89170e0479616ea2fc76fe4974a543`.

Historical initial dark deployment:
- version: 1;
- `ezbr_sha256: bd350c80dfcaba5a530fd7153d13c7dd19249b8ab87a1a715458ac5ed3236d4c`.

The live 4.1.6 capture remains the production capture endpoint; its scorer/formulas were not modified by this v417 hardening.

## Verification

Post-deploy GitHub Actions:
- Edge Auth Hardening run `35492777241`;
- contract job `106030648342`: PASS;
- post-deploy live-negative job `106030634765`: PASS;
- v417 parity protocol: `4.1.7-capture-parity-v1`;
- parity fixtures: 9/9 returned;
- missing auth: 401;
- legacy static-token probe: 401;
- forged HMAC probe: 401.

The dedicated Dark Deploy Contract workflow was updated to model the approved identity/version + HMAC-security delta while still requiring exact scorer derivation from the archived 4.1.6 source.

## Final release attestation

No row was added to `private.stock_hunter_release_component_attestations_v417`.

That remains deliberate: final release requires fresh external component evidence within the frozen attestation window. A current attestation would expire long before natural post-activation maturity.

At final release time, GitHub API and Supabase Management API must be queried again and a new immutable attestation recorded from fresh evidence.

## Completion semantics

The v417 capture component is available but dark and HMAC-hardened.

Current release status remains:

`LIVE_CONTRACT_PASS / REAL_FINAL_RELEASE_BLOCKED_ON_MATURITY_AND_FRESH_ATTESTATION`

Do not point production traffic at `stock-hunter-capture-v417` until the canonical lifecycle reaches the appropriate manually authorized transition.
