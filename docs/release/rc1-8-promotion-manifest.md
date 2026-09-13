# RC1.8 Production Promotion Manifest

Status: **PREPARED FOR DIFF CONSTRUCTION — NOT AUTHORIZED FOR MERGE**

Source runtime: `avan-staging/` at accepted cache `avan-staging-rc1-v121-module9-live-layout-polish`.
Target runtime: repository root Production RC1.7.
Rollback: `prod-backup-20260914-rc1-8-pre-promotion`.

## Intended release scope

- Module 4 — Continuous Close + Continuous Audit.
- Module 5 — Iran Compliance Radar.
- Module 7 — Smart Procurement & Spend Control.
- Module 9 — Avan Connect / Automation Marketplace.
- Shared accepted next-release corrections required by those modules, including strict Persian presentation and shared intelligence Print/PDF behavior.

## Never-copy exclusions

- `avan-staging/config.js` → preserve Production configuration.
- `avan-staging/package.json`, tests and scripts → quality tooling only.
- `avan-staging/runtime-divergence-allowlist.json` → Staging parity metadata only.
- Staging Service Worker cache identity → Production receives a new Production cache identity.

## Promotion validation contract

The promotion branch must pass the complete Staging architecture suite against the frozen source, then a Production-oriented release regression verifying:

1. Production configuration remains unchanged.
2. Production Service Worker includes every promoted runtime asset.
3. no Staging path/cache marker leaks into Production.
4. Modules 4/5/7/9 entrypoints are loaded from Production root.
5. ADR-0025 Persian contract remains active.
6. accounting/money precision and existing RC1.7 behavior remain unchanged.
7. no new automatic posting/payment/approval/external submission path is enabled.

This manifest is preparatory only. Merge requires separate explicit Production approval.