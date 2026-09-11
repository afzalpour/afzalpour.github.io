# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-11**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production runtime**.
- `avan-staging/` = **Staging / next-release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Production current release = **RC1.6**.
- RC1.6 Production release PR = **#117**.
- RC1.6 Production merge commit = `eace3198947da1e87deb5d5512b905b27975c74e`.
- RC1.6 Production Smoke = **PASS**.
- pre-RC1.6 rollback branch = `prod-backup-20260910-rc1-6-pre-promotion`.
- RC1.7 work remains Staging-only until a future explicit Production Release Gate.

---

## 2) RC1.6 accepted scope

RC1.6 is released and accepted:

1. **RC1.6-A — Bank Reconciliation Foundation** — Engineering/Backend PASS.
2. **RC1.6-B — Bank Statement Import + Reconciliation UI** — Engineering + Live PASS for implemented scope.
3. **RC1.6-C — Party Ledger** — Engineering + Full Live PASS.
4. accounting-negative presentation = signed truth preserved; negative values visually appear red as `(amount)`.
5. exact one-Rial receipt/payment/transfer and real ESC-delimited bank-statement import = Live accepted.
6. Party Ledger print/PDF, Jalali range, gross AR/AP without auto-offset = Live accepted.

Production promotion was performed only after the Release Candidate Gate and explicit approval: **«RC1.6 Production Release APPROVED»**.

---

## 3) RC1.7-A — Avan Financial Control Tower

Status: **Engineering PASS + Live PASS**.

- PR #118 merged as `b260c6995c233f097661082092767373416e1fe9`.
- pre-merge Gate #202 = PASS.
- post-merge Gate #203 = PASS.
- Pages #355 = PASS.

Implemented: Company/RLS-scoped cash/bank, gross AR/AP by real `party_id`, bank/inventory risk indicators, deterministic close-readiness blockers, prioritized control actions, `چرا این عدد؟` evidence drilldown, Persian/Jalali responsive UI, exact one-Rial precision, zero AI-generated financial amount and zero financial write path.

### Deferred Live polish

User reported several minor Control Tower issues after Live PASS. Any remaining items not covered by later explicit feedback stay in the polish backlog and must not be guessed.

---

## 4) RC1.7-B — Financial Digital Twin

Status: **Engineering PASS + Live PASS**.

- PR #119 merged as `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- pre-merge Gate #204 = PASS.
- post-merge Gate #205 = PASS.
- Pages #356 = PASS.
- milestone cache = `avan-staging-rc1-v103-financial-digital-twin`.
- explicit user confirmation = **«Financial Digital Twin Live PASS»**.

Implemented: real opening cash/bank, explicit user-entered future flows, deterministic Base vs Scenario cash, liquidity stress, disclosed proportional sub-Rial rounding only where mathematically unavoidable, evidence for opening cash, no scenario persistence, no Actual Ledger mutation and no AI arithmetic.

### Deferred Live polish

User reported several minor Digital Twin issues after Live PASS. Any remaining items not covered by explicit later feedback stay deferred; Live PASS remains valid.

---

## 5) RC1.7-C — Working Capital + Evidence Foundation

Status: **Engineering PASS + Live PASS**.

- PR #121 merged as `197503177b04b7f0fd30bedd2173645decb944ab`.
- Gate #206 caught an obsolete hard-coded PWA cache assertion.
- Gate #207 caught a real Shell regression: omitted `rc14-invoice-live-refinements.js`; it was restored without weakening the regression guard.
- final pre-merge Gate #208 = PASS.
- post-merge Gate #209 = PASS.
- Pages #358 = PASS.
- milestone cache = `avan-staging-rc1-v104-working-capital-evidence`.
- explicit user confirmation = **«Working Capital + Evidence Live PASS»**.

Implemented: canonical one-Rial Working Capital model; gross AR/AP by control accounts and real `party_id`; no cross-party netting; FIFO reduction allocation; invoice due-date aging with fallbacks; explainable collection priority; 30-day payable calendar; liquidity indicator; Evidence Graph links; explicit Company/RLS scope; zero autonomous collection/payment/posting and zero Actual Ledger mutation.

Important correction: legacy `src/reports/party-aging.js` remains unsuitable as the numeric source because of integer-oriented assumptions. RC1.7-C uses canonical decimal↔tenths money helpers.

### Deferred Live polish

User reported a minor Working Capital/Evidence issue after Live PASS. Any remaining item not covered by explicit later feedback stays deferred.

