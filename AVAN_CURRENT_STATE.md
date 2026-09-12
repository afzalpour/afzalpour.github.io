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
- Production root remains RC1.7 plus accepted Smoke UX and Company Onboarding/Auth hotfixes.
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
- effective anon/auth executable public `SECURITY DEFINER` exposure = **0**.
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

- Staging PR #166 merge = `7533b0f72514120dc6e924575addb30496efe4b0`.
- Architecture Gate #284/#285 = PASS; Staging Pages #409 = PASS.
- Production PR #167 merge = `1eac2e9cf4fd44feaa49fffd86b9438a6a5161c9`.
- Production Release Gate #18/#19 = PASS; Pages #410 = PASS.
- zero-company create-company onboarding = PASS.
- account-switch/authentication re-entry = PASS.
- existing Platform Admin sign-in/access re-entry = PASS.
- explicit authenticated confirmation = **«Company Onboarding + Admin Re-entry Live PASS»**.
- no password, financial data, membership or admin-row mutation was required by the hotfix.

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

Pre-Live read-only baseline after Engineering merge:
- journal entries = **93**;
- financial transactions = **24**;
- invoices = **42**;
- documents = **23**.

---

## 8) Module 4 first authenticated Staging Live result — PARTIAL PASS

Accepted in Live:
1. **«بستن و حسابرسی پیوسته»** opens from standalone navigation and Reports = PASS.
2. Close status/logic = PASS.
3. changing date, including 1 Mordad 1404, recalculated values and created no journal/document = mutation-free PASS for this interaction.
4. evidence under **«آمادگی بستن دوره»** works correctly.

Defects reported during Live:
- some Exception evidence interactions were unstable.
- high-value evidence such as ~`78,000,000 Rial` could trigger repeated **«واحد مبالغ: ریال»** boxes and flicker.
- Module 4 contained mixed English/Persian terms.
- VAT report wide tables could overflow.
- intelligence workspaces lacked consistent Print/PDF.
- Production/Staging mismatch was observed in **«✦ از آوان بپرس»**.

Therefore **Module 4 Live PASS is not yet recorded**.

---

## 9) Module 4 Live correction + runtime parity — PR #170

- PR #170 merge = `d848b0056936934cb471553e769b0b266f0be5c1`.
- Architecture Gate #289/#290 = PASS.
- Staging Pages #413 = PASS.
- cache = `avan-staging-rc1-v113-module4-live-polish-runtime-parity`.
- Production runtime remained unchanged.

Corrections deployed:
- Evidence Modal opens once and updates its body in place.
- money-unit badge projection is idempotent and duplicate/stale badges are removed.
- Module 4 user-facing Close/Exception/Reconciliation/Anomaly wording was rewritten to fluent Persian.
- shared intelligence **«چاپ / ذخیره PDF»** launcher uses existing `AvanPrintExport.printElement(...)` for Control Tower, Digital Twin, Working Capital, Decision Layer and Continuous Close/Audit.
- VAT report wide tables are width-contained with horizontal scrolling.
- ADR-0024 runtime parity regression became part of `npm quality`.

Gate #289 explicitly confirmed:
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

Active contract:
- Production baseline is the common runtime reference.
- shared runtime assets must be **byte-identical**.
- intentional next-release/environment differences must be declared in `avan-staging/runtime-divergence-allowlist.json` with explicit reason.
- parity is bidirectional.
- active runtime scope comes from each environment's Service Worker `ASSETS`.
- normal Production promotion remains explicit; parity does not auto-promote Staging changes.
- Production incident hotfixes must be Staging-first or immediately backported into the same release train.
- Staging runtime changes require an advanced cache identity.
- allowlist entries must remain temporary/minimal.

Dedicated capability locks:
- `src/ui/intelligence/business-copilot-view.js` byte-identical between Production/Staging.
- `src/ui/intelligence/dashboard-intelligence-live-polish.js` byte-identical between Production/Staging.

At PR #170 Gate time those question-bank source files were already byte-identical. The previously observed **9-vs-4 «از آوان بپرس»** mismatch was therefore not supported by current source drift and was consistent with stale served runtime/cache.

---

