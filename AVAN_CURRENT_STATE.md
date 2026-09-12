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
- Production current release = **RC1.7**.
- RC1.7 Production release PR = **#158**.
- RC1.7 Production merge = `cf08f25703b84c0049103eb97e15d59945973658`.
- explicit release approval = **«RC1.7 Production Release APPROVED»**.
- pre-RC1.7 Production rollback branch = `prod-backup-20260912-rc1-7-pre-promotion`.
- Production service-worker identity = `avan-prod-rc1-7-v1` with prefix `avan-prod-`.
- pre-merge Production Release Gate #12 = **PASS** in actual runtime-promotion mode.
- post-merge Production Release Gate #13 = **PASS**.
- post-merge Frontend Architecture Gate #276 = **PASS**.
- GitHub Pages #401 build + deploy = **PASS**.
- root `config.js` remained byte-identical through promotion and still targets the Production Supabase project.
- Production promotion was frontend/runtime-only; no database schema/data mutation was part of PR #158.
- deployment-contract smoke = **PASS**: deployed Pages workflow succeeded, Production `main` contains the RC1.7 runtime modules, and root `sw.js` has the approved Production cache identity.
- direct unauthenticated HTTP fetch from the assistant execution environment was not available because that environment could not resolve the fresh GitHub Pages hostname; do not misstate this as an HTTP smoke PASS.
- authenticated Production smoke by the user = **PENDING**.

Historical previous release:
- RC1.6 Production release PR = **#117**.
- RC1.6 Production merge = `eace3198947da1e87deb5d5512b905b27975c74e`.
- RC1.6 Production Smoke = **PASS**.
- pre-RC1.6 rollback branch = `prod-backup-20260910-rc1-6-pre-promotion`.

---

## 2) RC1.6 accepted scope retained in RC1.7

1. **RC1.6-A — Bank Reconciliation Foundation** — Engineering/Backend PASS.
2. **RC1.6-B — Bank Statement Import + Reconciliation UI** — Engineering + Live PASS for implemented scope.
3. **RC1.6-C — Party Ledger** — Engineering + Full Live PASS.
4. exact one-Rial receipt/payment/transfer and real bank-statement import = Live accepted.
5. Party Ledger print/PDF, Jalali range and gross AR/AP without auto-offset = Live accepted.
6. accounting-negative presentation keeps signed truth and renders negatives as red `(amount)` only in Presentation Layer.

---

## 3) RC1.7-A — Avan Financial Control Tower

Status: **Engineering PASS + Live PASS + Production released**.

- PR #118 merge = `b260c6995c233f097661082092767373416e1fe9`.
- Gate #202/#203 = PASS; Pages #355 = PASS.

Accepted scope: Company/RLS-scoped cash/bank, gross AR/AP by real `party_id`, bank/inventory risk indicators, deterministic close-readiness blockers, prioritized actions, `چرا این عدد؟`, Persian/Jalali responsive UI, exact one-Rial precision, zero AI-generated accounting amount and zero financial write path.

---

## 4) RC1.7-B — Financial Digital Twin

Status: **Engineering PASS + Live PASS + Production released**.

- PR #119 merge = `d522dd47d825adc7e0458ca3d755c3752ccde069`.
- Gate #204/#205 = PASS; Pages #356 = PASS.
- explicit user confirmation = **«Financial Digital Twin Live PASS»**.

Opening-evidence readability polish:
- PR #155 replaced raw technical reference IDs in `منشأ این عدد` with accounting-facing rows.
- financial-account evidence shows account type/bank plus ledger account code/name when available.
- journal evidence shows journal number, Jalali date, accounting source type and description when available.
- all detail lookups remain explicitly `workspace_id` scoped and read-only.
- PR #155 merge = `838d4e7a12f57e6b9ab7519ceb71265e5e57dd2f`.
- pre-merge Architecture Gate #270 = **PASS**; post-merge Gate #271 = **PASS**; Pages #398 = **PASS**.
- explicit user confirmation = **«Digital Twin Evidence Readable PASS»**.

Accepted scope: real opening cash/bank, explicit scenario flows, deterministic Base vs Scenario cash, liquidity stress, human-readable accounting provenance for opening cash, no scenario persistence, no Actual Ledger mutation and no AI arithmetic.

---

## 5) RC1.7-C — Working Capital + Evidence Foundation

Status: **Engineering PASS + Live PASS + Production released**.

