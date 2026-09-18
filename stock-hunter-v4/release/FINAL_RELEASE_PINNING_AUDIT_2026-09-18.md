# Stock Hunter 4.1.7 Final Version Promotion / Pinning Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_FINAL_RELEASE_NOT_FROZEN
CONTRACT: MANUAL_ONE_SHOT_PREPARE_AUTHORIZE_FREEZE_WITH_416_ROLLBACK_ARCHIVE

## Current live state

The release train is still intentionally before real activation maturity:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- state_version = 1
- Post-Activation stabilization = false
- stabilization reason = NOT_AT_FULL_ACTIVATION
- release-pin readiness = false
- release-pin reason = POST_ACTIVATION_NOT_STABLE
- 4.1.7 release manifests = 0
- release-freeze authorizations = 0
- previous-stable rollback archives = 0

No real 4.1.7 release manifest, authorization, freeze, or previous-stable archive row was created.

The target capture function stock-hunter-capture-v417 is not deployed yet. Therefore an actual final 4.1.7 pin is operationally impossible today even if the statistical gates were mature.

## Release identity hardening

Migration stock_hunter_final_release_pinning_hardening_20260918 was applied once as version 20260918075721.

The release policy is now frozen:

- target_release_version = 4.1.7
- previous_stable_version = 4.1.6
- required_capture_function_slug = stock-hunter-capture-v417
- auto_freeze = false

anon, authenticated, and service_role have no policy write access.

The final manifest now requires an exact 64-character capture deployment SHA-256 in addition to:

- full Git commit SHA;
- engine asset tag 4.1.7;
- dashboard tag 4.1.7;
- service-worker cache pinned to shikar-sahm-v4.1.7-*;
- stock-hunter-capture-v417 slug;
- capture deployment version;
- capture release tag 4.1.7;
- audit release tag 4.1.7;
- activation Review/state binding;
- frozen dataset fingerprint;
- Post-Activation stabilization snapshot.

The legacy prepare signature without capture SHA-256 is fail-closed and cannot create a manifest.

## Manual one-shot freeze

The lifecycle is now:

PREPARE -> AUTHORIZE_FREEZE -> FROZEN

private.prepare_stock_hunter_release_pin_v417(...) is postgres-only and cannot prepare until the live Post-Activation monitor reports stabilization_ready_for_version_promotion=true.

private.authorize_stock_hunter_release_freeze_v417(...) is a separate postgres-only one-shot authorization. It requires:

- current state_version;
- current activation Review;
- the currently PREPARED release_id;
- ready_for_manual_release_freeze=true;
- exact capture SHA pin.

private.freeze_stock_hunter_release_v417(...) rechecks readiness and manifest fingerprint in the same transaction. It then requires an unconsumed authorization for the same release/state.

Only the following manifest mutation is permitted:

PREPARED -> FROZEN

All manifest identity fields are immutable. Delete/truncate are rejected.

Authorization audit fields are immutable; the only permitted update is consumed_at: NULL -> timestamp exactly once.

## 4.1.6 rollback package

The previous-stable archive is not a label-only record.

The verified rollback package is pinned to:

- release: 4.1.6
- engine: 4.1.6-hunt-v2
- pre-final Git commit: b550ac2dddf297d2436493f4e7384a166dbdf1dd
- index.html blob: bb2ca00e0f7f08601f26daf5b9837f52c3a9c33f
- app-hunt-v416.js blob: b4e71668d6470d47dc49d3dd5945cbe7a5a8bf77
- sw.js blob: 59b79a3385a756fdd6d5aae1f2b3d8f88a4fd52c
- service worker cache: shikar-sahm-v4.1.6-r12
- capture slug: stock-hunter-capture-v416
- capture deployment version: 5
- capture deployment SHA-256: 6eb0ba0ee5e9dae3b8d6bab5c79f7f48a98ae643fd35ebe968d8d41eb73fdc76

The exact live capture-v416 index.ts is archived under:

stock-hunter-v4/release/rollback-v416/stock-hunter-capture-v416/index.ts

At final freeze, private.stock_hunter_previous_stable_archive_v417 receives:

- previous version / engine;
- the pre-freeze activation-status snapshot;
- rollback_package_snapshot;
- archive_fingerprint.

That archive is immutable.

The freeze transaction deliberately does not modify runtime activation status. This preserves the operational rollback target and avoids conflating version pinning with traffic routing.

## Negative controls

Three live negative controls were executed from the current immature state:

1. hardened release PREPARE;
2. release-freeze AUTHORIZE;
3. final FREEZE.

All three were rejected by their maturity/readiness gates.

After the probes:

- manifests = 0
- freeze authorizations = 0
- rollback archives = 0

Reusable verifier:

stock-hunter-final-release-pinning-v417: PASS

## Security Advisor

After DDL, Supabase Security Advisor reported no new WARN/ERROR. The only remaining notice is the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417; this step did not change that private/API-denied object.

## Completion semantics

The final release-control contract is complete and live-verified.

The actual 4.1.7 final release is NOT frozen. That remains correctly blocked until the full real sequence has occurred:

prospective maturity -> Calibration/Validation/Robustness -> one-time OOS -> Promotion -> Forward Shadow -> Activation Review -> Admission -> 5/10/25/50 Canary -> independent 100% gate -> Post-Activation stabilization -> deploy/pin exact 4.1.7 components -> manual freeze.

Only after that sequence may 4.1.7 become FROZEN in the release manifest. The 4.1.6 rollback package remains preserved rather than deleted.
