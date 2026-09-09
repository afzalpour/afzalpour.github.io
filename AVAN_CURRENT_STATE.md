# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-10 — RC1.5 Final RC Engineering Gate = PASS via PR #96 / PR Actions #130 / main Actions #131 / Pages #325. Full RC1.5 Live acceptance is still pending on six remaining user-observable items.**

این فایل Source of Truth وضعیت جاری پروژه است. **Engineering/Backend PASS جایگزین Live PASS نیست** و Live فقط با تأیید صریح کاربر ثبت می‌شود.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / next release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- zero-charge policy remains binding.
- Web/PWA is the active release target; Windows/Desktop/true offline remains deferred.

### Production

- **RC1.4 = Production Released**.
- Production runtime commit: `81b5c54643267842a8f225ee09668ade2fc95052`.
- Production Pages run: `34141884953` = success.
- Production SW cache: `avan-prod-rc1-4-v1`.
- existing rollback branch: `prod-backup-20260907-rc1-4-pre`.
- Production root runtime has **not** been promoted to RC1.5.

### RC1.5 Staging engineering state

- RC1.5-A — Versioned Tax Data Foundation = **BACKEND PASS**.
- RC1.5-B — VAT Calculation & Invoice Accounting Bridge = **BACKEND PASS**.
- AC-1 — Frontend Architecture Consolidation = **ENGINEERING PASS**.
- RC1.5-C — Tax UX & VAT Reports = **BACKEND PASS / FRONTEND ENGINEERING PASS / broader LIVE PENDING**.
- ADR-0019 one-Rial money precision + report/settlement fixes = **ENGINEERING PASS**.
- RC1.5-D e-Invoice pre-validation / provider-neutral adapter = **ENGINEERING PASS + explicit feature Live acceptance**.
- Integrated Tax + Settlement precision = **ENGINEERING PASS**.
- Full active-runtime regression = **ENGINEERING PASS**.
- Final Web/PWA + iPhone hardening = **ENGINEERING PASS / broader Live pending**.
- Settings no-layout-shift root fix = **ENGINEERING PASS + EXPLICIT USER LIVE PASS** via PR #91.
- Company Context / multi-company entry regressions fixed through PR #93 and PR #94; PR #94 merge commit `328c868e3468f769b2ad93f9ea7ed8900a8f2890`; user explicitly confirmed the refresh problem resolved.
- Dashboard Risk presentation was hardened in PR #92.
- Financial-analysis cards were aligned to the accepted Risk presentation pattern in PR #95; merge commit `07b21cd94b7f9f3309460c9855c5546213667488`; user explicitly accepted the result.
- latest Staging SW cache: `avan-staging-rc1-v90-financial-analysis-layout`.

### Final RC engineering gate — PASS

PR #96: **RC1.5: Final RC engineering and promotion-readiness gate**

- PR #96 merge commit: `57227aa3a321a172c5af2d6749ed1da059336106`.
- PR Architecture Gate #130 = **PASS**.
- post-merge main Architecture Gate #131 = **PASS**.
- GitHub Pages #325 = **PASS**.
- Production root remained RC1.4 and unchanged.

The Final RC gate:

- added executable `company-context-auth-sync.spec.mjs` behavioral regression to `npm run quality`;
- aligned `AVAN_MASTER_PROMPT.md` money contract with Accepted ADR-0019 so the obsolete `integer Toman / Rial divisible by 10` rule cannot be reintroduced from the highest-priority source-of-truth file;
- recorded the current backend/RLS/security/recovery baseline;
- created `avan-staging/RC1_5_FINAL_RC_PROMOTION_READINESS.md`;
- verified the existing rollback branch and defined the exact pre-promotion rollback procedure.

The **whole RC1.5 Live Gate is not yet PASS**. Six remaining explicit Live items are listed in section 15.

---

## 2) Explicit Live acceptance history

Previously accepted gates remain valid, including B-4/B-4.1, RC1 + two-user RLS, RC1.1/1.2/1.3, RC1.3 Production Smoke and RC1.4 inventory/invoice/settlement behavior.

### 2026-09-10 — Settings no-layout-shift

User explicitly confirmed correct deployed behavior for:

- **واحد پول** — no visible jump/regression.
- **کاربران و دسترسی‌ها** — no visible jump/regression.
- **متن زیر «دسترسی پشتیبانی آوان»** — stable.
- **گزارش فعالیت** — stable.

### 2026-09-10 — e-Invoice prevalidation

User explicitly confirmed **«پیش‌اعتبارسنجی صورتحساب الکترونیکی»** works correctly in all exposed locations discussed. RC1.5 remains prevalidation-only; this acceptance does not enable transmission.

