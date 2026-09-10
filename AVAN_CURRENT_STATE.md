# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-10 — RC1.5 = Production Released.**

این فایل Source of Truth وضعیت جاری پروژه است. Engineering/Backend PASS جایگزین Live PASS نیست؛ Live فقط با تأیید صریح کاربر ثبت می‌شود.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / next release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- zero-charge policy remains binding.
- Web/PWA is the active release target; Windows/Desktop/true offline remains deferred.

### Production

- **RC1.5 = current Production release**.
- Production promotion PR: **#103 — Release RC1.5 to Production**.
- Production merge commit: `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- Production URL: `https://afzalpour.github.io/`.
- Production Service Worker cache: `avan-prod-rc1-5-v1`.
- Production Release Gate #1 on PR #103 = PASS.
- post-merge Production Release Gate #2 = PASS.
- GitHub Pages #332 = PASS.
- external Production HTTP Smoke #1 = PASS.
- formal release record: `PRODUCTION_RELEASE_RC1_5.md`.

### Rollback

- RC1.5 pre-promotion rollback branch: `prod-backup-20260910-rc1-5-pre-promotion`.
- rollback freeze SHA: `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`.
- historical RC1.4 rollback branch remains: `prod-backup-20260907-rc1-4-pre`.
- RC1.5 rollback is frontend/root rollback; do not perform destructive DB rollback.

---

## 2) Explicit Live acceptance

The user explicitly reported:

**«شش مورد پاس شد — RC1.5 Live PASS»**

This accepted the remaining RC1.5 Live gate covering:

1. one-Rial money;
2. VAT → final invoice → Settlement exactness;
3. sale/purchase and settlement modes;
4. reports/print money-unit contract;
5. iPhone/mobile usability;
6. PWA offline shell.

Earlier granular Live acceptances remain valid:

- Settings no-layout-shift;
- e-Invoice prevalidation/discoverability;
- Company Context post-auth hydration/company entry without manual refresh;
- Dashboard Risk presentation;
- Dashboard Financial Analysis title-above/value-below presentation.

---

## 3) Final RC1.5 fixes included in Production

### Invoice save latency

Normal sale/purchase invoice save no longer performs a full-page Auth/bootstrap reload. Before Production promotion the save path was further optimized:

- repeated Auth `/user` round-trips reduced;
- token refresh made single-flight;
- Company Context avoids redundant authenticated refresh when authoritative;
- redundant Settlement invoice-total readback removed while Backend exact-total validation remains authoritative;
- post-save refresh uses an RLS-governed authoritative snapshot instead of many independent reads.

Observed Backend execution times showed accounting RPCs themselves were in the low hundreds of milliseconds or less; the previous multi-second delay was primarily Frontend/Auth orchestration.

### Settlement presentation

All settlement modes — اعتباری / نقدی / چکی / اقساطی / ترکیبی — retain exact canonical money and now present:

- three-digit grouping;
- Persian amount-in-words;
- one-Rial precision.

### PWA integrity

Before Production, stale precache references to retired files were removed:

- `src/ui/money/live-money-inputs.js`;
- `src/documents/document-viewer-v2.js`.

A permanent regression guard now verifies every declared Staging precache asset exists.

---

## 4) Governing invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role/private secrets.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1 Toman = 1 Rial** under ADR-0019.
- `1515 Rial` persists losslessly as `151.5 Toman`; the old divisible-by-10 rule is obsolete.
- sub-Rial values are rejected rather than silently rounded.
- browser Local/Session storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- Persian-first / RTL.
- no new shared-client monkey patching; named Operation Pipeline / central Lifecycle are extension boundaries.
- AI/automation remains Human-controlled and explainable.

---

## 5) Production integrity baseline — 2026-09-10

Read-only verification after RC1.5 Production deployment:

