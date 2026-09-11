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

---

## 5) RC1.7-C — Working Capital + Evidence Foundation

Status: **Engineering PASS + Live PASS**.

- PR #121 merged as `197503177b04b7f0fd30bedd2173645decb944ab`.
- Gate #206 caught an obsolete hard-coded PWA cache assertion.
- Gate #207 caught a real Shell regression: omitted `rc14-invoice-live-refinements.js`; it was restored without weakening the regression guard.
- final pre-merge Architecture Gate #208 = PASS.
- post-merge Architecture Gate #209 = PASS.
- Pages #358 = PASS.
- milestone cache = `avan-staging-rc1-v104-working-capital-evidence`.
- explicit user confirmation = **«Working Capital + Evidence Live PASS»**.

Implemented: canonical one-Rial Working Capital model; gross AR/AP by control accounts and real `party_id`; no cross-party netting; FIFO reduction allocation; invoice due-date aging with fallbacks; explainable collection priority; 30-day payable calendar; liquidity indicator; Evidence Graph links; explicit Company/RLS scope; zero autonomous collection/payment/posting and zero Actual Ledger mutation.

---

## 6) RC1.7-D — Evidence-backed Operational Decision Layer

Status: **Engineering PASS + Staging deployed; Live Gate pending**.

- PR #123 merged as `ba642265a33d43aca25937dac0721358dcb11a5c`.
- final pre-merge Architecture Gate #211 = PASS.
- post-merge Architecture Gate #212 = PASS.
- Pages #360 = PASS.
- milestone cache = `avan-staging-rc1-v105-working-capital-decisions`.

Implemented: deterministic collection recommendations; payable sequencing; exact one-Rial `cash before`/`cash after`; liquidity-gap recommendation; `چرا این پیشنهاد؟`; controlled Digital Twin handoff with real open amounts as editable seeds; no auto-run, no autonomous message/payment/posting, no DB write and no Actual Ledger mutation.

**RC1.7-D Live Gate remains PENDING until explicit user confirmation.**

---

## 7) Dashboard + Financial Intelligence / Accounting Correctness

Status: **Exact KPI + 10-Day = Engineering + Live PASS; broader Dashboard Accounting Correctness Audit = Engineering PASS + Staging deployed, Live Gate pending**.

### UI / interaction history

- PR #125 merge = `b53f958cb13cd311c63d21b1e44789a162d96747`; Gate #213/#214 PASS; Pages #362 PASS.
- PR #127 merge = `bef54fac6494fb96f4f6381d47bef76e992c9423`; Gate #215/#216 PASS; Pages #364 PASS.
- PR #129 merge = `10b9d83bef1764626c8fd4f2e8fda31f35bb3f27`; Gate #217/#218 PASS; Pages #366 PASS.
- explicit user confirmation after PR #129 = **«Dashboard Exact KPI + 10-Day PASS»**.

### Critical accounting-correctness finding

The previously displayed annual P&L `16,558,262,260 Rial` was incorrect. Direct PostgreSQL/Supabase verification showed, at the time of the check:

- income = `177,178,123.1 Toman`;
- expense = `11,595,500.5 Toman`;
- profit = `165,582,622.6 Toman` = **`1,655,826,226 Rial`**.

Root cause: legacy integer-oriented parsing did not preserve canonical decimal Toman values. PR #129 corrected the four primary Dashboard KPIs and their `چرا این عدد؟` amounts using canonical decimal↔tenths Money Core. It also removed the MutationObserver feedback loop behind the `اولویت‌های ده روز آینده` hang.

### Dashboard Accounting Correctness Audit — PR #132

Status: **Engineering PASS + Staging deployed; Live Gate pending**.

- PR #132 merge = `19679a6a6d076beb4e964a13298ede934cb179dd`.
- pre-merge Architecture Gate #219 = PASS.
- post-merge Architecture Gate #220 = PASS.
- Pages #369 = PASS.
- current Staging PWA cache = `avan-staging-rc1-v109-dashboard-accounting-correctness-audit`.
- Production root was not changed.

Audit finding: the integer-only defect was not limited to the four top KPIs. Legacy paths in Party Aging, Business Copilot, Smart Collection and Risk/Continuous Audit also used money parsing that could discard or corrupt one-Rial decimal amounts. Live database inspection confirmed the active Workspace contains real fractional-Toman control-account activity, including multiple AR/AP lines with one-Rial precision; therefore the defect was materially relevant.