---

## 6) RC1.7-D — Evidence-backed Operational Decision Layer

Status: **Engineering PASS + Staging deployed; Live Gate pending**.

- PR #123 merged as `ba642265a33d43aca25937dac0721358dcb11a5c`.
- Gate #210 correctly stopped an obsolete RC1.7-C exact-cache assertion.
- final pre-merge Architecture Gate #211 = PASS.
- post-merge Architecture Gate #212 = PASS.
- Pages #360 = PASS.
- milestone cache = `avan-staging-rc1-v105-working-capital-decisions`.

Implemented: deterministic collection recommendations; payable sequencing; exact one-Rial `cash before`/`cash after`; liquidity-gap recommendation; `چرا این پیشنهاد؟`; controlled Digital Twin handoff with real open amounts as editable seeds; no auto-run, no autonomous message/payment/posting, no DB write and no Actual Ledger mutation.

**RC1.7-D Live Gate remains PENDING until explicit user confirmation.**

---

## 7) Dashboard + Financial Intelligence Live Polish / Accounting Correctness

Status: **Engineering PASS + Live PASS for Exact KPI / 10-Day hotfix; broader legacy-derived amount audit remains open**.

The first explicit polish pass was implemented through PR **#125**, a second layout/interaction pass through PR **#127**, and an accounting-correctness / ten-day-question hotfix through PR **#129**.

Baseline polish:

- PR #125 merge = `b53f958cb13cd311c63d21b1e44789a162d96747`.
- pre-merge Architecture Gate #213 = PASS.
- post-merge Architecture Gate #214 = PASS.
- Pages #362 = PASS.

Second Live-fix pass:

- PR #127 merge = `bef54fac6494fb96f4f6381d47bef76e992c9423`.
- pre-merge Architecture Gate #215 = PASS.
- post-merge Architecture Gate #216 = PASS.
- Pages #364 = PASS.

Accounting-correctness / ten-day hotfix:

- PR #129 merge = `10b9d83bef1764626c8fd4f2e8fda31f35bb3f27`.
- pre-merge Architecture Gate #217 = PASS.
- post-merge Architecture Gate #218 = PASS.
- Pages #366 = PASS.
- current Staging PWA cache = `avan-staging-rc1-v108-dashboard-accounting-correctness`.
- Production root was not changed.
- explicit user confirmation = **«Dashboard Exact KPI + 10-Day PASS»**.

### Critical accounting-correctness finding

User questioned the displayed annual P&L value `16,558,262,260 Rial`. Direct verification against the PostgreSQL/Supabase Ledger exposed a legacy Dashboard numeric parser defect: canonical Toman values containing one decimal digit were passed through an integer-only cleanup that removed the decimal point before `BigInt` conversion. Example: `177178123.1` became `1771781231`, creating a factor-of-10 error before Rial presentation.

Verified actual current-year values at the time of the check:

- income = `177,178,123.1 Toman`;
- expense = `11,595,500.5 Toman`;
- profit = `165,582,622.6 Toman` = **`1,655,826,226 Rial`**.

The old displayed `16,558,262,260 Rial` was therefore incorrect.

PR #129 adds a read-only exact-money projection for the four primary Dashboard KPIs:

- assets;
- cash/bank;
- liabilities;
- annual profit/loss.

These values are re-read from the authoritative report RPCs and parsed with canonical decimal↔tenths Money Core, preserving exact one-Rial values. The corrected canonical amount is also propagated to each KPI's `چرا این عدد؟` drilldown. Accounting-negative presentation is re-applied after the asynchronous exact refresh.

Regression coverage contains the real-value pattern:

`177178123.1 - 11595500.5 = 165582622.6 Toman = 1,655,826,226 Rial`.

### Ten-day question hang root cause and fix

The `اولویت‌های ده روز آینده` answer had a MutationObserver feedback loop: after rendering, the polish observer rewrote the heading with identical `textContent` on every pass, and that DOM rewrite retriggered the observer indefinitely. PR #129 makes the heading mutation idempotent and retains the one-time explanatory note only once.

### Existing polish kept active

- top KPI cards use a single-line numeric fit contract;
- `چرا این عدد؟` amount card spans full width and fits long values;
- all suggested business questions only populate the field and require explicit `تحلیل کن`;
- business answers hide technical `منبع` labels;
- the duplicate priority shortcut was consolidated into `اولویت‌های ده روز آینده`;
- Smart Collection table has stable no-break / horizontal-containment rules and no currency-unit text inside amount cells;
- Continuous Controls `سطح` is protected from word splitting;
- prior Why Number Persianization, collapsed evidence details, journal-back behavior, risk explanations, centered aging tables and severity color coding remain active.

