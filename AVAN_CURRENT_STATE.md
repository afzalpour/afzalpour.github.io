# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-12**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production runtime**.
- `avan-staging/` = **Staging / next-release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Production current release = **RC1.7**.
- RC1.7 Production release PR = **#158**; merge = `cf08f25703b84c0049103eb97e15d59945973658`.
- explicit release approval = **«RC1.7 Production Release APPROVED»**.
- RC1.7 Production Smoke = **PASS**.
- explicit final Production Smoke confirmation = **«RC1.7 Production Smoke UX PASS»**.
- current Live validation pending = **none for RC1.7 current scope**.
- current release-engineering pending = **none for RC1.7**.
- Production Service Worker cache = `avan-prod-rc1-7-v1`.
- Production root remains RC1.7 plus the accepted Smoke UX and Company Onboarding/Auth hotfixes.
- **Module 4 has not been promoted to Production.**

Production rollback points retained:
- `prod-backup-20260912-rc1-7-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-smoke-ux-hotfix`
- `prod-backup-20260912-company-onboarding-auth-hotfix-pre-promotion`

---

## 2) Accepted Production capabilities retained

### RC1.6 retained scope
- Bank Reconciliation Foundation = Engineering/Backend PASS.
- Bank Statement Import + Reconciliation UI = Engineering + Live PASS.
- Party Ledger = Engineering + Full Live PASS.
- exact one-Rial receipt/payment/transfer and real bank-statement import = Live accepted.
- Party Ledger print/PDF, Jalali range and gross AR/AP without auto-offset = Live accepted.

### RC1.7 accepted scope
- Financial Control Tower = Engineering + Live + Production Smoke PASS.
- Financial Digital Twin = Engineering + Live + Production Smoke PASS.
- Working Capital + Evidence = Engineering + Full Live + Production Smoke PASS.
- Evidence-backed Operational Decision Layer = Engineering + Full Live + Production Smoke PASS.
- Dashboard Accounting Correctness = Production Live PASS.
- Counterparty 360 = Production Live PASS.

Permanent explicit acceptance markers retained for regression/history:
- **«Financial Digital Twin Live PASS»**
- **«Working Capital + Evidence Live PASS»**
- **«RC1.7-D Evidence Readable PASS»**
- **«RC1.7-D Live PASS — Handoff Fixed»**
- **«Digital Twin Evidence Readable PASS»**
- **«Dashboard Accounting Correctness Audit Live PASS»**
- **«Counterparty 360 Live PASS»**

Core accepted behavior remains:
- deterministic calculations before narrative;
- accounting-readable evidence instead of raw UUIDs;
- gross AR/AP without cross-party auto-netting;
- exact one-Rial money;
- no silent journal/payment mutation from intelligence features;
- every important financial number should remain drillable.

---

## 3) Backend/accounting certification snapshot

Direct read-only verification on `Avan-production` remains the backend reference:

- public financial/application tables inspected = RLS enabled.
- orphan journal lines = **0**.
- cross-workspace journal-line mismatches = **0**.
- unbalanced Posted journals = **0**.
- orphan invoice lines = **0**.
- cross-workspace invoice-line mismatches = **0**.
- journal lines containing fractional Toman values = **42**; real data exercises one-Rial exactness.
- effective anon/auth executable public `SECURITY DEFINER` exposure = **0** under the established privilege boundary.
- after explicit **«RC1.7-D Live PASS — Handoff Fixed»**: **93 journal entries / 24 financial transactions / 42 invoices** with unchanged latest creation timestamps relative to the pre-test baseline.

Supabase Security Advisor remains truthful:
- built-in **Leaked Password Protection disabled**; provider/plan limitation, not falsely marked fixed.
- INFO notices for RLS-enabled private/internal tables must not be silenced with permissive policies.

---

