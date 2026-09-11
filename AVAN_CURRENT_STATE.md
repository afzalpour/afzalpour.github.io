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

User supplied concrete dashboard/intelligence observations and requested correction before continuing. They were implemented in Staging through PR **#125**.

- PR #125 merge = `b53f958cb13cd311c63d21b1e44789a162d96747`.
- pre-merge Architecture Gate #213 = PASS.
- post-merge Architecture Gate #214 = PASS.
- Pages #362 = PASS.
- current Staging PWA cache = `avan-staging-rc1-v106-dashboard-intelligence-polish`.
- Production root was not changed.

Implemented polish:

- dashboard tables receive safe responsive wrappers so long numeric values cannot visually escape their table;
- `چرا این عدد؟` is Persian-first and user-facing: report amount is prominent in its own box;
- technical RPC/data-path explanatory box was removed from the main modal;
- calculation source, related accounts and ledger evidence remain available under collapsed `جزئیات محاسبه و شواهد` rather than cluttering the primary view;
- `Ledger Evidence`, `Drill-down`, report RPC names and other visible technical terms are Persianized;
- opening a journal from Why Number or Aging preserves the parent modal; `بستن` on the journal returns to that previous modal;
- the business-question area gained additional high-value prompts only for deterministic intents the current Copilot actually supports: AR, AP, cash, P&L and priorities;
- risk-factor cards now expose `چرا این عدد؟` with the deterministic rule/formula and data origin for liquidity coverage, >90-day receivables, customer concentration, supplier concentration and cash dependence on collections;
- Month-End / close-readiness visible descriptions are translated to natural Persian;
- receivable/payable aging tables are centered and currency-unit text is suppressed inside those tables only;
- Continuous Controls value column is centered and kept on one line;
- financial-analysis severity labels are color-coded by importance: critical/warning/attention/info/healthy;
- no accounting calculation, DB write path, local/session financial persistence or Production runtime was changed.

This patch has permanent regression coverage in `tests/dashboard-intelligence-live-polish.spec.mjs`.

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

Immediate validation for the user-observed polish:

1. Dashboard tables keep all numbers visually inside their table/container on desktop and mobile.
2. `چرا این عدد؟` is Persian, report amount is boxed, technical RPC/path box is gone, and detailed evidence is collapsed by default.
3. from Why Number/Aging, `مشاهده سند` → `بستن` returns to the originating modal.
4. business-question area shows additional useful supported questions.
5. risk factors expose `چرا این عدد؟` with understandable origin/formula.
6. Month-End descriptions are natural Persian.
7. aging tables are centered and do not show currency-unit text inside cells.
8. Continuous Controls value stays centered on one line.
9. financial-analysis status words are color-coded by severity.

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
- latest functional Staging merge: `b53f958cb13cd311c63d21b1e44789a162d96747`.
- current Staging PWA cache: `avan-staging-rc1-v106-dashboard-intelligence-polish`.
- current Live validations pending: **dashboard/intelligence polish** and **RC1.7-D**.