## 11) Module 4 Live polish v2 — Working Capital layout + Jalali Print/PDF

Authenticated user retest reported two additional presentation defects:
1. Staging **مرکز سرمایه در گردش** showed the seven KPI cards vertically instead of the accepted Production **4 + 3** desktop rhythm.
2. Print/PDF header date could appear Gregorian and must be explicitly Jalali/Persian.

Correction delivery:
- PR #172 = **Module 4 Live polish v2: Working Capital 4+3 + Jalali Print/PDF**.
- merge = `26d25eed3ef6995df6b08d4919f2e81ba81792ee`.
- pre-merge Architecture Gate = **#291 PASS**.
- post-merge Architecture Gate = **#292 PASS**.
- Staging Pages = **#415 PASS**.
- Staging cache = **`avan-staging-rc1-v114-module4-live-polish-v2`**.
- Production runtime = **unchanged**.

Working Capital layout correction:
- a late-loaded Staging guard now enforces `4` KPI columns on desktop, naturally rendering seven cards as **4 + 3**.
- responsive fallbacks remain `3` columns at <=1100px, `2` at <=900px and `1` at <=560px.
- the guard uses explicit layout ownership so later CSS cannot collapse all KPI cards into one column.

Print/PDF date correction:
- central Staging `rc12-print-export.js` changed from ambiguous `Intl.DateTimeFormat('fa-IR', ...)` to explicit **`Intl.DateTimeFormat('fa-IR-u-ca-persian', ...)`**.
- therefore the shared Print/PDF header now requires the Persian/Jalali calendar while retaining print time.
- this is intentionally declared in ADR-0024 divergence allowlist until a later Production promotion.

Permanent regression coverage now locks:
- Working Capital desktop 4-column KPI grid;
- responsive 2/1-column fallbacks;
- explicit Persian calendar formatter in the Print/PDF boundary;
- Staging cache identity v114.

No accounting calculation, backend schema/data, financial mutation, auth, membership or admin behavior changed in PR #172.

---

## 12) Current canonical pointers

Production:
- current release = **RC1.7**.
- original release PR #158.
- Smoke UX Production hotfix PR #162 merge `133f9e44cd3408e6ba7dbabfba194a89dca92d0c`.
- Company Onboarding/Auth Production hotfix PR #167 merge `1eac2e9cf4fd44feaa49fffd86b9438a6a5161c9`.
- Company Onboarding/Auth Live = PASS.
- Production Service Worker = `avan-prod-rc1-7-v1`.

Staging / Module 4:
- foundation PR #164 merge `4549e56a934431e2e09826ee510800ecbdc8709a`.
- Live correction/parity PR #170 merge `d848b0056936934cb471553e769b0b266f0be5c1`.
- Live polish v2 PR #172 merge `26d25eed3ef6995df6b08d4919f2e81ba81792ee`.
- latest Architecture = #291 pre-merge / #292 post-merge PASS.
- latest Pages = #415 PASS.
- latest cache = `avan-staging-rc1-v114-module4-live-polish-v2`.
- Module 4 Production promotion = **not authorized / not performed**.
- Module 4 final Live validation = **targeted Staging retest pending**.

Architecture:
- ADR-0023 Intelligent Finance OS = Accepted.
- ADR-0024 Production/Staging Runtime Parity Contract = Accepted.

---

## 13) Required next acceptance — targeted Staging retest only

Do not repeat accepted Module 4 checks from zero. Verify only corrected surfaces on `https://afzalpour.github.io/avan-staging/`:

1. **مرکز سرمایه در گردش** on desktop must show seven KPI cards as **4 on the first row + 3 on the second row**, matching the accepted Production presentation.
2. Open **چاپ / ذخیره PDF** from an intelligence workspace and confirm the header date is **شمسی** (Persian calendar), with company identity and selected money unit retained.
3. Continue the still-pending targeted checks from PR #170: Exception evidence stability/no repeated money-unit boxes, fluent Persian Module 4 text, VAT table containment, and shared **«✦ از آوان بپرس»** behavior.

Do **not** mark Module 4 Live PASS until explicit authenticated user confirmation. Do **not** promote Module 4 to Production without a separate explicit release approval.
