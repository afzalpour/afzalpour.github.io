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

## 7) Dashboard + Financial Intelligence Live Polish

Status: **Engineering PASS + Staging deployed; Live validation pending**.

The first explicit polish pass was implemented through PR **#125** and then a second Live-fix pass was required after the user reported remaining layout/interaction regressions.

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
- current Staging PWA cache = `avan-staging-rc1-v107-dashboard-intelligence-live-fix-v2`.
- Production root was not changed.

Implemented / corrected:

- top dashboard KPI cards (دارایی، بانک و صندوق و peer cards) now have their own single-line numeric fit contract; this corrects the prior mistake where only HTML tables were protected;
- `چرا این عدد؟` amount card now spans the complete grid width and dynamically fits long values rather than breaking inside a narrow grid column;
- all suggested business questions now only populate the question field; analysis runs only after explicit user action on `تحلیل کن`;
- user-facing business answers no longer display the technical `منبع` label;
- the duplicate priority prompts were consolidated: `اولویت‌های امروز` is replaced with `اولویت‌های ده روز آینده`; the result is explicitly framed as a 10-day management attention plan based on current recorded state, not a forecast of future events;
- the Smart Collection table now uses a stable presentation contract with horizontal containment, minimum table width, no forced breaking of customer name / `قدیمی‌ترین` / amount columns, and no currency-unit text inside amount cells;
- Continuous Controls `سطح` is protected from word/letter splitting;
- prior Why Number Persianization, collapsed evidence details, journal-back behavior, risk explanations, centered aging tables and severity color coding remain active;
- no accounting calculation, DB/RPC behavior, Company/RLS boundary, financial write path, browser financial persistence or Production runtime was changed.

Regression coverage remains in `tests/dashboard-intelligence-live-polish.spec.mjs` and now includes the second Live-fix contract.

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

Immediate validation for the second user-observed dashboard/intelligence polish pass:

1. the four top dashboard KPI cards keep their full numbers visually inside the card;
2. `چرا این عدد؟` keeps the report amount unbroken inside a full-width amount box;
3. every suggested business question only selects/fills the query and waits for explicit `تحلیل کن`;
4. business answers do not show `منبع`;
5. only one priority-style shortcut remains and it is `اولویت‌های ده روز آینده`;
6. Smart Collection table keeps `قدیمی‌ترین`, customer names and amount columns unbroken, with no currency unit inside amount cells;
7. Continuous Controls `سطح` does not split letters/words.

Separately, **RC1.7-D Live PASS is still pending** and must not be inferred from this polish validation.

---

## 12) Canonical current pointers

- Production runtime: **RC1.6**.
- Production merge: `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback: `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live merge: `b260c6995c233f097661082092767373416e1fe9`.
- Digital Twin Live merge: `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Working Capital + Evidence Live merge: `197503177b04b7f0fd30bedd2173645decb944ab`.
- RC1.7-D Engineering merge: `ba642265a33d43aca25937dac0721358dcb11a5c`.
- latest functional Staging merge: `bef54fac6494fb96f4f6381d47bef76e992c9423`.
- current Staging PWA cache: `avan-staging-rc1-v107-dashboard-intelligence-live-fix-v2`.
- current Live validations pending: **dashboard/intelligence polish v2** and **RC1.7-D**.
