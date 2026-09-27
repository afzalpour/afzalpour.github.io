# Stock Hunter 4.1.7 Main Integration Audit

AUDIT_DATE: 2026-09-18
STATUS: INTEGRATION_BRANCH_READY_FOR_CI
BRANCH: stock-hunter-v417-main-integration-20260918
INTEGRATION_COMMIT: 830ce5175a81b2da877bf6e9ad6a5ade288cd18e
MAIN_PARENT: 3da47720a7cedd4d1481e97e4e80614f80c4a364
V417_PARENT_LINEAGE: b7e7ccdf8797377ede7add85cd32bf53882485d5

## Merge strategy

The integration tree is based on the latest 4.1.7 hardening lineage and records current main as a second-parent ancestor.

Git comparison after integration:

- behind main = 0
- ahead of main = 127

## Conflict resolution

Three overlapping functional areas were reviewed.

### app-session-v413.js

main and the latest 4.1.7 branch are byte-identical.

The millisecond/second timestamp normalization fix is preserved.

### hunt-parity-v416.js

main and the latest 4.1.7 branch are byte-identical.

All nine frozen browser/server parity fixtures are preserved.

### canary-hold-rollback-v417.js

main contained an earlier embedded Recovery UI implementation.

The later 4.1.7 lineage intentionally split Recovery into:

canary-recovery-v417.js

and lazy-loads it from canary-hold-rollback-v417.js.

The modular later implementation was selected because it is the architecture covered by current rollout, service-worker, Recovery and staged-Canary CI contracts.

## Main-only files preserved

The following files existed only on current main and were explicitly retained:

- stock-hunter-v4/release-readiness-v417.js
- stock-hunter-v4/research/release-hardening-20260917.md

No main-only lineage was force-overwritten.

## Safety boundary

This integration changes repository/frontend content only.

It does not:

- change Supabase control-plane state;
- change challenger traffic;
- change capture cron routing;
- create OOS/Promotion/Activation/Release objects;
- switch prospective capture away from v416;
- create synthetic data.

Production remains governed by the live fail-closed control plane.

## Publish rule

Do not merge this integration branch to main unless the dedicated integration CI passes.

After merge, GitHub Pages must deploy the exact resulting main SHA successfully before frontend publication is considered complete.
