# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-12**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production runtime**.
- `avan-staging/` = **Staging / next-release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Supabase project status on 2026-09-12 = **ACTIVE_HEALTHY**, PostgreSQL **17.6**.
- Production current release = **RC1.6**.
- RC1.6 Production release PR = **#117**.
- RC1.6 Production merge = `eace3198947da1e87deb5d5512b905b27975c74e`.
- RC1.6 Production Smoke = **PASS**.
- pre-RC1.6 rollback branch = `prod-backup-20260910-rc1-6-pre-promotion`.
- RC1.7 remains **Staging-only** until RC1.7-D full Live closure, RC freeze, final regression, rollback point, Production Release Gate and explicit user release approval.

---

## 2) RC1.6 accepted scope

RC1.6 is released and accepted:

1. **RC1.6-A — Bank Reconciliation Foundation** — Engineering/Backend PASS.
2. **RC1.6-B — Bank Statement Import + Reconciliation UI** — Engineering + Live PASS for implemented scope.
3. **RC1.6-C — Party Ledger** — Engineering + Full Live PASS.
4. exact one-Rial receipt/payment/transfer and real bank-statement import = Live accepted.
5. Party Ledger print/PDF, Jalali range and gross AR/AP without auto-offset = Live accepted.
6. accounting-negative presentation keeps signed truth and renders negatives as red `(amount)` only in Presentation Layer.

---

## 3) RC1.7-A — Avan Financial Control Tower

Status: **Engineering PASS + Live PASS**.

- PR #118 merge = `b260c6995c233f097661082092767373416e1fe9`.
- Gate #202/#203 = PASS; Pages #355 = PASS.

Accepted scope: Company/RLS-scoped cash/bank, gross AR/AP by real `party_id`, bank/inventory risk indicators, deterministic close-readiness blockers, prioritized actions, `چرا این عدد؟`, Persian/Jalali responsive UI, exact one-Rial precision, zero AI-generated accounting amount and zero financial write path.

---

## 4) RC1.7-B — Financial Digital Twin

Status: **Engineering PASS + Live PASS**.

- PR #119 merge = `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Gate #204/#205 = PASS; Pages #356 = PASS.
- explicit user confirmation = **«Financial Digital Twin Live PASS»**.

Accepted scope: real opening cash/bank, explicit scenario flows, deterministic Base vs Scenario cash, liquidity stress, evidence for opening cash, no scenario persistence, no Actual Ledger mutation and no AI arithmetic.

---

## 5) RC1.7-C — Working Capital + Evidence Foundation

Status: **Engineering PASS + Live PASS**.

- PR #121 merge = `197503177b04b7f0fd30bedd2173645decb944ab`.
- final Gate #208/#209 = PASS; Pages #358 = PASS.
- explicit user confirmation = **«Working Capital + Evidence Live PASS»**.

Accepted scope: one-Rial Working Capital model; gross AR/AP by real `party_id`; no cross-party netting; FIFO reduction allocation; invoice due-date aging/fallbacks; collection priority; 30-day payable calendar; liquidity indicator; Evidence links; Company/RLS scope; no autonomous collection/payment/posting and no Actual Ledger mutation.

---

## 6) RC1.7-D — Evidence-backed Operational Decision Layer

Status: **Engineering PASS; human-readable Evidence correction Live PASS; full RC1.7-D functional Live closure still pending explicit confirmation**.

Foundation:
- PR #123 merge = `ba642265a33d43aca25937dac0721358dcb11a5c`.
- Gate #211/#212 = PASS; Pages #360 = PASS.

Latest Evidence correction:
- PR #147 = **RC1.7-D fix: human-readable decision evidence**.
- merge = `8060b93fbdec3b35de6c0d1ae5552022e6e69537`.
- pre-merge Architecture Gate #259 = **PASS**.
- raw UUID presentation in `چرا این پیشنهاد؟` replaced with accounting-facing labels for party, journal no/date/source, invoice no/due date and related open amount.
- explicit user confirmation on 2026-09-12 = **«RC1.7-D Evidence Readable PASS»**.

Implemented scope: deterministic collection recommendations; payable sequencing; exact one-Rial `cash before`/`cash after`; liquidity-gap recommendation; `چرا این پیشنهاد؟`; controlled Digital Twin handoff with real open amount as editable seed; no auto-run; no autonomous message/payment/posting; no DB write and no Actual Ledger mutation.