- PR #121 merge = `197503177b04b7f0fd30bedd2173645decb944ab`.
- final Gate #208/#209 = PASS; Pages #358 = PASS.
- explicit user confirmation = **«Working Capital + Evidence Live PASS»**.

Accepted scope: one-Rial Working Capital model; gross AR/AP by real `party_id`; no cross-party netting; FIFO reduction allocation; invoice due-date aging/fallbacks; collection priority; 30-day payable calendar; liquidity indicator; Evidence links; Company/RLS scope; no autonomous collection/payment/posting and no Actual Ledger mutation.

---

## 6) RC1.7-D — Evidence-backed Operational Decision Layer

Status: **Engineering PASS + Full Live PASS + Production released**.

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

Digital Twin numeric-entry polish:
- PR #153 routes all 8 primary editable Digital Twin numeric fields through the central Money Input Lifecycle and also groups `اثر نقدی یک‌باره سناریو`.
- thousands separator = Persian `٬`; signed decimals remain supported for percentage changes and one-off cash impact.
- PR #153 merge = `7c67eec784e18c21fd7b8be27adf5f90ca77b7bf`.
- Gate #266/#267 = **PASS**; Pages #396 = **PASS**.

Accepted RC1.7-D scope: deterministic collection recommendations; payable sequencing; exact one-Rial `cash before`/`cash after`; liquidity-gap recommendation; human-readable `چرا این پیشنهاد؟`; controlled Digital Twin handoff with real open amount as editable seed; no auto-run; no autonomous message/payment/posting; no DB write and no Actual Ledger mutation.

---

## 7) Dashboard + Financial Intelligence / Accounting Correctness

Status: **Engineering PASS + Full Live PASS for current RC1.7 scope + Production released**.

Key history:
- PR #129 corrected the factor-of-10 defect in primary Dashboard KPIs and `چرا این عدد؟`; explicit user confirmation = **«Dashboard Exact KPI + 10-Day PASS»**.
- verified real P&L reference at the time: income `177,178,123.1 Toman`, expense `11,595,500.5 Toman`, profit `165,582,622.6 Toman` = **`1,655,826,226 Rial`**.
- PR #132 audited Party Aging, Business Copilot, Smart Collection and Risk/Continuous Audit for canonical decimal↔tenths exact money.
- PRs #134–#140 refined Business Evidence, accounting negatives, Aging units, effective FIFO journals, PWA delivery and Continuous Controls presentation.
- PR #141 added one-Rial exact Natural Reports.
- PR #142 added authoritative exact report runtime.
- PR #143 added hierarchical account rollup through a SECURITY INVOKER reporting boundary.
- explicit user confirmation = **«Dashboard Accounting Correctness Audit Live PASS»**.

Accepted contracts:
- `0.1 Toman = 1 Rial` exactness;
- FIFO AR/AP with real `party_id` and no cross-party netting;
- due-date provenance and evidence journals;
- deterministic Smart Collection and Risk rules;
- explicit `workspace_id` scoping;
- no insert/update/delete from intelligence views and no financial browser persistence.

---

## 8) RC1.7-E — Counterparty 360 Foundation

Status: **Engineering PASS + Live PASS for current foundation scope + Production released**.

History:
- PR #138 = complete counterparty master data; additive migration applied and verified on `Avan-production`.
- PR #144 = Counterparty 360 foundation.
- PR #145 = Live UI stabilization hotfix.
- PR #146 = mutation-free Counterparty 360 action path / flashing elimination; Gate #257 = PASS.
- explicit user confirmation = **«Counterparty 360 Live PASS»**.

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

## 9) RC1.7 release closure and Production promotion

