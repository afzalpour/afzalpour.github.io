# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-09 — RC1.5 Full Staging Regression + Final Web/PWA Engineering PASS (PR #85 / #86; Actions #103–#106; Pages #312 / #313) — explicit browser/PWA Live acceptance pending**.

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
- rollback branch: `prod-backup-20260907-rc1-4-pre`.
- Production root runtime has **not** been promoted to RC1.5.

### RC1.5 Staging engineering state

- RC1.5-A — Versioned Tax Data Foundation = **BACKEND PASS**.
- RC1.5-B — VAT Calculation & Invoice Accounting Bridge = **BACKEND PASS**.
- AC-1 — Frontend Architecture Consolidation = **ENGINEERING PASS**.
- RC1.5-C — Tax UX & VAT Reports = **BACKEND PASS / FRONTEND ENGINEERING PASS / LIVE PENDING**.
- ADR-0019 one-Rial money precision + report/settlement fixes = **ENGINEERING PASS**.
- RC1.5-D e-Invoice pre-validation / provider-neutral adapter = **ENGINEERING PASS** via PR #82 / Actions #95.
- Integrated Tax + Settlement precision = **ENGINEERING PASS** via PR #83 / Actions #99 and #100.
- Full active-runtime regression = **ENGINEERING PASS** via PR #85 / Actions #103 and #104 / Pages #312.
- Final Web/PWA + iPhone hardening = **ENGINEERING PASS** via PR #86 / Actions #105 and #106 / Pages #313.
- latest Staging merge commit: `5cf9cc9676d8b9af188b3c150be1c8bb32c6d726`.
- latest Staging SW cache: `avan-staging-rc1-v83-final-web-pwa`.

### Next gate

1. **Explicit RC1.5 browser/PWA Live acceptance by user**.
2. If PASS: record Live acceptance and create final RC / promotion-readiness evidence.
3. Production promotion only after final RC, rollback verification and Production smoke gate.
4. Full external disaster restore remains OPEN under the current zero-charge constraint unless a genuinely free isolated restore target becomes available.

---

## 2) Explicit Live acceptance history

Previously accepted gates remain valid, including:

- B-4 Live / B-4.1.
- RC1 + two-user RLS.
- RC1.1 / RC1.2 / RC1.3 accepted gates.
- RC1.3 Production Smoke Gate.
- RC1.4 inventory/invoice/settlement behavior previously accepted by user.

**Not Live PASS yet:** the accumulated RC1.5 A/B/C/D, one-Rial invoice/report/settlement changes, integrated VAT+Settlement, full regression, and final Web/PWA/iPhone polish.

---

## 3) Governing architecture / invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role / secret/private keys.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Avan is Multi-tenant / Multi-company SaaS.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1-Toman precision = 1 Rial** under ADR-0019.
- `1515 Rial` must persist losslessly as `151.5 Toman`; no silent sub-Rial rounding.
- generic integer-money flows may retain their established contract until explicitly migrated but may not reinterpret decimal Canonical values.
- Ledger must remain balanced; orphan journal lines must remain zero.
- browser Local/Session storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- user-visible UI/errors are Persian-first except unavoidable standards such as PDF/CSV/SKU.
- Frontend migration follows Strangler Pattern; no full rewrite.
- no new shared-client monkey patching; Operation Pipeline / lifecycle composition are the extension boundaries.
- business calculation/validation logic should be pure/domain-level and regression-testable where practical.
- AI/automation remains Human-controlled and explainable.

---

## 4) Latest accounting / security integrity baseline

Latest read-only regression on 2026-09-09:

- Posted/Reversed Ledger debit = credit = **4,073,483,384.7 Toman**.
- unbalanced Posted/Reversed journals = **0**.
- orphan journal lines = **0**.
- invoice `subtotal + tax` vs final-total mismatches = **0**.
- Posted/Reversed invoices without journal = **0**.
- settlement schedule total mismatches = **0**.
- orphan settlement schedules = **0**.
- orphan financial checks = **0**.
- inventory reconciliation failures = **0 across all 6 Companies**.
- authenticated-executable `public SECURITY DEFINER` functions = **0**.
- relevant invoice/settlement/check/journal monetary columns are `numeric(20,1)`.

Current Tax state observed read-only:

- Tax-enabled Company/settings = **1**.
- e-Invoice enabled on that setting = **0**.
- that enabled setting currently has no tax identifier; the engineering gate did not mutate it.
- if e-Invoice is later enabled without seller identity completion, prevalidation is expected to block readiness.

---

## 5) Multi-company / security boundary

Accepted baseline:

- central `CompanyContext` + explicit active Company.
- Company Portfolio (`شرکت‌های من`).
- no hidden first-workspace tenant selection.
- CompanyBoundary over legacy reads.
- Company creation/lifecycle/member limits enforced at authoritative boundaries.
- Platform Admin is separate from Company Ledger authority.
- Support access is Company-bound, reason-required, time-limited and read-only.
- authenticated-executable public SECURITY DEFINER exposure remains zero.

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
- all 6 Companies passed the latest reconciliation check.

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
- locked regression: `151.5 Toman + 15.2 VAT = 166.7 Toman` final, including exact Settlement plan validation.
- a 0.1-Toman mismatch is rejected; sub-Rial amounts are rejected rather than rounded.
- legacy v61 fallback may remain as compatibility source code but is inert because the modern operation owner registers first; direct shared-client overwrites = 0.