### Certification boundary

PR #129 plus the explicit Live confirmation certifies **the four primary Dashboard KPI amounts and their Why Number amounts** for canonical one-Rial exactness and confirms that `اولویت‌های ده روز آینده` no longer hangs in the tested Live flow. It does **not** yet certify every legacy-derived amount inside Dashboard Aging / old business-intelligence / risk / collection sections. Those paths include legacy integer-oriented assumptions and require a dedicated Dashboard Accounting Correctness Audit before they can be declared fully exact.

---

## 8) Governing accounting / money invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- canonical money = **Toman with 0.1 Toman = 1 Rial**.
- `1515 Rial` persists losslessly as `151.5 Toman`.
- no silent sub-Rial rounding.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Party outstanding position derives from configured AR/AP control accounts and exact `party_id`.
- gross receivable/payable remain separate; no automatic cross-party or AR/AP offset.
- negative accounting notation `(amount)` is Presentation Layer only; Core/DB/API keep the real signed value.
- account hierarchy is structural; only valid leaves are postable.
- browser storage is not a financial datastore.

---

## 9) Security / tenancy / recovery invariants

- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- browser never receives Service Role/private secrets.
- latest verified authenticated/anon executable public `SECURITY DEFINER` exposure = 0.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under current zero-charge/provider posture and must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.
- no new shared-client monkey patching; Operation Pipeline / UI Lifecycle / Money Runtime remain extension boundaries.

---

## 10) Strategic architecture — ADR-0023

ADR-0023 is **Accepted**. Official strategic modules:

1. Financial Control Tower;
2. Financial Digital Twin;
3. Working Capital Autopilot;
4. Continuous Close + Continuous Audit;
5. Iran Compliance Radar;
6. Counterparty 360;
7. Smart Procurement & Spend Control;
8. Avan Evidence Graph;
9. Avan Connect / Automation Marketplace.

Progress:

- Module 1: first scope Live PASS.
- Module 2: first scope Live PASS.
- Module 3: foundation Live PASS; controlled decision layer at Live Gate.
- Module 8: evidence foundation Live PASS and used by decision recommendations.
- Modules 4–7 and 9 remain planned.

Strategic thesis: **آوان فقط نمی‌گوید چه اتفاقی افتاده؛ می‌گوید چرا اتفاق افتاده، بعد چه می‌شود، و الان چه اقدام کنترل‌شده‌ای باید انجام شود.**

Guardrails: deterministic calculation before narrative; evidence before recommendation; Actual/Forecast/Scenario separation; no silent AI posting/payment; every important number should be drillable; scenario engine cannot mutate Actual Ledger; Company/RLS and one-Rial exactness apply everywhere.

---

## 11) Immediate Live gates

Latest user Live validation result:

1. the four primary Dashboard KPI amounts passed the exact-value Live check;
2. annual P&L / `چرا این عدد؟` consistency passed;
3. `اولویت‌های ده روز آینده` completed without the prior browser hang;
4. explicit confirmation received: **«Dashboard Exact KPI + 10-Day PASS»**.

Next accounting-quality task before certifying the entire Dashboard as exact: dedicated **Dashboard Accounting Correctness Audit** for legacy Aging / derived intelligence / risk / collection amounts.

Separately, **RC1.7-D Live PASS is still pending** and must not be inferred from the Dashboard confirmation.

---

## 12) Canonical current pointers

- Production runtime: **RC1.6**.
- Production merge: `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback: `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live merge: `b260c6995c233f097661082092767373416e1fe9`.
- Digital Twin Live merge: `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Working Capital + Evidence Live merge: `197503177b04b7f0fd30bedd2173645decb944ab`.
- RC1.7-D Engineering merge: `ba642265a33d43aca25937dac0721358dcb11a5c`.
- latest functional Staging merge: `10b9d83bef1764626c8fd4f2e8fda31f35bb3f27`.
- current Staging PWA cache: `avan-staging-rc1-v108-dashboard-accounting-correctness`.
- current Live validations pending: **RC1.7-D**.
- broader Dashboard Accounting Correctness Audit remains open as an engineering/accounting-quality task, not yet a Live PASS.
