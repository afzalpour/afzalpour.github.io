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
- RC1.6 Production Smoke = **PASS** by explicit user confirmation.
- pre-RC1.6 rollback branch = `prod-backup-20260910-rc1-6-pre-promotion`.
- Later RC1.7 commits on `main` modify `avan-staging/**` and/or docs only; **Production root runtime remains RC1.6** until a future explicit Production Release Gate.

Explicit user confirmation:

**«RC1.6 Production Smoke PASS — Control Tower Live PASS»**

---

## 2) RC1.6 accepted scope

RC1.6 is released and its implemented scope is accepted:

1. **RC1.6-A — Bank Reconciliation Foundation** — Engineering/Backend PASS.
2. **RC1.6-B — Bank Statement Import + Reconciliation UI** — Engineering PASS + Live PASS for implemented scope.
3. **RC1.6-C — Party Ledger / صورتحساب مالی طرف‌حساب** — Engineering PASS + Full Live PASS.
4. global accounting-negative presentation — Live accepted: negative values remain signed internally but appear visually as red `(amount)` without a visible minus.
5. exact one-Rial receipt/payment/transfer and real ESC-delimited bank statement import — Live accepted.
6. Party Ledger print/PDF, Jalali range, gross AR/AP without auto-offset — Live accepted.

Production promotion completed only after the RC1.6 Release Candidate / Production Release Gate and explicit user approval:

**«RC1.6 Production Release APPROVED»**

---

## 3) RC1.7-A — Avan Financial Control Tower

Status: **Engineering PASS + Live PASS**.

PR: **#118 — Intelligence Foundation: Control Tower + Financial Digital Twin**.

Staging merge commit: `b260c6995c233f097661082092767373416e1fe9`.

Evidence:

- final pre-merge Architecture Gate #202 = PASS;
- post-merge Architecture Gate #203 = PASS;
- Pages #355 = PASS;
- explicit user Live PASS = **«RC1.6 Production Smoke PASS — Control Tower Live PASS»**.

Implemented Control Tower scope:

- Company/RLS-scoped snapshot service;
- cash/bank position from active financial-account Ledger lines;
- gross receivables and payables by real `party_id`, with no cross-party netting;
- unresolved bank reconciliation metric;
- inventory financial-reconciliation risk metric;
- deterministic close-readiness blockers;
- prioritized control actions;
- `چرا این عدد؟` evidence drilldown;
- Persian-first / Jalali / responsive UI;
- exact 0.1 Toman = 1 Rial precision;
- no AI-generated financial amounts;
- no financial write path.

**RC1.7-A Live Gate = PASS.**

---

## 4) RC1.7-B — Financial Digital Twin / دوقلوی مالی

Status: **Engineering PASS; Live Gate pending user validation**.

PR: **#119 — RC1.7-B: Financial Digital Twin first live workspace**.

Staging merge commit: `d522dd47d825adc7e0458ca3d755c3752ccde069`.

Evidence:

- PR Architecture Gate #204 = PASS;
- post-merge Architecture Gate #205 = PASS;
- Pages #356 = PASS;
- Staging PWA cache = `avan-staging-rc1-v103-financial-digital-twin`.

Implemented first-live scope:

- opening cash/bank comes from the real Control Tower/Ledger position through end of the day before the selected scenario horizon;
- all future flows are explicit user inputs; the system does not invent forecast amounts;
- Base inputs:
  - cash sales from new sales;
  - collections from existing receivables;
  - operating cash costs;
  - payments of payables/debts;
- Scenario inputs:
  - percentage change for each Base flow, represented internally in basis points;
  - optional signed one-off cash impact;
- cash sales are explicitly separated from accrual/credit sales so sales and collections are not double-counted;
- results show Base ending cash, Scenario ending cash and delta;
- liquidity stress is flagged when Scenario ending cash is negative;
- any proportional sub-Rial remainder is disclosed and rounded by the established nearest-Rial rule; no silent money rounding;
- opening cash exposes evidence references;
- scenario data is not persisted to browser storage or financial DB;
- scenario engine cannot mutate Actual Ledger;
- AI does not generate arithmetic or financial amounts;
- access points: desktop sidebar, Reports launcher and Control Tower handoff;
- responsive Persian-first UI; date inputs use the existing Jalali presentation layer.

### RC1.7-B Live Gate checklist

