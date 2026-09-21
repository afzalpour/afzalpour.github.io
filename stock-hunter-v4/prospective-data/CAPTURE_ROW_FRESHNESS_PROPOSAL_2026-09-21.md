# Stock Hunter — Per-row Capture Freshness Proposal

Date: 2026-09-21
Status: PROPOSAL_ONLY / NOT_DEPLOYED / NOT_MERGED
Scope: frozen 4.1.6 prospective capture safety

## Live finding

During the live 2026-09-21 market session, the local Feed recovered enough to produce fresh global heartbeats, but capture-v416 still scanned old rows inside stock_hunter_integrated_v1.

Observed production evidence:
- feed heartbeat at 2026-09-21 07:33:31.809+00
- latest signal update at 2026-09-21 07:33:50.800+00
- fresh rows existed inside the 180-second browser window
- capture invocation request id 731
- capture last_run_at 2026-09-21 07:34:39.356468+00
- capture last_success_at 2026-09-21 07:34:40.325674+00
- last_error = null
- one Hunt Event was recorded

The Hunt Event itself:
- event_id 6
- symbol: سفاسی
- hunt_state: هشدار فوری
- source row age at first_seen_at: 178 seconds
- therefore it was still inside the canonical 180-second production freshness limit at capture time

However the same capture wrote 292 Shadow samples, and an explicit join against each symbol's current source updated_at proved:
- stale-over-180 Shadow samples: 74
- stale sample id range: 2448..2732
- minimum stale source age: 220 seconds
- maximum stale source age: 1715 seconds
- affected observed_at interval: 2026-09-21 07:34:39.776+00 .. 2026-09-21 07:34:39.899+00

Earlier in the same session another stale cohort was already preserved:
- 146 stale-over-180 Shadow samples
- sample ids 1280..1425
- bucket 585

No contaminated row has been deleted, rewritten, fabricated or backfilled.

## Current fail-closed state

pg_cron job 16 stock-hunter-capture-v416-mid is PAUSED again:
- active = false
- schedule remains exactly * 6-12 * * 0-3,6
- command remains exactly select private.invoke_stock_hunter_capture_v416();

Production routing remains:
- 4.1.6 Champion
- CHAMPION_ONLY
- challenger traffic 0%
- kill switch ON

## Proposed code change

Proposal only; not deployed.

The capture query would:
1. select source updated_at;
2. compute freshCutoffIso = now - 180 seconds;
3. query stock_hunter_integrated_v1 with gte(updated_at, freshCutoffIso);
4. evaluate only rows that satisfy the same canonical maximum age used by Action Now.

No Hunt formula, threshold, score component, HMAC authorization, routing, event thresholds, lifecycle gate or browser UI is changed.

## Change-control note

PROJECT_CANONICAL_ARCHITECTURE.md freezes capture provenance / prospective boundaries for 4.1.6.
For that reason this branch/PR MUST NOT be merged or deployed without explicit user authorization for this specific capture-freshness change.

Until then the correct operational state is fail-closed capture rather than accepting known stale prospective rows.
