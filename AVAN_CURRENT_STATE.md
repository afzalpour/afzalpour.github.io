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
- RC1.7 remains **Staging-only** until RC freeze, final regression, rollback point, Production Release Gate and explicit user release approval.

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

Status: **Engineering PASS + Full Live PASS**.

Foundation:
- PR #123 merge = `ba642265a33d43aca25937dac0721358dcb11a5c`.
- Gate #211/#212 = PASS; Pages #360 = PASS.

Evidence correction:
- PR #147 = **RC1.7-D fix: human-readable decision evidence**.
- merge = `8060b93fbdec3b35de6c0d1ae5552022e6e69537`.
- pre-merge Architecture Gate #259 = **PASS**.
- raw UUID presentation in `چرا این پیشنهاد؟` replaced with accounting-facing labels for party, journal no/date/source, invoice no/due date and related open amount.
- explicit user confirmation = **«RC1.7-D Evidence Readable PASS»**.

Digital Twin handoff blocker and correction:
- initial Live attempt exposed `وصول مطالبات معتبر نیست` and `پرداخت بدهی‌ها معتبر نیست` only after explicit `محاسبه سناریو`.
- root cause: canonical Toman seeds crossed into fields interpreted in the active display unit, while the legacy integer parser rejected fractional-Toman / exact one-Rial inputs.
- PR #151 corrected canonical→display handoff and exact decimal fallback without changing successful legacy integer behavior.
- regression locks `104,692.8 Toman ↔ 1,046,928 Rial ↔ 104,692.8 Toman`.
- PR #151 merge = `dc7d6b7892ac1f8f3762cd30cee9293c95fe8f6e`.
- pre-merge Architecture Gate #264 = **PASS**; post-merge Gate #265 = **PASS**; Pages #394 = **PASS**.
- explicit final user confirmation = **«RC1.7-D Live PASS — Handoff Fixed»**.

Final Digital Twin numeric-entry polish:
- user requested all eight primary editable Digital Twin numeric fields to use live three-digit grouping, consistent with the rest of Avan.
- PR #153 routes the 8 primary fields through the central Money Input Lifecycle and also groups `اثر نقدی یک‌باره سناریو` for consistency.
- thousands separator = Persian `٬`; signed decimal values remain supported for percentage changes and one-off cash impact.
- no scenario arithmetic, accounting logic, persistence, Actual Ledger or Production runtime change.
- PR #153 merge = `7c67eec784e18c21fd7b8be27adf5f90ca77b7bf`.
- pre-merge Architecture Gate #266 = **PASS**; post-merge Gate #267 = **PASS**; Pages #396 = **PASS**.

Accepted RC1.7-D scope: deterministic collection recommendations; payable sequencing; exact one-Rial `cash before`/`cash after`; liquidity-gap recommendation; human-readable `چرا این پیشنهاد؟`; controlled Digital Twin handoff with real open amount as editable seed; no auto-run; no autonomous message/payment/posting; no DB write and no Actual Ledger mutation.

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
- pre-merge Architecture Gate #261 = **PASS**; post-merge Architecture Gate #262 = **PASS**.
- PR #150 recorded Dashboard Accounting Correctness and Counterparty 360 Live PASS.
- PR #151 fixed the Decision Layer → Digital Twin exact-money handoff; Gate #264/#265 and Pages #394 = **PASS**.
- PR #153 added the requested Digital Twin input grouping polish; Gate #266/#267 and Pages #396 = **PASS**.
- all current RC1.7 Live validation gates are now closed.
- Production remains RC1.6; no RC1.7 Production promotion has occurred.

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
- before RC1.7-D functional testing: journal entries = **93**, financial transactions = **24**, invoices = **42**.
- after the failed handoff test: counts and latest creation timestamps were unchanged.
- after explicit **«RC1.7-D Live PASS — Handoff Fixed»**: journal entries = **93**, financial transactions = **24**, invoices = **42**, with the same latest creation timestamps as before.
- therefore RC1.7-D Evidence/Decision/Digital-Twin Live testing created **no Actual journal, financial transaction or invoice mutation**.

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
- Module 3: foundation + Decision Layer current scope = **Full Live PASS**.
- Module 6: Counterparty 360 foundation Live PASS.
- Module 8: Evidence foundation Live PASS and used across recommendations/Counterparty views.
- Modules 4, 5, 7 and 9 remain planned after RC1.7 release boundary.

Guardrails: deterministic calculation before narrative; evidence before recommendation; Actual/Forecast/Scenario separation; no silent AI posting/payment; every important number drillable; Company/RLS and one-Rial exactness everywhere.

---

## 14) RC1.7 Live closure COMPLETE — release engineering only

Dashboard Accounting Correctness and Counterparty 360 are now explicitly Live PASS. RC1.7-D Evidence readability and final functional handoff are also explicitly Live PASS.

- required confirmation received: **«RC1.7-D Live PASS — Handoff Fixed»**.
- direct post-Live Supabase mutation check = unchanged at **93 journal entries / 24 financial transactions / 42 invoices**, with unchanged latest creation timestamps.
- no further RC1.7 functional Live re-test is pending for the current scope.
- next steps are release-engineering only: **RC freeze → final regression → rollback point → Production Release Gate**.
- Production promotion still requires explicit user release approval; do not promote before that approval.

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
- RC1.7-D Digital Twin handoff hotfix merge = `dc7d6b7892ac1f8f3762cd30cee9293c95fe8f6e` — Gate #264/#265 PASS; Pages #394 PASS.
- RC1.7-D Digital Twin grouped-input polish merge = `7c67eec784e18c21fd7b8be27adf5f90ca77b7bf` — Gate #266/#267 PASS; Pages #396 PASS.
- current Staging service-worker cache identity = `avan-staging-rc1-v109-dashboard-live-contract-v3` with fresh-network delivery safeguards and release-closure regression coverage.
- current Live validation pending = **none for RC1.7 current scope**.
- current release-engineering pending = **RC freeze, final regression, rollback point, Production Release Gate, explicit user release approval**.
