# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-10 — RC1.5 = EXPLICIT USER LIVE PASS; final post-Live polish PR #99 engineering PASS; Production promotion is the next governed step.**

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

- **RC1.4 = current Production release** until RC1.5 promotion completes.
- Production runtime commit before RC1.5 promotion: `81b5c54643267842a8f225ee09668ade2fc95052`.
- Production SW before promotion: `avan-prod-rc1-4-v1`.
- existing historical rollback branch: `prod-backup-20260907-rc1-4-pre`.

### RC1.5 Staging

- RC1.5-A Tax foundation = BACKEND PASS.
- RC1.5-B VAT / invoice accounting bridge = BACKEND PASS.
- AC-1 frontend architecture consolidation = ENGINEERING PASS.
- ADR-0019 one-Rial money precision = ENGINEERING PASS + Live accepted in final six-item gate.
- RC1.5-D provider-neutral e-Invoice prevalidation = ENGINEERING PASS + explicit feature Live acceptance.
- Tax + Settlement exact-precision integration = ENGINEERING PASS + Live accepted.
- Settings stable-shell/no-layout-shift = ENGINEERING PASS + explicit Live acceptance.
- Company Context post-auth hydration / multi-company entry = ENGINEERING PASS + explicit Live acceptance.
- Dashboard Risk and Financial Analysis presentation = accepted.
- optional registered-item invoice flow = PR #98 engineering PASS.
- final invoice-save / settlement-money polish = PR #99 engineering PASS.
- latest Staging SW cache = `avan-staging-rc1-v92-final-live-polish`.

### Latest release evidence

- PR #96 Final RC engineering gate: merge `57227aa3a321a172c5af2d6749ed1da059336106`; PR #130 PASS / main #131 PASS / Pages #325 PASS.
- PR #97 Source-of-Truth evidence sync: main #133 PASS / Pages #326 PASS.
- PR #98 invoice registered-item optional fix: merge `fc2d8957ba834e1ab4c46c6dbf92112f220f71e3`; PR #134 PASS / main #135 PASS / Pages #327 PASS.
- PR #99 final Live polish: merge `7ff0ce15c2cd2fc767539ce09917d56744b35efe`; PR #137 PASS / main #138 PASS / Pages #328 PASS. PR #136 failed only because an older test hard-coded cache v91; the guard was corrected to a version-tolerant release contract before PASS #137.

---

## 2) Explicit Live acceptance history

Previously accepted gates remain valid, including B-4/B-4.1, RC1 + two-user RLS, RC1.1/1.2/1.3, RC1.3 Production Smoke and RC1.4 inventory/invoice/settlement behavior.

### 2026-09-10 — Settings no-layout-shift

User explicitly confirmed correct behavior for:

- واحد پول;
- کاربران و دسترسی‌ها;
- متن زیر «دسترسی پشتیبانی آوان»;
- گزارش فعالیت.

### 2026-09-10 — e-Invoice prevalidation

User explicitly confirmed «پیش‌اعتبارسنجی صورتحساب الکترونیکی» works correctly in all exposed locations discussed. RC1.5 remains prevalidation-only; no external transmission is enabled.

### 2026-09-10 — Company entry/auth hydration

After PR #94, user explicitly confirmed manual refresh is no longer required after authentication/company hydration.

### 2026-09-10 — Dashboard presentation

User accepted the Risk presentation and later explicitly accepted the Financial Analysis layout following the same title-above/value-below contract.

### 2026-09-10 — Full RC1.5 Live Gate

The user explicitly reported:

**«شش مورد پاس شد — RC1.5 Live PASS»**

This acceptance covers the six previously remaining release checks:

1. one-Rial money;
2. VAT → final invoice → Settlement;
3. sale/purchase and settlement modes;
4. reports/print money-unit contract;
5. iPhone/mobile usability;
6. PWA offline shell.

Therefore **the accumulated RC1.5 Live Gate is PASS**.

Immediately after that acceptance, the user requested two final presentation/performance polishes and explicitly instructed proceeding to the next release step after implementing them:

- normal sale/purchase invoice save must not perform a full-page Auth/bootstrap reload and should return directly to the invoice page;
- all «شرایط تسویه» amount fields should have three-digit grouping and Persian amount-in-words.

