# AVAN RC1.5 — Final RC / Promotion Readiness Evidence

Status: **ENGINEERING PASS + EXPLICIT USER LIVE PASS / READY FOR FREEZE AND PRODUCTION PROMOTION**  
Date: 2026-09-10  
Repository: `afzalpour/afzalpour.github.io`  
Production root before promotion: RC1.4  
Latest Staging runtime merge before freeze: `7ff0ce15c2cd2fc767539ce09917d56744b35efe` (PR #99)  
Latest Staging cache: `avan-staging-rc1-v92-final-live-polish`

## 1. Governance

ADR-0004 remains binding:

`Staging -> Engineering Gate -> explicit user Live Gate -> Freeze/Backup -> Promotion -> Production Smoke Gate`

The user explicitly reported **«شش مورد پاس شد — RC1.5 Live PASS»** on 2026-09-10. The accumulated RC1.5 Live Gate is therefore closed as PASS.

Immediately after that acceptance the user requested two final polish items and explicitly instructed proceeding to the next release step after implementation. PR #99 implements those items with Engineering PASS; Production Smoke must explicitly verify them rather than retroactively claiming a separate manual Live PASS.

## 2. User-accepted Live scope

Accepted items include:

- Settings no-layout-shift family: واحد پول، کاربران و دسترسی‌ها، Support copy، Activity report;
- e-Invoice prevalidation exposed locations;
- Company Context auth hydration / no manual refresh;
- Dashboard Risk and Financial Analysis presentation;
- previously accepted safe composite report;
- final six-item release gate:
  1. one-Rial money;
  2. VAT → final invoice → Settlement;
  3. sale/purchase and settlement modes;
  4. reports/print money-unit contract;
  5. iPhone/mobile usability;
  6. PWA offline shell.

## 3. Final post-Live polish — PR #99

User-reported issues:

1. normal sale/purchase save took about 40 seconds, flashed the login shell because of `location.reload()`, and returned to Dashboard instead of invoices;
2. Settlement condition amounts lacked grouping and Persian amount-in-words.

Implementation:

- removed the second normal-invoice capture-submit owner from `rc14-invoice-live-refinements.js`;
- normal invoice save returns to the app-owned `closeModal() -> reloadAndRender()` path, preserving the authenticated shell/current invoices page;
- added named `invoice.base-save-display-money` operation at priority 125 so raw display money reaches the accepted canonical money operation at priority 150 without one-Rial reinterpretation;
- inventory/tax/settlement enrichment remains in named RPC operations; Settlement persistence remains downstream at priority 300;
- added `settlement-money-presentation.js` for three-digit grouping and Persian words on fixed credit/cash/check amounts and editable installment/mixed amounts;
- hidden canonical Settlement values and exact-total validation remain unchanged;
- no DB migration.

Evidence:

- PR #99 initial #136 failed only because the prior optional-item test hard-coded cache `v91`;
- the cache guard was corrected to a versioned-release contract;
- PR #99 #137 = PASS;
- post-merge main #138 = PASS;
- Pages #328 = PASS;
- Staging cache = `avan-staging-rc1-v92-final-live-polish`.

## 4. Accounting / backend integrity snapshot

Final RC read-only baseline remains:

- Companies/Workspaces: 7;
- memberships: 8;
- accounts: 546;
- journal entries: 64;
- journal lines: 144;
- invoices at snapshot: 30;
- Storage objects: 25;
- Posted/Reversed Ledger debit = credit = **4,073,484,051.5 Toman**;
- unbalanced Posted/Reversed journals = 0;
- orphan journal lines = 0;
- authoritative invoice total mismatch = 0 across all Companies;
- Posted/Reversed invoices without journal = 0;
- settlement total mismatch = 0;
- orphan settlement/check rows = 0;
- inventory reconciliation failures = 0 across all 7 Companies.

The 25 historical rows with `subtotal_amount IS NULL` remain legacy pre-Tax invoices; no backfill/reinterpretation was performed.

## 5. RLS / security verification

- public base tables without RLS = 0;
- authenticated-executable public `SECURITY DEFINER` = 0;
- anon-executable public `SECURITY DEFINER` = 0;
- authenticated single-Company rehearsal: authorized Company 1 / unrelated 0; authorized accounts 81 / unrelated 0;
- `workspace_invitations` has no direct anon/authenticated grants;
- Supabase built-in Leaked Password Protection remains unavailable/disabled under the current zero-charge/provider posture; application controls remain compensating safeguards;
- Performance Advisor findings remain non-blocking debt and are not mixed into release promotion.

## 6. Backup / restore posture

Governing runbook: `BACKUP_RESTORE_RUNBOOK.md`.

- Free Transactional Recovery Rehearsal = PASS.
- Full external disaster restore into a separate fresh target = OPEN / NOT FULL PASS under the zero-charge constraint.
- Never restore against `Avan-production` itself.
- RC1.5 DB foundations already exist on the shared backend and RC1.4 Production has been operating against that schema; release rollback is a frontend/root rollback, not destructive DB rollback.

Historical rollback branch:

`prod-backup-20260907-rc1-4-pre`

Immediately after the final Source-of-Truth freeze commit and before any Production root mutation, create:

`prod-backup-20260910-rc1-5-pre-promotion`

from the exact frozen `main` SHA.

## 7. Promotion rule

The release is now authorized to move through the remaining governed sequence:

1. freeze exact candidate SHA;
2. create/verify exact pre-promotion backup branch;
3. promote vetted `avan-staging/` runtime into root;
4. change Service Worker identity from Staging cache to an RC1.5 Production-specific cache;
5. run Production CI/Pages;
6. Production Smoke must include login/company entry, normal sale/purchase save without login flash/full reload, direct return to invoices, Settlement grouping + Persian words for all plan types, one-Rial/VAT/Settlement sanity, report/print, and PWA/mobile sanity;
7. only then mark **RC1.5 — Production Released**.