- PR #148 refreshed Source of Truth after repository/Supabase reconciliation.
- PR #149 added the permanent **RC1.7 Release Closure Regression Gate**; merge `55a447f9492ebe5e61b2cd77e666c7a3de92cb50`; Gate #261/#262 = **PASS**.
- PR #150 recorded Dashboard Accounting Correctness and Counterparty 360 Live PASS.
- PR #151 fixed Decision Layer → Digital Twin exact-money handoff; Gate #264/#265 and Pages #394 = **PASS**.
- PR #153 added Digital Twin grouped-input polish; Gate #266/#267 and Pages #396 = **PASS**.
- PR #155 added accounting-readable Digital Twin opening evidence; Gate #270/#271 and Pages #398 = **PASS**; Live = **«Digital Twin Evidence Readable PASS»**.
- PR #156 completed RC1.7 Freeze / final-regression / Production-gate preparation; Architecture Gate #273 and Production Release Gate #6 = **PASS** in preparation mode.
- PR #157 fixed release-gate push-parent history without weakening release controls; Production Release Gate #9 = **PASS**.
- explicit user release approval = **«RC1.7 Production Release APPROVED»**.
- PR #158 = actual RC1.7 Production runtime promotion.
- PR #158 first promotion run correctly stopped when the legacy release-closure test still assumed approval had not occurred; exact runtime projection itself had already PASSed.
- the regression was corrected to require an explicit, auditable approval artifact (`RC1_7_PRODUCTION_APPROVAL.md`) rather than removing the guard.
- PR #158 pre-merge Production Release Gate #12 = **PASS** in actual runtime-promotion mode.
- PR #158 pre-merge Frontend Architecture Gate #275 = **PASS**.
- PR #158 merge = `cf08f25703b84c0049103eb97e15d59945973658`.
- post-merge Production Release Gate #13 = **PASS**.
- post-merge Frontend Architecture Gate #276 = **PASS**.
- GitHub Pages #401 build/deploy = **PASS**.
- root `index.html` now contains RC1.7 Control Tower, Digital Twin, Working Capital/Decision Layer, Dashboard intelligence, Party Master and Counterparty 360 runtime assets.
- root `sw.js` = approved Production transform with `CACHE_PREFIX='avan-prod-'` and `CACHE='avan-prod-rc1-7-v1'`.
- Production rollback point = `prod-backup-20260912-rc1-7-pre-promotion`.
- no database migration/data write was executed as part of Production promotion.

---

## 10) Backend / accounting certification snapshot — 2026-09-12

Direct read-only verification on `Avan-production` before release:

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
- after explicit **«RC1.7-D Live PASS — Handoff Fixed»**: **93 journal entries / 24 financial transactions / 42 invoices**, with the same latest creation timestamps as before.
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

Progress after RC1.7 Production release:
- Module 1: first scope Live PASS and released.
- Module 2: first scope Live PASS including accounting-readable opening provenance and released.
- Module 3: foundation + Decision Layer current scope = **Full Live PASS** and released.
- Module 6: Counterparty 360 foundation Live PASS and released.
- Module 8: Evidence foundation Live PASS and released across recommendations/Counterparty views.
- Modules 4, 5, 7 and 9 remain planned for subsequent release trains.

Guardrails: deterministic calculation before narrative; evidence before recommendation; Actual/Forecast/Scenario separation; no silent AI posting/payment; every important number drillable; Company/RLS and one-Rial exactness everywhere.

---

## 14) RC1.7 Production release COMPLETE — authenticated smoke pending

All current-scope Staging Live validations and release-engineering gates are closed.

- required functional confirmations include **«RC1.7-D Live PASS — Handoff Fixed»** and **«Digital Twin Evidence Readable PASS»**.
- explicit Production approval received = **«RC1.7 Production Release APPROVED»**.
- Production promotion completed through PR #158 after actual runtime Release Gate PASS.
- direct post-Live Supabase mutation check remained **93 journal entries / 24 financial transactions / 42 invoices** before promotion; Production promotion itself performed no DB writes.
- deployment/engineering verification = PASS (Release Gate #12/#13, Architecture #275/#276, Pages #401).
- authenticated Production smoke is the only remaining release acceptance item because it requires the user's signed-in Production session.
- do not repeat the full Staging Live suite; Production smoke should be narrowly scoped to login/company context, Dashboard and representative RC1.7 navigation/read-only rendering.

---

## 15) Canonical current pointers

- Production runtime = **RC1.7**.
- Production release PR = **#158**.
- Production merge = `cf08f25703b84c0049103eb97e15d59945973658`.
- Production rollback = `prod-backup-20260912-rc1-7-pre-promotion`.
- Production Service Worker cache = `avan-prod-rc1-7-v1`.
- Production Release Gate = pre-merge #12 PASS; post-merge #13 PASS.
- Frontend Architecture Gate = pre-merge #275 PASS; post-merge #276 PASS.
- Production Pages = #401 PASS.
- current Staging service-worker cache identity = `avan-staging-rc1-v109-dashboard-live-contract-v3` with fresh-network delivery safeguards and release-closure regression coverage.
- current Live validation pending = **none for RC1.7 current scope**.
- current release-engineering pending = **authenticated Production smoke only**.
