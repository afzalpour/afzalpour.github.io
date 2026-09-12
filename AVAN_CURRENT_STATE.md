# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-13**

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
- **Modules 4 and 5 have not been promoted to Production.**

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
- historical RC1.7-D post-Live certification remains **93 journal entries / 24 financial transactions / 42 invoices** with unchanged latest creation timestamps at that Gate.
- after the final Module 4 targeted Live retest, read-only verification showed **94 journal entries / 24 financial transactions / 42 invoices / 23 documents**. The one additional journal is a user-created **manual Draft** with description **«آزمایشی ۱»** and is not attributable to Module 4.
- after explicit Module 5 Live PASS, read-only verification still shows **94 journal entries / 24 financial transactions / 42 invoices / 23 documents**; latest timestamps are unchanged from the pre-Module-5-Live baseline. Module 5 therefore remained mutation-free as designed.

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
- Module 4 = **Engineering PASS + authenticated Staging Live PASS; CLOSED for Staging acceptance**.
- Module 5 = **Engineering PASS + authenticated Staging Live PASS; CLOSED for Staging acceptance**.
- Module 6 = Production Live PASS.
- Module 8 current scope = Production Live PASS.
- Modules 7 and 9 remain future trains.

Current architectural train: **Module 7 — Smart Procurement & Spend Control**.

---

## 7) Module 4 — Continuous Close + Continuous Audit — CLOSED in Staging

Engineering foundation:
- PR #164 merge = `4549e56a934431e2e09826ee510800ecbdc8709a`.
- Architecture Gate #282/#283 = PASS; Pages #407 = PASS.
- architecture = `avan-continuous-close-audit-foundation-v1`.
- deterministic Close status = `Ready / Attention / Blocked`; no arbitrary readiness score.
- evidence is workspace-scoped and accounting-readable.
- `writeOperations = 0`; `actualLedgerMutation = false`.

Live correction history retained:
- PR #170 merge = `d848b0056936934cb471553e769b0b266f0be5c1`; Architecture #289/#290 PASS; Pages #413 PASS.
- Evidence modal stability, Persian terminology, VAT table containment, shared intelligence Print/PDF and ADR-0024 runtime parity were added.
- PR #172 merge = `26d25eed3ef6995df6b08d4919f2e81ba81792ee`; Architecture #291/#292 PASS; Pages #415 PASS.
- Working Capital 4+3 desktop rhythm and explicit Jalali Print/PDF header were restored.
- PR #175 merge = `49f5f7f8966f9d416a93b8e807145cb3289a1d6a`; Architecture #295 PASS; cache v116.
- Jalali ISO backing control became truly hidden so the technical Gregorian value no longer appears in print clones.

Final authenticated Staging acceptance:
- the user completed the targeted corrected-surface retest and confirmed **«مورد تایید است برو گام بعد»** in direct response to that Gate.
- this closes Module 4 authenticated Staging Live validation as **PASS**.
- post-Live read-only mutation check confirmed Module 4 did not create or modify financial source rows.
- Module 4 Production promotion = **not authorized / not performed**.

---

## 8) ADR-0024 — Production/Staging Runtime Parity Contract

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

Dedicated capability locks retained:
- `src/ui/intelligence/business-copilot-view.js` byte-identical between Production/Staging unless explicitly allowlisted in a later release train.
- `src/ui/intelligence/dashboard-intelligence-live-polish.js` byte-identical between Production/Staging unless explicitly allowlisted in a later release train.

---

## 9) Module 5 — Iran Compliance Radar — Engineering + authenticated Staging Live PASS

Scope and contract:
- architecture = `avan-iran-compliance-radar-foundation-v1`.
- methodology = deterministic controls; **no arbitrary compliance score**.
- sources reuse existing versioned tax/compliance data instead of introducing a competing legal truth.
- primary data sources: `tax_rule_versions`, `workspace_tax_settings`, `tax_profiles`, `invoices`, `invoice_lines`, `fiscal_periods`, and the existing e-invoice prevalidation contract.
- company/workspace scope and RLS boundary remain mandatory.
- money calculations preserve canonical one-Rial exactness.
- `writeOperations = 0`; `actualLedgerMutation = false`; `submissionSupported = false`.
- no filing, invoice submission, posting, payment or period-close action is executed by the Radar.
- `fabricatedDeadlines = false`: the Foundation does **not** invent statutory deadlines when no trusted versioned rule exists.
- current explicit coverage: tax/VAT = yes; electronic invoice readiness = yes; fiscal-close readiness = yes; payroll = no; insurance = no.

Engineering delivery:
- PR #176 **Module 5: Iran Compliance Radar foundation** merged as `2f7185aa3cc46f735387689274f4db8667d56081`.
- Architecture #301/#302 = PASS; Pages #419 = PASS.
- initial Staging cache = `avan-staging-rc1-v117-module5-iran-compliance-radar`.
- permanent regression = **`Iran Compliance Radar foundation PASS`**.

