# Stock Hunter Cloud v1 — Bounded R2 Archive Policy

Status: STAGING CONTRACT / NO PRODUCTION CUTOVER AUTHORIZATION  
Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

## Purpose

Preserve short-horizon point-in-time raw market facts for reproducible diagnostics without recreating the unbounded-storage failure mode that occurred in Supabase.

This archive stores **collector facts**, not Hunt decisions, and does not resolve the still-open integrated-view provenance blockers.

## Object layout

Latest live snapshot (overwritten):

```text
live/latest.json.gz
```

Short-lived raw evidence:

```text
raw/v1/YYYY-MM-DD/<collector>/<stream>/<observed_at>-<sequence>-<hash16>.json.gz
```

Daily cross-snapshot compressed pack:

```text
packs/raw-v1/YYYY-MM-DD/market-facts.ndjson.gz
packs/raw-v1/YYYY-MM-DD/manifest.json
```

## Hard application budgets

Raw ingest archive:
- max compressed bytes per Tehran date: **1,000,000,000 bytes**;
- max raw objects per Tehran date: **1,500**;
- R2 lifecycle expiration: **3 days**.

Daily raw pack:
- upload is rejected by the compactor when the gzip pack exceeds **200,000,000 bytes**;
- R2 lifecycle expiration: **15 days**.

Cloudflare notes that lifecycle deletion may occur after the nominal expiration rather than exactly at that instant. The application budgets are intentionally below the free-tier ceiling so delayed cleanup has headroom.

The target is to keep the operational R2 footprint below the canonical 8 GB design ceiling. This is not a claim of provider-enforced 8 GB quota.

## Failure semantics

Live availability has priority over archival completeness.

If the raw daily archive budget is exhausted or the archive write fails:
- `live/latest.json.gz` still updates;
- the accepted live sequence still advances;
- health metadata reports the archive status;
- the event is **not** silently represented as archived evidence.

No historical job may infer missing raw snapshots.

## Daily compaction

GitHub Actions may read only already captured R2 objects. It must never call TSETMC.

The compactor:
1. downloads one Tehran date under `raw/v1/`;
2. validates protocol/identity;
3. rejects duplicate collector+stream+sequence;
4. sorts snapshots by observed time and sequence;
5. records sequence gaps rather than filling them;
6. writes deterministic NDJSON gzip;
7. records SHA-256, source bytes, row totals and per-stream gaps;
8. refuses upload if the daily pack budget is exceeded.

This pack is still **raw factual evidence**, not a Frozen Hunt feature pack. Long-lived feature/provenance packs remain blocked until their input provenance is scientifically closed.

## Scientific invariants

- no future backfill;
- no interpolation;
- no synthetic missing snapshots;
- original `observed_at`, sequence and collector identity are preserved;
- raw archive gaps stay explicit;
- historical use remains diagnostic unless a separate prospective/OOS gate says otherwise.