## 4) Governing accounting/security invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- canonical money = **Toman with 0.1 Toman = 1 Rial**.
- `1515 Rial` persists losslessly as `151.5 Toman`.
- no silent sub-Rial rounding.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- gross receivable/payable remain separate; no automatic AR/AP or cross-party offset.
- account hierarchy is structural; only valid leaves are postable.
- browser storage is not a financial datastore.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- browser never receives Service Role/private secrets.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains **OPEN**; never restore against `Avan-production` itself.
- no new shared-client monkey patching; Operation Pipeline / UI Lifecycle / Money Runtime remain extension boundaries.

---

## 5) Company Onboarding + Admin Auth Re-entry incident — CLOSED

Status: **Engineering/Release PASS + authenticated Production Live PASS**.

Incident correction history:
- Staging PR #166 merge = `7533b0f72514120dc6e924575addb30496efe4b0`.
- Architecture Gate #284/#285 = PASS; Staging Pages #409 = PASS.
- Production PR #167 merge = `1eac2e9cf4fd44feaa49fffd86b9438a6a5161c9`.
- Production Release Gate #18/#19 = PASS; Pages #410 = PASS.
- zero-company create-company onboarding = PASS.
- account-switch/authentication re-entry = PASS.
- existing Platform Admin sign-in/access re-entry = PASS.
- explicit authenticated confirmation = **«Company Onboarding + Admin Re-entry Live PASS»**.
- no password, financial data, membership or admin-row mutation was required by the hotfix.

No retest is required unless a new regression is reported.

---

## 6) Strategic architecture — ADR-0023

ADR-0023 remains **Accepted**. Official capabilities:

1. Financial Control Tower;
2. Financial Digital Twin;
3. Working Capital Autopilot;
4. Continuous Close + Continuous Audit;
5. Iran Compliance Radar;
6. Counterparty 360;
7. Smart Procurement & Spend Control;
8. Avan Evidence Graph;
9. Avan Connect / Automation Marketplace.

Current progress:
- Module 1 = Production Live PASS.
- Module 2 = Production Live PASS.
- Module 3 = Production Live PASS.
- Module 4 = Engineering PASS; authenticated Staging Live is **partially accepted and targeted retest remains**.
- Module 6 = Production Live PASS.
- Module 8 current scope = Production Live PASS.
- Modules 5, 7 and 9 remain later trains.

Current architectural train: **Module 4 — Continuous Close + Continuous Audit**.

---

## 7) Module 4 foundation — Engineering status

Original Engineering foundation:
- PR #164 merge = `4549e56a934431e2e09826ee510800ecbdc8709a`.
- Architecture Gate #282/#283 = PASS.
- Staging Pages #407 = PASS.
- original cache = `avan-staging-rc1-v112-module4-continuous-close-audit`.

Foundation contract:
- architecture = `avan-continuous-close-audit-foundation-v1`.
- deterministic Close status = `Ready / Attention / Blocked`; no arbitrary readiness score.
- existing accepted Control Tower/reconciliation controls and legacy close/audit rules are reused rather than creating a second accounting truth.
- unified control/exception model covers integrity, close-readiness, reconciliation, duplicates and anomalies.
- evidence is workspace-scoped and accounting-readable.
- `writeOperations = 0`.
- `actualLedgerMutation = false`.
- no posting, payment or period-close action is executed by the workspace.
- one-Rial exactness and explicit sub-Rial rejection remain locked by regression tests.

Pre-Live read-only baseline recorded after the original Engineering merge:
- journal entries = **93**;
- financial transactions = **24**;
- invoices = **42**;
- documents = **23**.

---

## 8) Module 4 first authenticated Staging Live result — PARTIAL PASS

User Live validation on Staging reported:

### Accepted in Live
1. page **«بستن و حسابرسی پیوسته»** opens correctly both from its standalone navigation entry and from Reports = **PASS**.
2. Close status and its logic are understandable/functional = **PASS**.
3. changing the date (including test to 1 Mordad 1404) recalculates values and created no journal/document = **mutation-free Live PASS for this interaction**.
4. evidence under **«آمادگی بستن دوره»** works correctly.