PR #99 implements both with Engineering PASS. These two post-Live changes are not retroactively labelled as a separate manual Live PASS; they must be included in Production Smoke verification.

---

## 3) Governing architecture / invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role / private secrets.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1 Toman = 1 Rial** under ADR-0019.
- `1515 Rial` persists losslessly as `151.5 Toman`; the old divisible-by-10 rule is obsolete.
- sub-Rial values are rejected rather than silently rounded.
- browser Local/Session storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- Persian-first / RTL.
- no new shared-client monkey patching; named Operation Pipeline / central Lifecycle are extension boundaries.
- AI/automation is Human-controlled and explainable.

---

## 4) Accounting / backend integrity baseline — 2026-09-10

Final RC read-only checks performed no financial mutation.

- Companies/Workspaces: 7.
- membership rows: 8.
- accounts: 546.
- journal entries: 64.
- journal lines: 144.
- invoices at Final RC snapshot: 30.
- Storage objects: 25.
- Posted/Reversed Ledger debit = **4,073,484,051.5 Toman**.
- Posted/Reversed Ledger credit = **4,073,484,051.5 Toman**.
- unbalanced Posted/Reversed journals = 0.
- orphan journal lines = 0.
- authoritative `invoice_integrity(wid)` total_mismatch = 0 and posted_without_journal = 0 for all 7 Companies.
- settlement schedule total mismatch = 0.
- orphan settlement schedules/checks = 0.
- inventory reconciliation failures = 0 across all 7 Companies.
- relevant monetary DB boundaries remain one-Rial-compatible `numeric(...,1)` where required.

Legacy note: 25 historical pre-Tax invoices have `subtotal_amount IS NULL`; authoritative integrity reports no current mismatch and no backfill was performed.

---

## 5) RLS / security state

Final RC read-only verification:

- public base tables without RLS = 0.
- authenticated-executable public `SECURITY DEFINER` = 0.
- anon-executable public `SECURITY DEFINER` = 0.
- real authenticated one-Company rehearsal: authorized Company = 1, unrelated Companies = 0; authorized accounts = 81, unrelated accounts = 0.
- `workspace_invitations` has no direct anon/authenticated grants; Security Advisor policy warning is not an exposed Data API path.
- built-in Supabase Leaked Password Protection remains disabled/unavailable under the current zero-charge/provider posture; application password/session controls are compensating controls. Do not mark provider protection fixed.
- Performance Advisor findings remain non-blocking performance debt and were not mixed into the frozen RC as late DB changes.

Session guard remains 60-minute inactivity + 12-hour max browser session + clock-skew protection. Password guard remains minimum 12 chars + letter + number + symbol + local common-password denylist for signup/recovery.

---

## 6) Money / VAT / Settlement contract

Money:

- canonical Toman with one-Rial precision.
- amount-in-words under invoice money inputs.
- display unit switching never rewrites canonical history.

VAT:

- versioned/date-effective rules and deterministic line snapshots.
- Sale VAT → output VAT payable; Purchase VAT → input VAT receivable.
- reversal reverses VAT with original accounting effect.

Settlement:

- اعتباری / نقدی / چکی / اقساطی / ترکیبی.
- exact schedule sum must equal persisted final invoice total.
- locked reference: `151.5 + 15.2 = 166.7 Toman`.
- installment: `55.6 + 55.6 + 55.5 = 166.7`; `166.6` mismatch rejected.
- post-Live PR #99 adds three-digit grouping + Persian words to fixed and editable settlement amount presentations without changing hidden canonical values or exact-total validation.

---

## 7) Invoice save ownership after PR #99

Normal sale/purchase invoice submission has a single effective owner: base `app.js` form submit path.

- the old RC1.4 capture-submit owner no longer calls `location.reload()` for normal invoices;
- app-owned `closeModal() → reloadAndRender()` refreshes data in-app while preserving the authenticated shell and current `invoices` page;
- `invoice.base-save-display-money` operation (priority 125) restores raw display values before the accepted `money.invoice-canonical-payload` operation (priority 150);
- inventory/tax/settlement metadata continues through named RPC operations; settlement remains downstream at priority 300;
- no DB migration was introduced by this polish.

