# AVAN — Production Release RC1.5

Release status: **Production Released**

Release date: **2026-09-10**

## Runtime

- Production promotion PR: **#103** — `Release RC1.5 to Production`.
- Production merge commit: `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- Production URL: `https://afzalpour.github.io/`.
- Production Release Gate #1 on PR #103: **PASS**.
- Post-merge Production Release Gate #2: **PASS**.
- GitHub Pages run #332: **PASS**.
- External Production HTTP Smoke run #1: **PASS**.
- Production Service Worker cache: `avan-prod-rc1-5-v1`.
- Rollback freeze branch: `prod-backup-20260910-rc1-5-pre-promotion`.
- Rollback freeze SHA: `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`.
- Production `config.js` was preserved during promotion.

## User acceptance

The accumulated RC1.5 Live Gate was explicitly accepted by the user with:

**«شش مورد پاس شد — RC1.5 Live PASS»**

Previously accepted granular Live gates remain valid, including:

- Settings no-layout-shift;
- e-Invoice prevalidation/discoverability;
- Company Context post-auth hydration / company entry without manual refresh;
- Dashboard Risk and Financial Analysis presentation;
- one-Rial money, VAT → Settlement exactness, sale/purchase settlement modes, report/print unit presentation, iPhone/mobile usability and PWA offline shell.

## Final post-Live fixes included in Production

### Invoice save latency

The normal sale/purchase invoice save path was optimized before promotion:

- full-page reload/login flash removed from the normal save flow;
- repeated Auth `/user` round-trips reduced;
- token refresh made single-flight;
- Company Context avoids redundant authenticated refresh when already authoritative;
- redundant Settlement invoice-total readback removed while the Backend exact-total validation remains authoritative;
- post-save refresh is reduced to an RLS-governed authoritative snapshot RPC instead of many independent reads.

Backend query statistics observed before release showed the accounting writes themselves were not the multi-second bottleneck (draft/post/settlement RPC execution was in the low hundreds of milliseconds or less); the dominant delay was Frontend/Auth orchestration.

### Settlement money presentation

All settlement modes retain exact canonical money while presenting:

- three-digit grouping;
- Persian amount-in-words beneath settlement amounts;
- one-Rial precision under ADR-0019.

### PWA precache integrity

Two retired runtime references were removed from Service Worker precache before Production:

- `src/ui/money/live-money-inputs.js`;
- `src/documents/document-viewer-v2.js`.

A permanent regression guard now verifies every declared Staging precache asset actually exists before future promotion.

## Production integrity baseline — 2026-09-10

Read-only verification after Production deployment:

- workspaces: **7**;
- membership rows: **8**;
- accounts: **546**;
- journal entries: **75**;
- journal lines: **171**;
- invoices: **35**;
- storage objects: **25**;
- Posted/Reversed Ledger debit: **4,081,615,836.9 Toman**;
- Posted/Reversed Ledger credit: **4,081,615,836.9 Toman**;
- unbalanced Posted/Reversed journals: **0**;
- orphan journal lines: **0**;
- authoritative invoice total mismatch: **0**;
- Posted/Reversed invoices without journal: **0**;
- settlement schedule total mismatch: **0**;
- orphan settlement schedules: **0**;
- orphan financial checks: **0**;
- unreconciled inventory companies: **0**;
- anon/authenticated-executable public `SECURITY DEFINER`: **0**.

Legacy note: 25 historical pre-Tax invoices still have `subtotal_amount IS NULL`; they are not current total mismatches and no destructive/backfill mutation was performed during release.

## Security / RLS / backup posture

- public financial access remains RLS-governed;
- no browser Service Role/private secret was introduced;
- Posted Ledger immutability/reversal lifecycle remains unchanged;
- Supabase built-in Leaked Password Protection remains unavailable under the current zero-charge/provider posture and is not falsely marked fixed;
- application session/password controls remain compensating controls;
- full external isolated disaster restore remains OPEN because no genuinely free isolated restore target is available;
- rollback for this release is a frontend/root rollback to the frozen branch/SHA above, not a destructive database rollback.

## Release conclusion

**RC1.5 — Production Released**

Next development cycle starts from Staging only. Production remains frozen except for governed hotfixes. Recommended RC1.6 direction: treasury/bank reconciliation, cash/check intelligence, advanced reconciliation, and managerial reporting/dashboard capabilities.
