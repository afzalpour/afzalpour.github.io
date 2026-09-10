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
- RC1.7 work remains Staging-only unless a future explicit Production Release Gate authorizes promotion.

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

Production promotion completed only after Release Candidate Gate and explicit user approval:

**«RC1.6 Production Release APPROVED»**

---

## 3) RC1.7-A — Avan Financial Control Tower

Status: **Engineering PASS + Live PASS**.

- PR #118 merged as `b260c6995c233f097661082092767373416e1fe9`.
- final pre-merge Architecture Gate #202 = PASS.
- post-merge Architecture Gate #203 = PASS.
- Pages #355 = PASS.
- explicit user Live PASS = **«RC1.6 Production Smoke PASS — Control Tower Live PASS»**.

Implemented scope:

- Company/RLS-scoped snapshot service;
- cash/bank position from active financial-account Ledger lines;
- gross receivables/payables by real `party_id`, with no cross-party netting;
- unresolved bank reconciliation and inventory-control risk;
- deterministic close-readiness blockers and prioritized control actions;
- `چرا این عدد؟` evidence drilldown;
- Persian-first / Jalali / responsive UI;
- exact one-Rial precision;
- no AI-generated financial amounts and no financial write path.

### Deferred Live polish

After Live PASS the user reported that **Control Tower has several minor issues** and explicitly requested that they be handled later. Exact issue details are not yet supplied. This does **not** revoke the Live PASS; it is tracked as a separate polish backlog and must not be guessed/fixed speculatively.

---

## 4) RC1.7-B — Financial Digital Twin / دوقلوی مالی

Status: **Engineering PASS + Live PASS**.

- PR #119 merged as `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- PR Architecture Gate #204 = PASS.
- post-merge Architecture Gate #205 = PASS.
- Pages #356 = PASS.
- Staging cache at this milestone = `avan-staging-rc1-v103-financial-digital-twin`.
- explicit user acceptance = **«Financial Digital Twin Live PASS»**.

Implemented first-live scope:

- opening cash/bank comes from the real Control Tower/Ledger position through end of the day before the scenario horizon;
- all future flows are explicit user inputs; the system does not invent forecast amounts;
- Base flows = cash sales, collections, operating cash costs and payable/debt payments;
- cash sales are separated from accrual sales to prevent double-counting with collections;
- Scenario inputs = percentage changes represented internally in basis points + optional signed one-off cash impact;
- Base ending cash, Scenario ending cash, delta and liquidity stress are deterministic;
- proportional sub-Rial remainder is disclosed before deterministic nearest-Rial rounding; no silent rounding;
- opening cash exposes evidence references;
- no browser/DB scenario persistence, no Actual Ledger mutation and no AI-generated financial amounts.

### Deferred Live polish

After Live PASS the user reported that **Financial Digital Twin has several minor issues** and requested that they be handled later. Exact details are pending. This is a polish backlog, not a rollback of Live acceptance.

---

## 5) RC1.7-C — Working Capital + Evidence Foundation

Status: **Engineering PASS + Staging deployed; Live Gate pending**.

- PR #121 merged as `197503177b04b7f0fd30bedd2173645decb944ab`.
- Gate #206 correctly blocked an obsolete hard-coded PWA cache assertion.
- Gate #207 then caught a real Shell regression: `rc14-invoice-live-refinements.js` had been omitted during index wiring.
- the required legacy script was restored; no regression guard was weakened.
- final pre-merge Architecture Gate #208 = PASS.
- post-merge Architecture Gate #209 = PASS.
- Pages #358 = PASS.
- current Staging PWA cache = `avan-staging-rc1-v104-working-capital-evidence`.

Implemented scope:

- deterministic Working Capital model using the canonical one-Rial Money Core;
- gross AR/AP derived from configured control accounts and real `party_id`;
- no cross-party netting;
- FIFO allocation of reductions against open party exposures;
- invoice `due_date` used when available, with explicit invoice-date / entry-date fallback provenance;
- rule-based collection priority by days past due, with no opaque AI score;
- 30-day payable calendar;
- cash less overdue + 30-day payable obligations indicator;
- first Evidence Graph primitive linking open items to party, journal entry, journal line and invoice;
- Company/RLS-scoped read-only service with explicit `workspace_id` on every Data API query;
- Persian-first responsive workspace through sidebar and Reports;
- no autonomous collection message, payment, posting or Actual Ledger mutation;
- no new DB table/RPC/DDL in this release slice.

Important technical correction: legacy `src/reports/party-aging.js` uses integer-oriented `BigInt(String(value))` assumptions and is **not** the numeric source for RC1.7-C. The new model uses canonical decimal↔tenths helpers so values such as `100.1 Toman` remain exact.

**Current Live blocker = RC1.7-C browser/PWA validation only.**

---

## 6) Governing accounting / money invariants

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

## 7) Security / tenancy / recovery invariants

- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- browser never receives Service Role/private secrets.
- authenticated-executable public `SECURITY DEFINER` = 0 at latest verified release security check.
- anon-executable public `SECURITY DEFINER` = 0 at latest verified release security check.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under current zero-charge/provider posture and must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.
- no new shared-client monkey patching; Operation Pipeline / UI Lifecycle / Money Runtime are extension boundaries.

---

## 8) Strategic architecture — ADR-0023

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

Progress against this architecture:

- Module 1 Control Tower: first scope Live PASS.
- Module 2 Digital Twin: first scope Live PASS.
- Modules 3 and 8: foundations started in RC1.7-C.
- Modules 4–7 and 9 remain planned and must be introduced at the highest-value architectural points rather than by feature-count pressure.

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

## 9) Immediate next gate

Immediate gate: **RC1.7-C Working Capital + Evidence Live Gate**.

Live validation must confirm:

1. `هوشمندی مالی → سرمایه در گردش` opens after Staging hard refresh; mobile access works through Reports.
2. cash, gross receivables/payables, overdue amounts and 30-day payable view populate without UI failure.
3. collection priorities are explainable/rule-based and do not silently net different parties.
4. payable calendar uses visible due dates and open amounts.
5. `شواهد` opens trace references for priority/open items.
6. one-Rial amounts remain exact where present.
7. no receipt/payment/journal/message is created and Actual Ledger remains unchanged.

After RC1.7-C Live PASS, next planned implementation boundary is **RC1.7-D — evidence-backed decision actions / Working Capital controlled recommendations**, while preserving human confirmation and zero autonomous financial mutation.

The minor Control Tower / Digital Twin polish backlog remains open for later exact user-supplied fixes.

---

## 10) Canonical current pointers

- Production runtime release: **RC1.6**.
- Production release merge: `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback: `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live-accepted Staging merge: `b260c6995c233f097661082092767373416e1fe9`.
- Financial Digital Twin Live-accepted Staging merge: `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Latest functional Staging merge: `197503177b04b7f0fd30bedd2173645decb944ab`.
- Current Staging PWA cache: `avan-staging-rc1-v104-working-capital-evidence`.
- Current Live blocker: **RC1.7-C browser/PWA Live confirmation only**.