PR #132 corrects the affected Dashboard-derived paths:

1. **Party Aging**
   - canonical decimal↔tenths arithmetic;
   - one-Rial exact FIFO allocation;
   - real `party_id`, no cross-party netting;
   - invoice match by `journal_entry_id`, fallback `source_id`;
   - due-date provenance: invoice due date → invoice date → entry date;
   - sub-Rial input rejected instead of rounded or silently converted to zero.

2. **Business Copilot**
   - assets/liabilities/profit/cash/AR/AP and overdue amounts use canonical exact money;
   - top-expense Ledger aggregation preserves one Rial;
   - exact money comparisons replace JavaScript/string/legacy-BigInt comparisons;
   - no AI-generated accounting amount.

3. **Smart Collection**
   - party balance, overdue balance, 90+ balance and Top-3 cash opportunity use exact tenths internally;
   - public output remains canonical decimal Toman for Money Runtime;
   - prioritization remains deterministic and Human-Controlled.

4. **Risk Radar / Continuous Audit**
   - cash-gap, overdue, duplicate invoice/transaction amounts and unusual-amount detection use exact canonical money;
   - statistical comparisons use exact integer tenths, not floating money arithmetic;
   - findings remain deterministic rules, not AI-generated financial truth.

5. **Authoritative Dashboard re-hydration**
   - Business Copilot and cash-dependent Risk factors are rehydrated read-only after page render from the active company;
   - every table read includes explicit `workspace_id` filtering;
   - authoritative report RPCs provide balance sheet, P&L and cash/bank inputs;
   - no insert/update/delete, no financial browser persistence and no schema/database mutation.

Regression tests now explicitly cover `0.1 Toman = 1 Rial`, FIFO AR/AP, no cross-party netting, exact expense totals, Smart Collection, Risk findings, sub-Rial rejection and the previously verified real P&L pattern.

### Existing polish retained

- top KPI cards retain single-line numeric fit;
- `چرا این عدد؟` amount card remains full-width;
- suggested business questions only select/fill and wait for explicit `تحلیل کن`;
- technical `منبع` display remains hidden by the polish layer;
- `اولویت‌های ده روز آینده` remains non-hanging and explicitly non-forecast;
- Smart Collection table retains stable no-break / horizontal containment;
- Continuous Controls `سطح` remains protected from letter splitting;
- negative accounting presentation remains Presentation Layer only.

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

### Dashboard Accounting Correctness Audit Live Gate

After Hard Refresh on Staging verify:

1. `مطالبات باز` / `مطالبات سررسیدگذشته` and `بدهی تجاری باز` / `بدهی سررسیدگذشته` render normally and their detail rows open without errors.
2. `از آوان درباره کسب‌وکار بپرس` still requires explicit `تحلیل کن`; test at least `وضعیت مطالبات`, `نقدینگی فعلی`, `سود یا زیان دوره` and `اولویت‌های ده روز آینده`.
3. Smart Collection renders customer names and amounts normally; `مانده`, `سررسیدگذشته` and Top-3 opportunity are not blank/zero merely because the Ledger contains `.1 Toman` values.
4. Risk Radar / Continuous Audit loads without error and amount-based factors/findings display normally.
5. primary P&L remains consistent with its `چرا این عدد؟` exact amount.
6. no journal, receipt, payment, invoice or Actual balance is created/changed by opening or using these intelligence sections.

Required explicit confirmation after validation: **«Dashboard Accounting Correctness Audit Live PASS»**.

Separately, **RC1.7-D Live PASS is still pending** and must not be inferred from this Dashboard audit.

---

## 12) Canonical current pointers

- Production runtime: **RC1.6**.
- Production merge: `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback: `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live merge: `b260c6995c233f097661082092767373416e1fe9`.
- Digital Twin Live merge: `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Working Capital + Evidence Live merge: `197503177b04b7f0fd30bedd2173645decb944ab`.
- RC1.7-D Engineering merge: `ba642265a33d43aca25937dac0721358dcb11a5c`.
- Dashboard Exact KPI / 10-Day merge: `10b9d83bef1764626c8fd4f2e8fda31f35bb3f27` — Live PASS.
- latest functional Staging merge: `19679a6a6d076beb4e964a13298ede934cb179dd`.
- current Staging PWA cache: `avan-staging-rc1-v109-dashboard-accounting-correctness-audit`.
- current Live validations pending: **Dashboard Accounting Correctness Audit** and **RC1.7-D**.