---

## 8) Reports / print / Persian UX

- monetary inputs use three-digit grouping where applicable.
- invoice monetary fields expose Persian amount-in-words.
- reports/tables/print surfaces carry the active money unit in monetary headings.
- prepared report cells do not repeat `تومان/ریال` after every number.
- prepared report headings/titles are centered through the centralized presentation contract where required.
- receipt/payment/transfer detail views follow heading-only unit presentation.
- user-visible technical errors remain translated to safe Persian messages.

---

## 9) e-Invoice boundary — RC1.5-D

- provider-neutral prevalidation only; no external submission enabled.
- browser contains no provider secret/private credential.
- preflight validates stable accounting/tax/identity/readiness invariants and reports all findings.
- volatile provider/regulatory template rules must be versioned in adapters rather than hard-coded into Core.
- UI explicitly states that no invoice has been transmitted.
- missing seller tax identity is a readiness blocker when e-Invoice submission becomes relevant.

Governing ADR: `docs/adr/0021-electronic-invoice-prevalidation-adapter-boundary.md`.

---

## 10) Final Web/PWA engineering hardening

PR #86 completed:

- final font stack now actually uses loaded **Vazirmatn** with Apple/system fallbacks; legacy unavailable `IRAN` family no longer owns final presentation.
- iPhone/PWA presentation includes `100dvh` and safe-area-aware mobile behavior.
- PWA orientation is `any`, so accounting tables may use landscape.
- Service Worker uses network-first same-origin caching but HTML shell fallback is **navigation-only**.
- missing JS/CSS/image resources no longer receive `index.html`, preventing MIME / `Unexpected token <` offline failures.
- `sw.js` is syntax-checked in CI.
- final Web/PWA regression is part of `npm run quality`.
- Actions #105 (PR) and #106 (main) = success.
- Pages #313 build/deploy = success.

Evidence: `avan-staging/RC1_5_FINAL_WEB_PWA_GATE_EVIDENCE.md`.

---

## 11) Auth / Session / password policy

- existing-user login + recovery flow.
- signup/recovery password guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.
- Supabase built-in leaked-password screening remains unavailable/disabled under the zero-charge path; application controls are the compensating control and provider protection is not falsely marked fixed.

---

## 12) Backup / Restore

Runbook: `avan-staging/BACKUP_RESTORE_RUNBOOK.md`.

- Free Transactional Recovery Rehearsal = PASS.
- full external disaster restore = **OPEN / NOT FULL PASS** because no genuinely free isolated restore target is available in the connected environment.
- never restore against `Avan-production` itself.
- no paid Supabase branch/project workaround under current policy.
- if unresolved at release, document this explicitly as a known zero-charge limitation.

---

## 13) Architecture quality gate

Governing ADR: `docs/adr/0016-modular-runtime-no-monkey-patching.md`.

Current automated gate includes:

- syntax validation, including Service Worker.
- Operation Pipeline/lifecycle tests.
- money precision + report contract tests.
- VAT + integrated Tax/Settlement regression.
- reconciliation intelligence tests.
- e-Invoice prevalidation tests.
- full active-runtime release regression.
- final Web/PWA/iPhone regression.
- architecture audits.

Latest evidence:

- PR #85 Actions #103 = PASS.
- main Actions #104 = PASS.
- PR #86 Actions #105 = PASS.
- main Actions #106 = PASS.
- Pages #313 = PASS.
- direct shared-client overwrites = 0 under current architecture audit.

---

## 14) Next operating step

**The next gate is not another hidden engineering change. It is explicit browser/PWA Live acceptance of the deployed Staging build.**

Required Live focus:

1. `1515 Rial ↔ 151.5 Toman`, amount-in-words, invoice save and Settlement exactness.
2. VAT-inclusive final total → Settlement when Tax is enabled.
3. sale/purchase invoice and all Settlement plan types.
4. prepared reports plus receipt/payment/transfer detail unit presentation.
5. iPhone/mobile Persian font, safe-area, keyboard/toast behavior.
6. installed PWA open/offline shell behavior without JS/CSS MIME errors.
7. e-Invoice preflight findings and explicit no-transmission message.

After explicit user PASS:

- record RC1.5 Live PASS in this file;
- produce final RC/promotion-readiness evidence;
- verify rollback path;
- promote to Production only through the governed release workflow;
- run Production smoke gate before declaring the Web/PWA release complete.

---

## 15) Deferred roadmap

After final Web/PWA release only:

- Windows `.exe` / desktop packaging.
- true offline mode requires local persistence plus conflict-aware synchronization; a web wrapper alone is not considered offline support.
- future areas may include treasury/bank matching, payroll, fixed assets, budgeting, workflow/approval, consolidated reporting and external integrations.