1. Staging Hard Refresh / PWA cache refresh.
2. `هوشمندی مالی → دوقلوی مالی` opens successfully; mobile access works through Reports.
3. opening `نقد و بانک ابتدای سناریو` appears and `منشأ این عدد` opens evidence.
4. enter Base cash flows and percentage changes; calculation returns Base vs Scenario.
5. negative one-off cash impact works and accounting-negative presentation remains correct.
6. changing the horizon reloads opening cash for the end of the prior day.
7. result does not create any document/receipt/payment or change actual balances.
8. one-Rial inputs remain exact.

Until explicit browser confirmation, **RC1.7-B Live Gate remains PENDING**.

---

## 5) Governing accounting / money invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- Canonical money = **Toman with 0.1 Toman = 1 Rial**.
- `1515 Rial` persists losslessly as `151.5 Toman`.
- sub-Rial values are rejected or, only where proportional scenario math inherently creates a sub-Rial remainder, rounded under an explicitly disclosed deterministic rule; silent rounding is forbidden.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Party outstanding position is derived from configured AR/AP control accounts and exact `party_id`.
- gross receivable/payable remain separate; no automatic cross-party or AR/AP offset.
- negative accounting notation `(amount)` is Presentation Layer only; signed truth remains unchanged in Core/DB/API.
- account hierarchy is structural; only valid leaves are postable.
- browser storage is not a financial datastore.

---

## 6) Security / tenancy / recovery invariants

- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- browser never receives Service Role/private secrets.
- authenticated-executable public `SECURITY DEFINER` = 0 at latest verified release security check.
- anon-executable public `SECURITY DEFINER` = 0 at latest verified release security check.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under the current zero-charge/provider posture and must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.
- no new shared-client monkey patching; Operation Pipeline / UI Lifecycle / Money Runtime are the extension boundaries.

---

## 7) Strategic architecture — ADR-0023

ADR-0023 is **Accepted**. Official strategic modules:

1. Avan Financial Control Tower — برج کنترل مالی;
2. Financial Digital Twin — دوقلوی مالی کسب‌وکار;
3. Working Capital Autopilot — اتوپایلوت سرمایه در گردش;
4. Continuous Close + Continuous Audit — بستن و حسابرسی مستمر;
5. Iran Compliance Radar — رادار هوشمند تعهدات قانونی ایران;
6. Counterparty 360 — پرونده مالی هوشمند طرف‌حساب;
7. Smart Procurement & Spend Control — خرید و کنترل هزینه هوشمند;
8. Avan Evidence Graph — گراف شواهد مالی;
9. Avan Connect / Automation Marketplace — پلتفرم اتصال و اتوماسیون.

Modules 1 and 2 are Early Priority. Module 1 is now Live accepted; Module 2 is at its first Live Gate.

Strategic thesis:

**آوان فقط نمی‌گوید چه اتفاقی افتاده؛ می‌گوید چرا اتفاق افتاده، بعد چه می‌شود، و الان چه اقدام کنترل‌شده‌ای باید انجام شود.**

Guardrails:

- deterministic financial calculation before narrative;
- evidence before recommendation;
- Actual vs Forecast vs Scenario explicitly separated;
- no silent AI posting/payment;
- every important number should be drillable to evidence;
- scenario engine cannot mutate Actual Ledger;
- Company/RLS and one-Rial exactness apply to all intelligence layers.

---

## 8) Immediate next gate

Immediate gate: **RC1.7-B Financial Digital Twin Live Gate**.

After explicit Live PASS, next implementation cycle is:

**RC1.7-C — Digital Twin evidence/decision layer + Working Capital decision primitives**

Planned boundary:

- enrich scenario evidence and assumption traceability;
- scenario comparison presets without inventing amounts;
- controlled decision recommendations built on deterministic results;
- begin Working Capital primitives using receivable/payable aging and cash constraints;
- no autonomous posting/payment;
- Production remains RC1.6 until a separate future Release Candidate + explicit Production Release Gate.

---

## 9) Canonical current pointers

- Production runtime release: **RC1.6**.
- Production release merge: `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback: `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live-accepted Staging merge: `b260c6995c233f097661082092767373416e1fe9`.
- Latest functional Staging merge: `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Staging PWA cache: `avan-staging-rc1-v103-financial-digital-twin`.
- Current Live blocker: **Financial Digital Twin browser/PWA Live confirmation only**.