### 2026-09-10 — Company entry/auth hydration

After PR #94, user explicitly confirmed the Company Context refresh problem is resolved. A multi-company user must hydrate authoritative memberships immediately after authentication without manual browser refresh.

### 2026-09-10 — Financial analysis presentation

After PR #95, user explicitly accepted the dashboard **تحلیل مالی** card layout and requested proceeding to the five final release actions.

### Previously accepted custom report

The safe composite custom-report/event-matrix behavior was previously user-accepted and remains closed unless a regression is observed.

**The entire accumulated RC1.5 release is NOT yet declared Live PASS.** Remaining Live focus is listed in section 15.

---

## 3) Governing architecture / invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role / secret/private keys.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Avan is Multi-tenant / Multi-company SaaS.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1-Toman precision = 1 Rial** under ADR-0019.
- `1515 Rial` must persist losslessly as `151.5 Toman`; the obsolete divisibility-by-10 requirement is not active.
- sub-Rial values are rejected rather than silently rounded.
- Ledger must remain balanced; orphan journal lines must remain zero.
- browser Local/Session storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- user-visible UI/errors are Persian-first except unavoidable standards such as PDF/CSV/SKU.
- Frontend migration follows Strangler Pattern; no full rewrite.
- no new shared-client monkey patching; Operation Pipeline / central lifecycle composition are the extension boundaries.
- AI/automation remains Human-controlled and explainable.

---

## 4) Latest accounting / security integrity baseline — 2026-09-10

Read-only snapshot; the Final RC gate performed **no financial mutation**.

Current data counts:

- Companies/Workspaces: **7**.
- Workspace membership rows: **8**.
- Accounts: **546**.
- Journal entries: **64**.
- Journal lines: **144**.
- Invoices: **30**.
- Storage objects: **25**.

Accounting integrity:

- Posted/Reversed Ledger debit = **4,073,484,051.5 Toman**.
- Posted/Reversed Ledger credit = **4,073,484,051.5 Toman**.
- unbalanced Posted/Reversed journals = **0**.
- orphan journal lines = **0**.
- authoritative `invoice_integrity(wid)` returned `total_mismatch=0` and `posted_without_journal=0` for **all 7 Companies**.
- Posted/Reversed invoices without journal = **0**.
- settlement schedule total mismatches = **0**.
- orphan settlement schedules = **0**.
- orphan financial checks by invoice/schedule = **0**.
- inventory reconciliation failures = **0 across all 7 Companies**.
- relevant invoice/journal/settlement/check monetary columns remain one-Rial-compatible `numeric(...,1)` where required.

Legacy invoice note:

- a raw generic comparison finds **25 historical invoices with `subtotal_amount IS NULL`** and populated historical `total_amount`.
- these are legacy pre-Tax-bridge rows and are not current VAT-total mismatches; the authoritative integrity function reports zero mismatch in every Company.
- the Final RC gate does not backfill or reinterpret historical financial rows.

Tax state:

- Tax-enabled Company/settings = **1**.
- e-Invoice-enabled Company/settings = **0**.
- the Tax-enabled setting currently has no seller tax identifier = **1**.
- this is intentionally not mutated; future e-Invoice submission readiness must remain blocked until seller identity is complete.

---

## 5) Multi-company / RLS / privileged-function boundary

Accepted architecture:

- central `CompanyContext` + explicit active Company.
- Company Portfolio (`شرکت‌های من`).
- no hidden first-workspace tenant selection.
- CompanyBoundary over legacy reads.
- Company creation/lifecycle/member limits enforced at authoritative boundaries.
- Platform Admin remains separate from Company Ledger authority.
- Support access remains Company-bound, reason-required, time-limited and read-only.

Final RC read-only verification:

- Public base tables without RLS = **0**.
- public SECURITY DEFINER functions = **9** total internal/helper/trigger functions.
- authenticated-executable public SECURITY DEFINER = **0**.
- anon-executable public SECURITY DEFINER = **0**.
- real `authenticated` role RLS rehearsal for a one-Company member:
  - authorized Company visible = **1**.
  - unrelated Companies visible = **0**.
  - authorized Company accounts visible = **81**.
  - unrelated Company accounts visible = **0**.

Supabase Security Advisor:

- `workspace_invitations`: RLS enabled/no policy, but no direct `anon`/`authenticated` table grants; direct Data API access remains closed.
- built-in Leaked Password Protection = **disabled** under the current provider/zero-charge path; application password/session guards remain compensating controls. Do not mark provider protection fixed.