Runtime-parity hardening:
- PR #177 merged as `7c3fcb636fa419200b37da30fc477771a7c0a6fb`.
- Architecture #303/#304 = PASS.
- full Service Worker enumeration restored after rejecting a temporary reduced audit surface.
- `sw-precache-integrity: PASS (202 declared runtime entries; avan-staging-rc1-v117-module5-iran-compliance-radar)`.
- **`runtime parity PASS — 201 Staging assets / 192 Production assets checked; 19 intentional divergences declared`**.
- architecture high findings = **0**; money architecture findings = **0**.

Authenticated Staging Live acceptance:
- explicit user confirmation = **«Module 5 Iran Compliance Radar Live PASS»**.
- page/navigation, deterministic readiness/findings, evidence readability, date rerun, no fabricated deadline, explicit non-coverage of payroll/insurance and shared Print/PDF were accepted in authenticated Staging Live.
- post-Live read-only Supabase verification confirmed no new journal, financial transaction, invoice or document was created by Module 5.
- Module 5 Production promotion = **not authorized / not performed**.

---

## 10) ADR-0025 — Strict Persian User-Facing Language Contract

Status: **Accepted / permanent product invariant**.

User requirement after Module 5 Live acceptance: all unnecessary English text visible to end users must be replaced with fluent, natural Persian, including text originating from system/database coded values.

Permanent contract:
- static UI copy must be fluent Persian and appropriate for Iranian accounting/finance terminology.
- coded database/system values such as `active`, `standard`, `exempt`, `zero`, `both`, `fixed`, `rule` and similar enums are localized at the **presentation boundary**.
- canonical/raw database values remain unchanged when they are part of API, audit, rules or data-integrity contracts; localization must not destroy traceability.
- unknown Latin system values must not leak raw into primary user-facing labels; use a context-appropriate Persian fallback until an explicit mapping is added.
- user-entered Latin data, URLs, legal identifiers and necessary technical/reference codes are exempt when their exact form is required for identity or auditability.
- each new module must include regression coverage against unnecessary English UI leakage.
- no translation may alter accounting, tax or legal meaning.

Module 5 localization correction:
- PR #179 **Persian UI contract: localize Module 5 and database-facing labels** merged as `96064e6d4009b9c0e1c5e01b60c14d0dc933f526`.
- pre-merge Architecture Gate #309 = PASS.
- post-merge Architecture Gate #310 = PASS.
- Pages #422 = PASS.
- Staging cache = **`avan-staging-rc1-v118-persian-user-facing-contract`**.
- examples corrected include `Snapshot`, `Foundation`, `Source of Truth` and database enum statuses/treatments.
- Supabase inspection confirmed current legal source/title text is already Persian while several canonical enum values are English-coded; those enum values are now translated in the UI rather than rewritten in the database.
- Production runtime remained byte-for-byte unchanged by PR #179; the Staging localization difference is explicitly declared under ADR-0024 until an authorized Production promotion.

---

## 11) Current canonical pointers

Production:
- current release = **RC1.7**.
- original release PR #158.
- Smoke UX Production hotfix PR #162 merge `133f9e44cd3408e6ba7dbabfba194a89dca92d0c`.
- Company Onboarding/Auth Production hotfix PR #167 merge `1eac2e9cf4fd44feaa49fffd86b9438a6a5161c9`.
- Production Service Worker = `avan-prod-rc1-7-v1`.
- Modules 4 and 5 = **not Production-promoted**.

Staging:
- Module 4 authenticated Live = **PASS / CLOSED**.
- Module 5 Engineering + authenticated Live = **PASS / CLOSED**.
- current Staging cache = `avan-staging-rc1-v118-persian-user-facing-contract`.
- latest runtime merge = `96064e6d4009b9c0e1c5e01b60c14d0dc933f526`.
- latest Architecture = #309 pre-merge / #310 post-merge PASS.
- latest runtime Pages = #422 PASS.

Architecture:
- ADR-0023 Intelligent Finance OS = Accepted.
- ADR-0024 Production/Staging Runtime Parity Contract = Accepted.
- ADR-0025 Strict Persian User-Facing Language Contract = Accepted.

---

## 12) Required next engineering train

Next architectural train is **Module 7 — Smart Procurement & Spend Control**.

Before any authenticated Live Gate, Engineering must first build the Staging foundation under the existing invariants: company/RLS scoped, deterministic before narrative, evidence-backed, exact one-Rial money, Persian-first under ADR-0025, and no silent payment/posting/procurement commitment.

Do **not** promote Modules 4 or 5 to Production without separate explicit release approval.