**Do not infer full RC1.7-D Live PASS from the narrower Evidence Readable PASS.**

---

## 7) Dashboard + Financial Intelligence / Accounting Correctness

Status: **Engineering PASS + Full Live PASS for current RC1.7 scope**.

Key history:
- PR #129 corrected the factor-of-10 defect in primary Dashboard KPIs and `چرا این عدد؟`; explicit user confirmation = **«Dashboard Exact KPI + 10-Day PASS»**.
- verified real P&L reference at the time: income `177,178,123.1 Toman`, expense `11,595,500.5 Toman`, profit `165,582,622.6 Toman` = **`1,655,826,226 Rial`**.
- PR #132 audited Party Aging, Business Copilot, Smart Collection and Risk/Continuous Audit for canonical decimal↔tenths exact money.
- PRs #134–#140 refined Business Evidence, accounting negatives, Aging units, effective FIFO journals, PWA delivery and Continuous Controls presentation.
- PR #141 added one-Rial exact Natural Reports.
- PR #142 added authoritative exact report runtime.
- PR #143 added hierarchical account rollup through a SECURITY INVOKER reporting boundary.
- explicit user confirmation on 2026-09-12 = **«Dashboard Accounting Correctness Audit Live PASS»**.

Accepted contracts:
- `0.1 Toman = 1 Rial` exactness;
- FIFO AR/AP with real `party_id` and no cross-party netting;
- due-date provenance and evidence journals;
- deterministic Smart Collection and Risk rules;
- explicit `workspace_id` scoping;
- no insert/update/delete from intelligence views and no financial browser persistence.

---

## 8) RC1.7-E — Counterparty 360 Foundation

Status: **Engineering PASS + Live PASS for current foundation scope**.

History:
- PR #138 = complete counterparty master data; additive migration applied and verified on `Avan-production`.
- PR #144 = Counterparty 360 foundation.
- PR #145 = Live UI stabilization hotfix.
- PR #146 = mutation-free Counterparty 360 action path / flashing elimination; Gate #257 = PASS.
- explicit user confirmation on 2026-09-12 = **«Counterparty 360 Live PASS»**.

Accepted foundation scope:
- master-data identity/tax profile;
- exact one-Rial AR/AP Aging with receivable/payable kept separate;
- overdue/open items;
- Party Ledger movements;
- recent invoices;
- origin/evidence journals;
- deterministic risk/data-completeness flags;
- responsive stable `نمای ۳۶۰` modal;
- read-only behavior, no cross-party netting and no financial writes.

---

## 9) RC1.7 release-closure engineering gate

- PR #148 refreshed this Source of Truth after repository/Supabase reconciliation.
- PR #149 added a permanent **RC1.7 Release Closure Regression Gate** to the Staging architecture suite.
- PR #149 merge = `55a447f9492ebe5e61b2cd77e666c7a3de92cb50`.
- pre-merge Architecture Gate #261 = **PASS**.
- post-merge Architecture Gate #262 = **PASS**.
- Gate verifies RC1.7 modules are wired/pre-cached in Staging while Production root remains RC1.6 before explicit promotion.
- no accounting logic, schema or Production runtime was changed by #148/#149.

---

## 10) Backend / accounting certification snapshot — 2026-09-12

Direct read-only verification on `Avan-production`:

- public financial/application tables inspected = RLS enabled.
- orphan journal lines = **0**.
- cross-workspace journal-line mismatches = **0**.
- unbalanced Posted journals = **0**.
- orphan invoice lines = **0**.
- cross-workspace invoice-line mismatches = **0**.
- journal lines containing fractional Toman values = **42**; one-Rial exactness is materially exercised by real data.
- effective anon/auth executable public `SECURITY DEFINER` exposure = **0** under the established privilege boundary.

Supabase Security Advisor still reports:
- built-in **Leaked Password Protection disabled**; acknowledged provider/plan limitation, not falsely marked fixed.
- INFO notices for RLS-enabled tables without policies include private/internal tables and `public.workspace_invitations`; review against intentional RPC-only/private contracts before any policy change. Do not add permissive policies merely to silence the advisor.

---

