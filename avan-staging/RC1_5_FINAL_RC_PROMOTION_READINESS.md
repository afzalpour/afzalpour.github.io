# AVAN RC1.5 — Final RC / Promotion Readiness Evidence

Status: **ENGINEERING FINAL GATE PASS / REMAINING LIVE ACCEPTANCE REQUIRED**  
Date: 2026-09-10  
Repository: `afzalpour/afzalpour.github.io`  
Production root: RC1.4, unchanged  
Final RC engineering merge: `57227aa3a321a172c5af2d6749ed1da059336106` (PR #96)  
PR Architecture Gate #130: **PASS**  
Post-merge main Architecture Gate #131: **PASS**  
Post-merge Pages #325: **PASS**

## 1. Release governance

ADR-0004 remains binding:

`Staging -> Engineering Gate -> explicit user Live Gate -> Promotion -> Production Smoke Gate`

This document does not declare the whole RC1.5 release Live PASS. Engineering evidence cannot replace explicit browser/PWA acceptance by the user.

## 2. User-accepted Live items already closed

The following are not to be re-opened unless a regression is observed:

- Settings no-layout-shift family from PR #91:
  - واحد پول
  - کاربران و دسترسی‌ها
  - متن زیر دسترسی پشتیبانی آوان
  - گزارش فعالیت
- e-Invoice prevalidation UI: user explicitly confirmed the prevalidation works in the exposed locations.
- Company Context auth hydration / multi-company entry after PR #94: user explicitly confirmed the refresh problem was resolved.
- Financial-analysis card layout after PR #95: user explicitly accepted the result and requested proceeding to the final release gates.
- Composite custom report had previously been user-accepted and remains governed by the safe predefined report matrix.

## 3. Final RC automated regression scope

`npm run quality` remains the release gate and includes:

- syntax validation, including `sw.js` and central Company Context;
- Operation Pipeline/lifecycle contracts;
- one-Rial canonical money precision;
- VAT calculation and Tax + Settlement integration;
- settlement exact-total domain validation;
- reconciliation intelligence;
- Settings stable-shell/no-layout-shift regression;
- zero-company/auth UX regression;
- **Company Context auth -> membership hydration behavioral regression** added by this Final RC gate because PR #94 had no durable executable test for that Live regression;
- custom report composite contract;
- e-Invoice prevalidation/provider-neutral boundary;
- full active-runtime release regression;
- final Web/PWA/iPhone and dashboard presentation regression;
- architecture audits / no new shared-client monkey-patching.

Final gate result:

- PR #96 Architecture Gate #130 = **PASS**.
- main Architecture Gate #131 = **PASS**.
- GitHub Pages #325 = **PASS**.

## 4. Read-only production-backend integrity snapshot — 2026-09-10

No financial mutation was performed by this gate.

Current counts:

- Companies/Workspaces: **7**
- workspace membership rows: **8**
- accounts: **546**
- journal entries: **64**
- journal lines: **144**
- invoices: **30**
- Storage objects: **25**

Accounting integrity:

- Posted/Reversed Ledger debit: **4,073,484,051.5 Toman**
- Posted/Reversed Ledger credit: **4,073,484,051.5 Toman**
- unbalanced Posted/Reversed journals: **0**
- orphan journal lines: **0**
- Posted/Reversed invoices without journal: **0**
- orphan settlement schedules: **0**
- orphan financial checks by invoice: **0**
- orphan financial checks by schedule: **0**
- settlement schedule total mismatches: **0**
- inventory reconciliation failures: **0 across 7 Companies**

Invoice integrity:

- authoritative `invoice_integrity(wid)` returned `total_mismatch = 0` and `posted_without_journal = 0` for **all 7 Companies**.
- a generic raw query found **25 legacy invoices** where `subtotal_amount IS NULL` while historical `total_amount` is populated. These are pre-Tax-bridge legacy rows and are intentionally not interpreted as a current VAT-total mismatch. No data backfill/mutation was performed during this gate.

Money schema:

- current invoice, journal, settlement and check monetary columns relevant to RC1.5 retain one-Rial-compatible `numeric(...,1)` boundaries where required.

## 5. RLS / privileged-function verification

Read-only verification on 2026-09-10:

- Public base tables without RLS: **0**
- public `SECURITY DEFINER` functions: **9** total internal/trigger/helper functions
- public `SECURITY DEFINER` executable by `authenticated`: **0**
- public `SECURITY DEFINER` executable by `anon`: **0**

A real `authenticated` PostgreSQL-role isolation rehearsal with a one-Company member returned:

- authorized Company visible: **1**
- unrelated Companies visible: **0**
- authorized Company accounts visible: **81**
- unrelated Company accounts visible: **0**

Supabase Security Advisor:

- `workspace_invitations` reports RLS enabled with no policy, but direct `anon`/`authenticated` table grants are **absent**; it remains closed to direct Data API access and is not a release security blocker.
- built-in **Leaked Password Protection remains disabled** under the current zero-charge/provider constraint. Application password/session guards remain compensating controls; this is a known limitation, not falsely marked fixed.

Supabase Performance Advisor findings (unindexed foreign keys, unused indexes, and `custom_reports` auth-initplan optimization) are recorded as **non-blocking performance debt**. No late database optimization is introduced into the release candidate solely to clear informational/performance lint.

## 6. Tax / e-Invoice state

Current read-only state:

- Tax-enabled Companies: **1**
- e-Invoice enabled Companies: **0**
- Tax-enabled settings missing seller tax identifier: **1**

This is not mutated by the Final RC gate. If e-Invoice submission is enabled in the future without seller identity completion, prevalidation must block readiness. RC1.5 does not transmit invoices externally.

## 7. Backup / restore posture

Governing runbook: `BACKUP_RESTORE_RUNBOOK.md`.

- Free Transactional Recovery Rehearsal: **PASS**
- Full external disaster restore into an isolated fresh target: **OPEN / NOT FULL PASS** under the current zero-charge constraint
- Never restore against `Avan-production` itself
- No paid Supabase branch/project is to be provisioned under current policy

Current release-point snapshot above supersedes the older row-count baseline only for this RC readiness evidence; the older runbook record remains historical evidence.

## 8. Production / rollback verification

Production root remains RC1.4:

- Production Service Worker marker: `avan-prod-rc1-4-v1`
- RC1.5 Staging Service Worker marker: `avan-staging-rc1-v90-financial-analysis-layout`
- existing rollback branch `prod-backup-20260907-rc1-4-pre` exists and resolves successfully

Before Production promotion, create a new branch from the exact final pre-promotion `main` commit:

`prod-backup-20260910-rc1-5-pre-promotion`

That branch is deliberately **not created before the remaining Live Gate**, because any Live-fix commit must be included in the exact pre-promotion recovery point.

The RC1.5 database foundations are already applied to the shared Supabase backend and current RC1.4 Production is operating against that schema. Therefore the planned release rollback is a **frontend/root rollback to the pre-promotion branch**, not a destructive database rollback.

## 9. Remaining explicit Live Gate

Only the remaining user-observable release paths must still be confirmed:

1. **One-Rial money** — `1515 Rial` saves without the obsolete divisibility error, amount-in-words is correct, and Toman display is `151.5` without reinterpretation.
2. **VAT -> final invoice -> Settlement** — reference case `151.5 + 15.2 = 166.7 Toman` reaches Settlement exactly.
3. **Invoice/Settlement modes** — sale/purchase plus credit, cash, check and at least installment/mixed; no zeroing or silent rounding.
4. **Reports/print** — active money unit appears in headings/print context and is not repeated after every numeric cell; receipt/payment/transfer detail follows the same contract.
5. **iPhone/mobile** — Vazirmatn/fallback, safe-area, keyboard/forms, toasts and landscape accounting tables remain usable.
6. **PWA offline shell** — after one online load, installed PWA reopens offline without white screen, MIME error or `Unexpected token <`.

The e-Invoice prevalidation Live item and Settings jump family are already closed by explicit user acceptance and should not be re-tested unless a regression is seen.

## 10. Promotion rule

When the user explicitly reports PASS for the six remaining Live items:

1. record full **RC1.5 Live PASS** in `AVAN_CURRENT_STATE.md`;
2. freeze the exact candidate SHA;
3. create/verify the new pre-promotion rollback branch;
4. promote the vetted `avan-staging/` runtime into Production root with a Production cache identity (not the staging cache identity);
5. run Production CI/Pages;
6. execute the Production Smoke Gate;
7. only then mark **RC1.5 — Production Released**.
