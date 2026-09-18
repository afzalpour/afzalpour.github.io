# Stock Hunter 4.1.7 Final Release Live Closure

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_FINAL_RELEASE_BLOCKED_ON_COMPONENT_DEPLOYMENT_AND_MATURITY
TARGET_PROJECT: summnepwuziwulzvpcms
LIVE_MIGRATION: 20260918131512 stock_hunter_final_release_live_close_20260918
CONTRACT: EXTERNALLY_ATTESTED_MANUAL_ONE_SHOT_FINAL_FREEZE_WITH_416_ROLLBACK_ARCHIVE

## Current live state

No real release action was performed.

Current control-plane state remains:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- state_version = 1
- Post-Activation stabilization = false
- release manifests = 0
- component attestations = 0
- freeze authorizations = 0
- previous-stable archives = 0
- activation events = 0

The release gate remains fail-closed with:

POST_ACTIVATION_NOT_STABLE

## Existing final-release contract retained

The earlier release-pin hardening remains in force:

- target release = 4.1.7
- previous stable = 4.1.6
- required capture slug = stock-hunter-capture-v417
- auto_freeze = false
- PREPARE -> AUTHORIZE_FREEZE -> FROZEN
- manifest identity immutable
- one-shot freeze authorization
- exact capture deployment SHA-256 required
- rollback archive for 4.1.6
- runtime state is not mutated by version freeze

The legacy PREPARE signature without capture SHA-256 remains fail-closed.

## Gap found: manifest claims were not independently deployment-attested

Before this live-close, PREPARE accepted:

- a 40-character Git commit SHA;
- 4.1.7 component tags;
- a 4.1.7 service-worker cache name;
- a stock-hunter-capture-v417 deployment version;
- a 64-character capture SHA-256.

Those values were fingerprinted and immutable after PREPARE.

However, the database did not require an independently recorded observation proving that:

- the Git commit had actually been verified through GitHub API;
- stock-hunter-capture-v417 actually existed in the target Supabase project;
- that Edge Function was ACTIVE;
- its Management API deployment version and ezbr_sha256 matched the manifest.

Therefore a syntactically valid but operationally false component claim could theoretically reach PREPARED after statistical maturity.

## External component attestation

This live-close adds:

private.stock_hunter_release_component_attestations_v417

The table is private, API-denied, append-only and immutable.

An attestation records:

- target release version;
- exact source repository;
- exact Git commit SHA;
- engine version;
- dashboard version;
- service-worker cache version;
- exact Supabase project;
- Edge Function UUID;
- capture slug;
- deployment version;
- Management API ezbr_sha256;
- Edge Function ACTIVE status;
- verify_jwt state;
- external evidence JSON;
- observation time;
- immutable fingerprint.

The evidence source is frozen to:

GITHUB_API+SUPABASE_MANAGEMENT_API

The recorder is postgres-only.

The recorder accepts evidence only when the external observation timestamp is within 15 minutes of recording.

The database validates that the JSON evidence and typed attestation fields agree exactly.

This is intentionally an operator attestation after external API verification. PostgreSQL itself does not call GitHub or the Supabase Management API.

## Freshness contract

The frozen release-pin policy now additionally requires:

max_component_attestation_age_minutes = 60

PREPARE requires a matching attestation no older than 60 minutes.

Release readiness also requires a current matching attestation.

AUTHORIZE_FREEZE snapshots the current attestation ID/fingerprint.

FREEZE rechecks the current attestation and requires the authorization snapshot to match it.

If a deployment is re-verified later, a new immutable attestation may be appended. Old attestations remain audit evidence.

## Manifest binding

Every new 4.1.7 release manifest now has a NOT NULL foreign key:

component_attestation_id

The PREPARE manifest fingerprint includes this attestation ID.

The manifest immutability guard also freezes component_attestation_id.

The final FREEZE recomputes the manifest fingerprint including that ID.

## Release readiness hardening

stock_hunter_release_pin_readiness_v417 now additionally evaluates:

- exact component attestation match;
- exact Git commit match;
- exact engine/dashboard/cache match;
- exact capture slug/version/SHA match;
- capture status = ACTIVE;
- attestation freshness <= 60 minutes.

Explicit reasons include:

- RELEASE_COMPONENT_ATTESTATION_MISSING
- RELEASE_COMPONENT_ATTESTATION_MISMATCH
- RELEASE_COMPONENT_ATTESTATION_STALE

The previous first 33 readiness columns are preserved.

Four new audit fields are appended:

- component_attestation_id
- component_attestation_fingerprint
- component_attestation_observed_at
- pass_component_attestation

## Readiness ACL correction

Before this closure, the readiness view was security_invoker but had a service_role grant while its private source tables were not accessible to service_role.

That grant was non-functional and misleading.

The readiness view is now postgres-only.

The private manifest, freeze authorization, rollback archive, and component attestation tables remain unexposed.

This also aligns with Supabase's move toward explicit Data API grants rather than accidental exposure.

## Current external deployment evidence

Supabase Management API inventory for project summnepwuziwulzvpcms currently includes:

- stock-hunter-capture-v416
- status = ACTIVE
- deployment version = 5
- ezbr_sha256 = 6eb0ba0ee5e9dae3b8d6bab5c79f7f48a98ae643fd35ebe968d8d41eb73fdc76

There is currently no stock-hunter-capture-v417 Edge Function.

The current repository tree also contains no stock-hunter-capture-v417 source path.

Therefore no 4.1.7 component attestation was recorded.

That is intentional.

## 4.1.6 rollback package remains preserved

The final FREEZE contract still archives:

- previous release 4.1.6
- engine 4.1.6-hunt-v2
- service-worker cache shikar-sahm-v4.1.6-r12
- capture slug stock-hunter-capture-v416
- capture deployment version 5
- capture deployment SHA-256 6eb0ba0ee5e9dae3b8d6bab5c79f7f48a98ae643fd35ebe968d8d41eb73fdc76

The final version freeze still returns:

runtime_state_changed = false

Traffic routing and version pinning remain separate operations.

## Negative controls

From the current safe pre-activation state, live negative controls attempted:

1. PREPARE;
2. AUTHORIZE_FREEZE;
3. FREEZE.

All were rejected.

After the probes:

- component attestations = 0
- manifests = 0
- freeze authorizations = 0
- rollback archives = 0
- activation events = 0
- activation status unchanged

## Verification

New reusable verifier:

stock-hunter-final-release-live-close-v417: PASS

Legacy final-release verifier remains compatible:

stock-hunter-final-release-pinning-v417: PASS

Upstream regression verifiers:

- stock-hunter-post-activation-live-close-v417: PASS
- stock-hunter-full-activation-live-close-v417: PASS

## Security Advisor

No new WARN/ERROR was introduced.

The only remaining finding is the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417.

No cosmetic allow policy was added.

## Completion semantics

Roadmap item #14 is structurally live-closed.

The actual 4.1.7 final release is NOT prepared or frozen.

Real final promotion remains blocked until all earlier natural maturity gates pass and, after a real stable 100% activation, the exact final components exist and are freshly verified through both GitHub API and Supabase Management API.

At that point the required sequence is:

external component verification
-> record immutable component attestation
-> PREPARE manifest
-> separate AUTHORIZE_FREEZE
-> FREEZE
-> immutable 4.1.6 rollback archive

Until then, 4.1.6 remains the preserved rollback target and no final 4.1.7 release claim is valid.