### Defects found in Live
- Evidence interaction under the exception section was unstable for some rows.
- numeric evidence cases such as approximately `78,000,000 Rial` could open accounting evidence while repeatedly injecting **«واحد مبالغ: ریال»** boxes and causing visible jumping/flicker.
- Module 4 contained mixed English/Persian terms including Close / Exception / Reconciliation / Anomaly and needed fluent Persian business language.
- VAT report tables could overflow the visible RTL/card surface.
- intelligence workspaces lacked a consistent **چاپ / ذخیره PDF** entry.
- user observed a Production/Staging behavioral mismatch in **«✦ از آوان بپرس»** (Production showing more suggested questions than Staging), exposing a release-architecture drift/cache risk.

Therefore **Module 4 Live PASS is not yet recorded**.

---

## 9) Module 4 Live correction + UX hardening — PR #170

Correction PR = **#170**.
Merge = `d848b0056936934cb471553e769b0b266f0be5c1`.
Pre-merge Architecture Gate = **#289 PASS**.
Post-merge Architecture Gate = **#290 PASS**.
Staging Pages = **#413 PASS**.
Staging cache = **`avan-staging-rc1-v113-module4-live-polish-runtime-parity`**.
Production runtime = **unchanged**.

Engineering corrections now deployed to Staging:

### Evidence stability / money-unit flicker
- Module 4 evidence Modal now opens once and updates its evidence body in place instead of rebuilding the complete Modal after asynchronous reads.
- Evidence Modal explicitly suppresses the generic money-unit badge.
- Money Output Contract is now idempotent for direct unit badges and removes duplicates/stale badges.
- permanent regression asserts a single `openModal()` lifecycle in the evidence flow and the badge suppression contract.

### Fluent Persian Module 4 UI
User-facing terminology was rewritten to business Persian, including:
- `کنترل مستمر بستن دوره و حسابرسی`;
- `کنترل بازِ بستن دوره`;
- `کل موارد نیازمند بررسی`;
- `فهرست موارد نیازمند بررسی`;
- `کنترل‌های یکپارچگی، ثبت‌های مشابه، مغایرت‌ها و ناهنجاری‌ها`;
- Persian explanation/disclaimer for duplicate/anomaly findings;
- user-facing Close/Audit/Integrity/Duplicate/Reconciliation/Anomaly/Posted/Draft references are translated in the Module 4 presentation layer.

### Unified Print / Save PDF
A shared intelligence print launcher now uses the existing company/unit-aware Avan Print/Export boundary for:
- **برج کنترل مالی**;
- **دوقلوی مالی**;
- **مرکز سرمایه در گردش**;
- **تصمیم‌یار عملیاتی**;
- **بستن و حسابرسی پیوسته**.

The control is **«چاپ / ذخیره PDF»** and reuses `AvanPrintExport.printElement(...)`; a second print system was not created. The existing print contract remains responsible for company identity and selected money unit.

### VAT report containment
- VAT report `.table-wrap` is explicitly width-contained and horizontally scrollable for wide tables.
- print mode restores full printable table width.
- mobile KPI layout is constrained separately.

### Regression result
Architecture Gate #289 log explicitly confirmed:
- `continuous-close-audit.spec.mjs: PASS`
- `Module 4 Live polish regression PASS`
- `runtime parity PASS — 197 Staging assets / 192 Production assets checked; 13 intentional divergences declared`
- `sw-precache-integrity: PASS (198 declared runtime entries; avan-staging-rc1-v113-module4-live-polish-runtime-parity)`
- `rc17-release-closure: PASS`
- architecture high findings = **0**
- money architecture findings = **0**

---

## 10) ADR-0024 — Production/Staging Runtime Parity Contract

Status: **Accepted**.

Reason: Production and Staging are intentionally separate release surfaces, but shared runtime must not silently drift after Production hotfixes or next-release work.

