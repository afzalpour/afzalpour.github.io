# Stock Hunter — Market-Open Feed Guard Audit

Date: 2026-09-21
Status: FEED_STALE / CAPTURE_MID_PAUSED_FAIL_CLOSED / RECOVERY_PENDING

## Context

During the live Tehran market session, Stock_Hunter_Feed_Agent v4.0.6 successfully delivered one fresh batch of 500 symbols, then stopped advancing the feed heartbeat.

Verified live evidence:
- Agent version reported by server: `4.0.6`
- last feed heartbeat: `2026-09-21 06:07:21.677+00`
- latest signal update: `2026-09-21 06:07:18.232+00`
- the initial live batch contained 500 fresh rows
- subsequent public REST reads remained HTTP 200; this is not a Supabase data-plane outage

Independent checks:
- Public Production Smoke run `35538341215`, attempt 2: PASS
- 4.1.6 Live Data Plane Diagnostic run `35495501455`, attempt 5: HTTP 200 for both integrated rows and feed-health

## Prospective-data integrity finding

The active capture-v416 function does not select the source row `updated_at`. Its activity test can continue to accept a row based on recent snapshots/trade evidence for up to 30 minutes.

Before Feed recovery, an explicit read-only join of today's Shadow samples against current source rows proved:
- today's joined Shadow samples: 296
- samples definitely more than 180 seconds newer than their source row: 146
- affected sample IDs: `1280..1425`
- affected bucket: `585`
- first affected observed_at: `2026-09-21 06:15:06.505+00`
- last affected observed_at: `2026-09-21 06:15:06.620+00`
- maximum proven source age: 468 seconds
- prior bucket `570`: 150 samples, 0 proven stale-over-180, max source age 46 seconds

No Shadow rows were deleted, rewritten, backfilled or fabricated. This audit preserves the evidence before the source rows can be refreshed.

## Fail-closed operational action

To prevent another stale 15-minute bucket from being recorded while the local Feed is stale:
- pg_cron job `stock-hunter-capture-v416-mid`
- job id: `16`
- schedule: `* 6-12 * * 0-3,6`
- command remains exactly: `select private.invoke_stock_hunter_capture_v416();`
- state changed only from `active=true` to `active=false` using `cron.alter_job`

This is a temporary availability guard. It does not change Hunt formulas, thresholds, HMAC auth, routing, lifecycle gates or historical rows.

Re-enable condition:
1. `stock_hunter_feed_health_v4.last_feed_at` is fresh again;
2. `stock_hunter_signals_v4` contains rows within the 180-second production freshness window;
3. then reactivate job 16 with the same schedule and command.

## Local watchdog prepared

A temporary operational package was prepared:
- `Stock_Hunter_Feed_Watchdog_v4.0.7.zip`
- SHA-256: `b1ef976eaec3e8e471f7ef97024116835b22ebcf0fea43b49cf318bc38c12055`
- Library path: `/نرم افزار شکار سهم/Stock_Hunter_Feed_Watchdog_v4.0.7.zip`

The watchdog does not contain the Feed secret. It reads only the public feed-health row with the site's publishable key and restarts the unchanged v4.0.6 executable if the heartbeat remains stale. It also has a restart grace period to avoid restart storms.

## Safety state

Unchanged:
- production Champion: 4.1.6
- engine: `4.1.6-hunt-v2`
- routing: CHAMPION_ONLY
- challenger traffic: 0%
- kill switch: ON
- v4.1.7 capture: dark / no active callers
- first maturity horizon remains time-gated to 2026-09-22 14:55 UTC

Do not treat the 146 proven stale-over-180 Shadow samples as clean prospective evidence until the canonical maturity review explicitly resolves them.