- workspaces: 7;
- membership rows: 8;
- accounts: 546;
- journal entries: 75;
- journal lines: 171;
- invoices: 35;
- storage objects: 25;
- Posted/Reversed Ledger debit = **4,081,615,836.9 Toman**;
- Posted/Reversed Ledger credit = **4,081,615,836.9 Toman**;
- unbalanced Posted/Reversed journals = 0;
- orphan journal lines = 0;
- authoritative invoice total mismatch = 0;
- Posted/Reversed invoices without journal = 0;
- settlement schedule total mismatch = 0;
- orphan settlement schedules = 0;
- orphan financial checks = 0;
- unreconciled inventory companies = 0;
- anon/authenticated-executable public `SECURITY DEFINER` = 0.

Legacy note: 25 historical pre-Tax invoices have `subtotal_amount IS NULL`; they are not current integrity mismatches and no backfill/destructive mutation was performed during release.

---

## 6) Security / RLS / backup state

- public financial access remains RLS-governed.
- authenticated-executable public `SECURITY DEFINER` = 0.
- anon-executable public `SECURITY DEFINER` = 0.
- prior real authenticated one-Company rehearsal showed authorized Company/accounts visible and unrelated Companies/accounts hidden.
- Session guard: 60-minute inactivity + 12-hour max + clock-skew protection.
- password guard: minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under the current zero-charge/provider posture; application controls remain compensating controls and provider protection must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- full external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.

---

## 7) Money / Tax / Settlement

Money:

- canonical Toman with one-Rial precision;
- amount-in-words supported;
- display-unit switching never rewrites canonical history.

VAT:

- versioned/date-effective rules with deterministic line snapshots;
- Sale VAT → output VAT payable;
- Purchase VAT → input VAT receivable;
- reversal preserves original accounting effect in reverse.

Settlement:

- اعتباری / نقدی / چکی / اقساطی / ترکیبی;
- exact schedule sum must equal persisted final invoice total;
- locked reference: `151.5 + 15.2 = 166.7 Toman`;
- installment reference: `55.6 + 55.6 + 55.5 = 166.7`; `166.6` mismatch rejected.

---

## 8) UX / Reports / Dashboard / Settings

- report/print monetary headings carry the active money unit without repeating the unit after every numeric cell.
- receipt/payment/transfer detail follows the same unit contract.
- Risk and Financial Analysis dashboard cards use title-above/value-below with overflow protection.
- Settings single layout owner: `src/ui/settings/settings-layout-v2.js`.
- deterministic Settings order: `Account/Money → Tax → Users/Access → Support → Activity → Company Profile`.
- zero-company onboarding is explicit.
- Company Context authoritative post-auth hydration prevents stale pre-login empty membership state.
- company selection avoids parallel focus/open refresh loops.

---

## 9) e-Invoice boundary

RC1.5 is provider-neutral prevalidation only. No external invoice submission is enabled and no provider credential exists in browser runtime. Missing seller tax identity remains a future readiness blocker when submission is introduced.

---

## 10) Quality / release evidence

Key final evidence:

- PR #101 invoice save latency optimization = merged; Architecture Gate #144 PASS; main #145 PASS; Pages #330 PASS.
- PR #102 PWA precache integrity = merged `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`; PR Gate #148 PASS; main #149 PASS; Pages #331 PASS.
- RC1.5 Production Promotion Builder v2 = PASS.
- PR #103 Production Release Gate #1 = PASS.
- Production merge commit = `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- post-merge Production Release Gate #2 = PASS.
- Pages #332 = PASS.
- external Production HTTP Smoke #1 = PASS.
- post-deploy DB integrity = PASS.

**RC1.5 Final Engineering Gate = PASS.**  
**RC1.5 Full Live Gate = PASS by explicit user report.**  
**RC1.5 Production Release = PASS.**

---

## 11) Next cycle

Production RC1.5 is frozen except for governed hotfixes. New feature work returns to `avan-staging/` first.

Recommended RC1.6 direction:

**Treasury / Bank Reconciliation → cash & cheque intelligence → advanced reconciliation → managerial dashboards/reporting.**

Desktop/true-offline remains deferred until a real local persistence/synchronization architecture exists.