## 11) Governing accounting / money invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- canonical money = **Toman with 0.1 Toman = 1 Rial**.
- `1515 Rial` persists losslessly as `151.5 Toman`.
- no silent sub-Rial rounding.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- gross receivable/payable remain separate; no automatic AR/AP or cross-party offset.
- account hierarchy is structural; only valid leaves are postable.
- browser storage is not a financial datastore.
- negative `(amount)` notation is Presentation Layer only.

---

## 12) Security / tenancy / recovery invariants

- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- browser never receives Service Role/private secrets.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains OPEN; never restore against `Avan-production` itself.
- no new shared-client monkey patching; Operation Pipeline / UI Lifecycle / Money Runtime remain extension boundaries.

---

## 13) Strategic architecture — ADR-0023

ADR-0023 is **Accepted**. Official capabilities:

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
- Module 3: foundation Live PASS; Decision Layer has readable Evidence PASS and awaits final functional Live closure.
- Module 6: Counterparty 360 foundation Live PASS.
- Module 8: Evidence foundation Live PASS and used across recommendations/Counterparty views.
- Modules 4, 5, 7 and 9 remain planned after RC1.7 release boundary.

Guardrails: deterministic calculation before narrative; evidence before recommendation; Actual/Forecast/Scenario separation; no silent AI posting/payment; every important number drillable; Company/RLS and one-Rial exactness everywhere.

---

## 14) Immediate Live closure gate — ONLY RC1.7-D remains

Dashboard Accounting Correctness and Counterparty 360 are now explicitly Live PASS.

### RC1.7-D final functional Live closure

Open **مرکز سرمایه در گردش** and validate both decision paths:

1. **Collection recommendation**
   - under `پیشنهادهای کنترل‌شده وصول`, choose a row and click `چرا این پیشنهاد؟`;
   - recommendation reason, open/overdue amount and human-readable Evidence must agree;
   - click `آزمایش وصول در دوقلو`;
   - Financial Digital Twin must open with the row's real overdue amount prefilled in `وصول مطالبات`;
   - the amount must remain editable and the scenario must **not** calculate automatically; calculation occurs only after explicit `محاسبه سناریو`.

2. **Payment recommendation**
   - under `پیشنهادهای کنترل‌شده پرداخت`, choose a row;
   - confirm `تعهد باز` and `نقد پس از این ردیف` render normally;
   - click `چرا این پیشنهاد؟` and confirm `تعهد`, `نقد قبل از این ردیف`, `نقد پس از این ردیف` and Evidence are coherent;
   - click `آزمایش پرداخت در دوقلو`;
   - Financial Digital Twin must open with the row's real open amount prefilled in `پرداخت بدهی‌ها`, editable and not auto-run.

3. **No Actual mutation**
   - merely opening Evidence, Decision Layer or Digital Twin must not create journal, receipt, payment or change Actual balances.

Required confirmation: **«RC1.7-D Live PASS»**.

Only after this PASS: freeze RC1.7, run final release regression, create rollback point and prepare the explicit **RC1.7 Production Release Gate**. Do not promote before explicit user release approval.

---

## 15) Canonical current pointers

- Production runtime = **RC1.6**.
- Production merge = `eace3198947da1e87deb5d5512b905b27975c74e`.
- Production rollback = `prod-backup-20260910-rc1-6-pre-promotion`.
- Control Tower Live merge = `b260c6995c233f097661082092767373416e1fe9`.
- Digital Twin Live merge = `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Working Capital + Evidence Live merge = `197503177b04b7f0fd30bedd2173645decb944ab`.
- RC1.7-D foundation merge = `ba642265a33d43aca25937dac0721358dcb11a5c`.
- Dashboard Exact KPI / 10-Day merge = `10b9d83bef1764626c8fd4f2e8fda31f35bb3f27` — Live PASS.
- RC1.7-D readable Evidence merge = `8060b93fbdec3b35de6c0d1ae5552022e6e69537` — Evidence Readable Live PASS.
- RC1.7 Release Closure Gate merge = `55a447f9492ebe5e61b2cd77e666c7a3de92cb50` — Gate #261/#262 PASS.
- current Staging service-worker cache identity = `avan-staging-rc1-v109-dashboard-live-contract-v3` with fresh-network delivery safeguards and release-closure regression coverage.
- current Live validation pending = **RC1.7-D full functional closure only**.