High-precision inventory-quantity compatibility remains owned by the pre-existing inventory bridge; this Final RC polish targets the normal sale/purchase save path that produced the reported login flash/long full reload.

---

## 8) Reports / print / dashboard / Settings

- report/print monetary headings carry the active money unit without repeating unit text after every cell.
- receipt/payment/transfer detail follows the same contract.
- Risk and Financial Analysis dashboard cards use title-above/value-below with overflow protection.
- Settings single layout owner: `src/ui/settings/settings-layout-v2.js`.
- deterministic order: `Account/Money → Tax → Users/Access → Support → Activity → Company Profile`.
- Settings no-layout-shift behavior is explicitly Live accepted.

---

## 9) e-Invoice boundary

RC1.5 is provider-neutral prevalidation only. No invoice submission is enabled and no provider credential is present in browser runtime. Missing seller tax identity remains a future readiness blocker when submission is introduced.

---

## 10) Web/PWA / Company UX

- Vazirmatn + Apple/system fallback.
- `100dvh`, safe-area-aware mobile behavior, orientation `any`.
- navigation-only Service Worker HTML fallback.
- latest Staging cache: `avan-staging-rc1-v92-final-live-polish`.
- login password visibility toggle present.
- zero-company onboarding explicit.
- Company Context authoritative post-auth refresh prevents stale pre-login empty membership state.
- company selection avoids parallel focus/open refresh loops.
- `company-context-auth-sync.spec.mjs` permanently covers auth→multi-company hydration.

---

## 11) Backup / Restore / rollback

Runbook: `avan-staging/BACKUP_RESTORE_RUNBOOK.md`.

- Free Transactional Recovery Rehearsal = PASS.
- full external disaster restore into an isolated fresh target = OPEN / NOT FULL PASS because no genuinely free isolated restore target is available.
- never restore against `Avan-production` itself.
- RC1.5 DB foundations are already present on the shared backend and current RC1.4 Production already operates against that schema; rollback for this release is therefore frontend/root rollback, not destructive DB rollback.
- historical branch `prod-backup-20260907-rc1-4-pre` remains available.
- immediately before Production promotion, create `prod-backup-20260910-rc1-5-pre-promotion` from the exact frozen pre-promotion `main` SHA.

---

## 12) Automated quality gate

`npm run quality` covers syntax, Operation Pipeline/Lifecycle, one-Rial money, VAT/Settlement integration, inventory/reconciliation, Settings stable shells, auth/company hydration, reports, e-Invoice, Web/PWA/iPhone regressions and architecture audits.

Latest evidence:

- PR #98 #134 PASS / main #135 PASS / Pages #327 PASS.
- PR #99 first run #136 failed only on an obsolete hard-coded `v91` cache assertion.
- PR #99 corrected run #137 = PASS.
- post-merge main #138 = PASS.
- Pages #328 = PASS.
- direct shared-client overwrites remain 0 under architecture audit.

**RC1.5 Final Engineering Gate = PASS.**  
**RC1.5 Full Live Gate = PASS by explicit user report.**

---

## 13) Next operating step — Freeze → Promotion → Production Smoke

The user explicitly instructed proceeding after the final two polish items were implemented.

Next sequence:

1. merge this Source-of-Truth freeze record;
2. freeze the resulting exact `main` SHA;
3. create/verify `prod-backup-20260910-rc1-5-pre-promotion` from that exact SHA;
4. promote the vetted `avan-staging/` runtime into Production root with a **Production-specific SW cache identity**;
5. run Production CI/Pages;
6. execute Production Smoke, explicitly including:
   - login/company entry;
   - normal sale/purchase save returns directly to invoices with no login flash/full reload;
   - Settlement grouped amounts + Persian words for credit/cash/check/installment/mixed;
   - one-Rial/VAT/Settlement sanity;
   - reports/print;
   - PWA/mobile sanity;
7. only after Production Smoke PASS mark **RC1.5 — Production Released**.

---

## 14) Deferred roadmap

After RC1.5 Production release: treasury/bank reconciliation, cash/check intelligence, advanced reconciliation, managerial dashboards/reporting, then later desktop/true-offline only with a real local persistence/synchronization architecture.