Performance Advisor findings (unindexed foreign keys, unused indexes and `custom_reports` auth-initplan optimization) are **non-blocking performance debt** and are not being mixed into the frozen release candidate as late database changes.

---

## 6) Accounts / Journal / Invoice / Inventory baseline

Accounts:

- hierarchy: `کل → معین → تفصیلی ۱ → تفصیلی ۲`.
- only leaves are postable.
- DB-authoritative account coding and standard Company chart remain governing.

Journal/Invoice:

- Draft → Posted → Reversed.
- Posted immutability + reversal integrity are mandatory.
- sale item invoice bridges to Inventory issue + COGS.
- purchase invoice can bind to posted receipt lines without duplicate stock receipt.
- invoice final totals include VAT when Tax is enabled.

Inventory:

- Movement Ledger is quantity/value Source of Truth.
- posted movements are immutable; correction uses reversal.
- moving weighted-average costing.
- all **7 Companies** pass the current reconciliation view.

---

## 7) RC1.5 money / VAT / Settlement contract

Money:

- invoice price, discount, line totals, invoice totals and journal values support one-Rial precision.
- invoice UI uses exact decimal-safe one-tenth-Toman calculation boundaries.
- amount-in-words is projected under monetary invoice inputs.
- Rial/Toman display switching never rewrites Canonical history.

VAT:

- versioned date-effective rules.
- deterministic line snapshots.
- Sale VAT → output VAT payable; Purchase VAT → input VAT receivable.
- reversal reverses VAT with the original journal.

Settlement:

- supported: اعتباری / نقدی / چکی / اقساطی / ترکیبی.
- schedule total must equal final invoice total exactly.
- `src/domains/settlement/settlement-plan-contract.js` owns canonical exact validation.
- locked regression: `151.5 Toman + 15.2 VAT = 166.7 Toman` final.
- installment regression `55.6 + 55.6 + 55.5 = 166.7` passes; `166.6` mismatch is rejected.
- sub-Rial amounts are rejected rather than rounded.
- legacy v61 fallback may remain as compatibility source but is inert because the modern operation owner registers first; direct shared-client overwrites remain 0.

---

## 8) Reports / print / dashboard UX

- monetary inputs use three-digit grouping where applicable.
- invoice monetary fields expose Persian amount-in-words.
- reports/tables/print surfaces carry the active money unit in monetary headings.
- prepared report cells do not repeat `تومان/ریال` after every number.
- receipt/payment/transfer detail views follow heading-only unit presentation.
- custom reporting includes the safe predefined `composite_events` event-matrix plus individual source catalogs; it is not arbitrary user SQL.
- Dashboard `کنترل و ریسک` cards use title-above/value-below presentation with overflow protection.
- Dashboard `تحلیل مالی` cards use the same presentation contract after PR #95.

---

## 9) Settings rendering contract

Settings has a single layout owner: `src/ui/settings/settings-layout-v2.js`.

Deterministic extension order:

`Account (Money inside) → Tax → Users/Access → Support Access → Activity Report → Company Profile`

Invariants:

- `rc13-company-context.js` must not observe/rearrange Settings cards.
- `rc13-operational-audit.js` must not use a private content MutationObserver or delayed timer to append Activity.
- late Profile/Audit nodes are captured into deterministic slots.
- Activity Report uses a persistent shell and bounded internal scrolling.
- regression tests reject return of the old competing-render patterns.

This contract is **explicitly Live accepted** for the previously reported jump/breakage symptoms.

---

## 10) e-Invoice boundary — RC1.5-D

- provider-neutral prevalidation only; no external submission enabled.
- browser contains no provider secret/private credential.
- preflight validates stable accounting/tax/identity/readiness invariants and reports all findings.
- volatile provider/regulatory rules belong in versioned adapters rather than Core.
- UI explicitly states that no invoice has been transmitted.
- missing seller tax identity is a readiness blocker when submission becomes relevant.
- user explicitly confirmed the current prevalidation UI works in all discussed exposed locations.

Governing ADR: `docs/adr/0021-electronic-invoice-prevalidation-adapter-boundary.md`.

---

## 11) Web/PWA / Auth / Company UX

Web/PWA engineering:

- final font stack uses loaded Vazirmatn with Apple/system fallbacks.
- iPhone/PWA presentation includes `100dvh` and safe-area-aware behavior.
- PWA orientation is `any`.
- Service Worker HTML fallback is navigation-only; missing JS/CSS/image does not receive HTML.
- latest Staging cache = `avan-staging-rc1-v90-financial-analysis-layout`.

Auth/Company:

- login password visibility control is present.
- zero-company onboarding is explicit.
- Company Context publishes authoritative refresh after authentication so the Company Shell cannot remain stuck on its pre-login empty snapshot.
- deterministic company selection avoids parallel focus/open-time refresh loops.
- `company-context-auth-sync.spec.mjs` now permanently covers the pre-auth-empty → authenticated-multi-company hydration scenario in `npm run quality`.
- the user explicitly confirmed manual refresh is no longer required after the PR #94 fix.

---

## 12) Session / password policy

- existing-user login + recovery flow.
- signup/recovery password guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.
- Supabase built-in leaked-password screening remains unavailable/disabled under current zero-charge/provider posture; this is a known limitation.

---

## 13) Backup / Restore / rollback

Runbook: `avan-staging/BACKUP_RESTORE_RUNBOOK.md`.

- Free Transactional Recovery Rehearsal = **PASS**.
- full external disaster restore = **OPEN / NOT FULL PASS** because no genuinely free isolated restore target is available.
- never restore against `Avan-production` itself.
- no paid Supabase branch/project workaround under current policy.
- current Release-readiness baseline is recorded in `avan-staging/RC1_5_FINAL_RC_PROMOTION_READINESS.md`.

Rollback:

- existing `prod-backup-20260907-rc1-4-pre` branch was re-verified to exist and resolve successfully.
- before RC1.5 Production promotion, create `prod-backup-20260910-rc1-5-pre-promotion` from the exact final pre-promotion `main` commit.
- do **not** create that final branch before the remaining Live Gate, because any Live-fix commit must be included in the exact recovery point.
- RC1.5 DB foundations are already applied to the shared backend and current RC1.4 Production runs against that schema; planned RC1.5 rollback is therefore a frontend/root rollback, not destructive DB rollback.

---

## 14) Architecture quality gate

Governing ADR: `docs/adr/0016-modular-runtime-no-monkey-patching.md`.

Automated release gate includes:

- syntax validation including Service Worker and Company Context.
- Operation Pipeline/lifecycle tests.
- money precision + report contract tests.
- VAT + integrated Tax/Settlement regression.
- reconciliation intelligence tests.
- Settings stable-shell/no-layout-shift regression.
- zero-company/auth UX regression.
- Company auth→membership hydration behavioral regression.
- composite custom-report regression.
- e-Invoice prevalidation tests.
- full active-runtime release regression.
- final Web/PWA/iPhone + dashboard presentation regression.
- architecture audits.

Latest evidence:

- PR #91 Actions #119 / main #120 / Pages #318 = success.
- PR #94 Actions #126 / main #127 / Pages #323 = success.
- PR #95 Actions #128 / main #129 / Pages #324 = success.
- **PR #96 Actions #130 / main #131 / Pages #325 = success.**
- direct shared-client overwrites = 0 under current architecture audit.

**Final RC Engineering Gate = PASS.**

---

## 15) Next operating step — remaining explicit RC1.5 Live Gate

Already accepted items (Settings jump family, e-Invoice prevalidation, Company auth hydration, Financial-analysis layout, previously accepted composite report) should not be re-tested unless a regression is observed.

The remaining user-observable release scope is:

1. **One-Rial money** — `1515 Rial ↔ 151.5 Toman`, correct amount-in-words, invoice save with no obsolete divisibility error.
2. **VAT → final invoice → Settlement** — reference `151.5 + 15.2 = 166.7 Toman` reaches Settlement exactly.
3. **Invoice/Settlement modes** — sale/purchase plus credit, cash, check and at least installment/mixed; no zeroing or silent rounding.
4. **Reports/print** — active money unit in headings/print context, not repeated after every numeric cell; receipt/payment/transfer detail follows the same contract.
5. **iPhone/mobile** — Persian font/fallback, safe-area, forms/keyboard, toast and landscape table usability.
6. **PWA offline shell** — after one online load, installed PWA reopens offline without white screen, MIME error or `Unexpected token <`.

After the user explicitly reports PASS for these remaining six items:

- record **RC1.5 Live PASS** in this file;
- freeze the exact candidate SHA;
- create/verify the new pre-promotion rollback branch;
- promote the vetted Staging runtime to Production root with a Production SW cache identity;
- run Production CI/Pages and Production Smoke Gate;
- only then declare **RC1.5 — Production Released**.

---

## 16) Deferred roadmap

After final Web/PWA release only:

- Windows `.exe` / desktop packaging.
- true offline mode requires local persistence plus conflict-aware synchronization; a web wrapper alone is not considered offline support.
- future priorities may include treasury/bank reconciliation, cash/check intelligence, advanced reconciliation, payroll, fixed assets, budgeting, workflow/approval, consolidated reporting and external integrations.
