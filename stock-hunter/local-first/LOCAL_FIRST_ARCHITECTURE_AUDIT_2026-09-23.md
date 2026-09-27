# Stock Hunter Local-First v4.0.7 — Architecture / Binary Patch Audit

Date: 2026-09-23
Status: PREPARED / CLIENT SMOKE PENDING

## Goal
Finish the production 4.1.6 live-market path without any paid hosting dependency and without requiring Supabase availability for day-to-day Hunt operation.

## Live path
Primary:
`Stock_Hunter_Feed_Agent_v4.0.7_LocalFirst.exe`
→ `http://127.0.0.1:41716/ingest`
→ `Stock_Hunter_Local_Bridge_v4.0.7.exe`
→ GitHub Pages browser REST reads on localhost.

Fallback:
Supabase remains configured as cloud fallback/legacy evidence storage. It is not required for live local Hunt availability.

## Agent patch provenance
Input:
- `Stock_Hunter_Feed_Agent_v4.0.6.exe`
- SHA-256: `a43ccddce0f71df02ddeea1f1d0efcd77a79727dcec0506ec8dcf30454d1c458`

Output:
- `Stock_Hunter_Feed_Agent_v4.0.7_LocalFirst.exe`
- SHA-256: `eaea31f3796c112524ba026efb48137494da488d62388a863e110e3a30abe88d`

Binary changes are restricted to:
1. ingest URL bytes at PE file offset `0x31454c`;
2. the matching Go string-length immediate at PE file offset `0x27c3cc` (82 → 29);
3. one version marker `4.0.6` → `4.0.7`.

Old endpoint:
`https://summnepwuziwulzvpcms.supabase.co/functions/v1/stock-hunter-local-ingest-v4`

New endpoint:
`http://127.0.0.1:41716/ingest`

The market acquisition/scoring/feed serialization code and X-Feed-Key header contract are otherwise unchanged.

## Local Bridge
- Windows amd64 executable SHA-256: `ea8930ed1e0d09224d68cc5702366859a5f24018643c3d17f63719f2e67d6dd8`.
- Binds only `127.0.0.1:41716`.
- Accepts the unchanged Agent JSON payload.
- Adds a fresh local `updated_at` to received rows.
- Serves REST-compatible endpoints for:
  - `stock_hunter_integrated_v1`
  - `stock_hunter_signals_v4`
  - `stock_hunter_feed_health_v4`
  - `stock_hunter_universe_v4`
- Stores `latest.json` under `%LOCALAPPDATA%\StockHunterLocalBridge`.
- Archives one gzip snapshot per 15-minute bucket under `archive\YYYY-MM-DD`.
- No secret or paid service is required by the bridge.

## Browser contract
4.1.6 tries localhost first and falls back to Supabase only if the local bridge is unavailable/uninitialized.
The existing <=180-second freshness gate remains authoritative; stale local snapshots can be searchable but cannot become active Action Now/Radar alerts.

## Package
`Stock_Hunter_Local_First_v4.0.7.zip`
SHA-256: `20b55a5d56b3ad6f1a542a03d48b0aa15c2935200f4dd72a3b05408c04627873`.

## Safety
Unchanged:
- production Champion 4.1.6;
- frozen engine `4.1.6-hunt-v2`;
- Hunt formulas/thresholds/models;
- CHAMPION_ONLY routing;
- challenger traffic 0%;
- kill switch ON;
- prospective historical evidence is never backfilled/fabricated.

Client smoke is required on Windows because the Agent/Bridge binaries cannot be executed natively in this Linux CI environment.
