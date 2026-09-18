# Stock Hunter 4.1.7 Capture Dark Deployment Audit

AUDIT_DATE: 2026-09-18
STATUS: DARK_DEPLOYED / NO_TRAFFIC / NO_FINAL_ATTESTATION
TARGET_PROJECT: summnepwuziwulzvpcms
FUNCTION_SLUG: stock-hunter-capture-v417
FUNCTION_ID: 21dc3f37-1f23-4ff9-b6da-68393b238989
DEPLOYMENT_VERSION: 1
DEPLOYMENT_SHA256: bd350c80dfcaba5a530fd7153d13c7dd19249b8ab87a1a715458ac5ed3236d4c

## Purpose

This step clears the operational component-deployment blocker discovered during final release live closure.

It does not activate 4.1.7 traffic and does not create a final release attestation or manifest.

## Exact source provenance

The deployed source is committed at:

stock-hunter-v4/release/capture-v417/stock-hunter-capture-v417/index.ts

Supabase Management API retrieval confirms that deployed index.ts is byte-for-byte identical to that repository source.

The source is derived from the archived/live stock-hunter-capture-v416 implementation with identity-only changes:

- shadow source version:
  4.1.6-shadow-v2-parity
  ->
  4.1.7-shadow-capture-v1-parity

- event/source version:
  4.1.6-server-v4-parity
  ->
  4.1.7-server-v1-parity

- parity protocol:
  4.1.6-browser-server-parity-v1
  ->
  4.1.7-capture-parity-v1

- componentVersion/component_version = 4.1.7
- storageProtocol/storage_protocol = v416-stable-schema

No scoring, eligibility, activity, risk, timing, evidence, or candidate-state formula changed.

## Stable database protocol

The v417 capture component intentionally continues to use the frozen v416 storage/control RPC contract:

- stock_hunter_validate_capture_token_v416
- claim_stock_hunter_capture_v416
- record_stock_hunter_hunt_events_v416
- record_stock_hunter_shadow_samples_v416
- finish_stock_hunter_capture_v416

This is a stable database protocol dependency, not a request to activate the 4.1.6 runtime engine.

No database schema migration was needed for this dark deployment.

## Authentication

Supabase deployment metadata:

- status = ACTIVE
- verify_jwt = false
- import_map = false

verify_jwt=false is intentional and matches the already-hardened v416 capture security model.

Before any write path, POST requires:

x-stock-hunter-capture-token

and validates it through:

stock_hunter_validate_capture_token_v416

The token is not embedded in repository source.

The endpoint does not accept unauthenticated POST capture operations.

Public GET parity remains read-only, matching the existing v416 parity model.

## Dependency pinning

The Edge source still pins:

npm:@supabase/supabase-js@2.116.0

No unpinned npm dependency was introduced.

## Dark deployment isolation

Live pg_cron inspection after deployment found zero active commands referencing:

stock-hunter-capture-v417

Existing capture jobs continue to target only:

stock-hunter-capture-v416

No browser/runtime file was switched to the v417 slug.

Therefore deployment does not change capture traffic.

## Management API identity

Supabase Management API reports:

- id: 21dc3f37-1f23-4ff9-b6da-68393b238989
- slug: stock-hunter-capture-v417
- status: ACTIVE
- version: 1
- verify_jwt: false
- ezbr_sha256: bd350c80dfcaba5a530fd7153d13c7dd19249b8ab87a1a715458ac5ed3236d4c

The v416 rollback capture remains unchanged:

- slug: stock-hunter-capture-v416
- version: 5
- status: ACTIVE
- ezbr_sha256: 6eb0ba0ee5e9dae3b8d6bab5c79f7f48a98ae643fd35ebe968d8d41eb73fdc76

## Final release attestation

No row was added to:

private.stock_hunter_release_component_attestations_v417

That is deliberate.

The final-release gate accepts only a fresh external attestation, with a frozen maximum age of 60 minutes.

Recording an attestation now would make it stale long before natural Post-Activation maturity.

At final release time, GitHub API and Supabase Management API must be queried again and a new immutable attestation recorded from that fresh evidence.

## HTTP smoke limitation

The current assistant execution environment could not directly invoke the public function URL:

- the general web fetcher does not permit this project function URL;
- the local container has no outbound DNS.

Therefore no synthetic HTTP POST was attempted.

Verification instead uses:

- exact Management API deployment metadata;
- exact deployed-source retrieval;
- byte-for-byte source equality with repository;
- static custom-auth contract checks;
- zero live v417 cron callers;
- CI source-derivation parity.

No production capture was triggered for testing.

## Completion semantics

The component deployment blocker for Final Release #14 is cleared.

The current final-release status is now:

LIVE_CONTRACT_PASS / REAL_FINAL_RELEASE_BLOCKED_ON_MATURITY_AND_FRESH_ATTESTATION

The v417 capture component is available but dark.

Do not point cron/client traffic at stock-hunter-capture-v417 until the real lifecycle reaches the appropriate release transition.