Active contract:
- Production baseline is the common runtime reference.
- runtime assets shared by Production and Staging must be **byte-identical**.
- intentional next-release/environment differences must be declared in `avan-staging/runtime-divergence-allowlist.json` with an explicit reason.
- parity is **bidirectional**: Production runtime cannot gain an active asset without its Staging mirror, and Staging cannot silently carry a different shared asset.
- active runtime scope is defined from each environment's declared Service Worker `ASSETS`, not from historical/unused repository debris.
- normal Production promotion remains explicit; parity does **not** auto-promote Staging changes.
- a Production incident hotfix must be Staging-first or immediately backported into the same release train.
- Staging runtime changes require an advanced cache identity.
- allowlist entries are expected to be temporary/minimal and removed after promotion when the runtime becomes shared again.

Dedicated capability lock:
- `src/ui/intelligence/business-copilot-view.js` must be byte-identical between Production and Staging.
- `src/ui/intelligence/dashboard-intelligence-live-polish.js` must be byte-identical between Production and Staging.

At PR #170 Gate time those question-bank source files were already byte-identical. Therefore the previously observed **9-vs-4 «از آوان بپرس»** difference was not supported by current source drift and is consistent with a stale served runtime/cache. Staging cache was advanced to v113 and the parity contract now prevents future silent source drift.

---

## 11) Current canonical pointers

Production:
- current release = **RC1.7**.
- original release PR #158.
- Smoke UX Production hotfix PR #162 merge `133f9e44cd3408e6ba7dbabfba194a89dca92d0c`.
- Company Onboarding/Auth Production hotfix PR #167 merge `1eac2e9cf4fd44feaa49fffd86b9438a6a5161c9`.
- Company Onboarding/Auth Live = **PASS**.
- Production Service Worker = `avan-prod-rc1-7-v1`.

Staging / Module 4:
- foundation PR #164 merge `4549e56a934431e2e09826ee510800ecbdc8709a`.
- Live correction/parity PR #170 merge `d848b0056936934cb471553e769b0b266f0be5c1`.
- Architecture = #289 pre-merge / #290 post-merge PASS.
- Pages = #413 PASS.
- cache = `avan-staging-rc1-v113-module4-live-polish-runtime-parity`.
- Module 4 Production promotion = **not authorized / not performed**.
- Module 4 final Live validation = **targeted Staging retest pending**.

Architecture:
- ADR-0023 Intelligent Finance OS = Accepted.
- ADR-0024 Production/Staging Runtime Parity Contract = Accepted.

---

## 12) Required next acceptance — targeted Staging retest only

Do not repeat the already accepted Module 4 checks from zero. Only verify the corrected surfaces on `https://afzalpour.github.io/avan-staging/`:

1. In **فهرست موارد نیازمند بررسی**, open evidence for a numeric/high-value row such as the previously observed ~78,000,000 Rial case. Evidence must remain open/stable with **no repeated «واحد مبالغ» boxes and no jumping/flicker**.
2. Confirm the Module 4 hero, KPI labels, table descriptions and warning/disclaimer are fluent Persian and no unwanted Close/Exception/Reconciliation/Anomaly terminology remains in the user-facing flow.
3. Confirm **چاپ / ذخیره PDF** is available on the main intelligence workspaces (Control Tower, Financial Digital Twin, Working Capital, Continuous Close/Audit; Decision Layer is also covered) and that the print/PDF header retains company identity and selected money unit.
4. Open **گزارش مالیات بر ارزش افزوده** and confirm the wide table remains inside its surface with horizontal scrolling rather than overflowing the card/page.
5. After Staging v113 refresh, compare **«✦ از آوان بپرس»** with Production; question suggestions/content should match for the shared runtime.

If these corrected surfaces pass, the expected confirmation is:

**«Module 4 Live Polish + Runtime Parity PASS»**

Only after that confirmation may Module 4 be considered for a separate Production release approval. Do **not** promote it automatically.