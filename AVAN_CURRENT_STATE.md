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
- explicit final Production Smoke confirmation = **«RC1.7 Production Smoke UX PASS»**.
- current Live validation pending = **none for RC1.7 current scope**.
- current release-engineering pending = **none for RC1.7**.
- Production Service Worker cache = `avan-prod-rc1-7-v1`.
- Modules 4, 5, 7 and 9 are **not Production-promoted**.

Production rollback points retained:
- `prod-backup-20260912-rc1-7-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-smoke-ux-hotfix`
- `prod-backup-20260912-company-onboarding-auth-hotfix-pre-promotion`

---

## 2) Permanent accepted Production markers

RC1.6 retained: Bank Reconciliation, Bank Statement Import, Party Ledger, exact one-Rial receipt/payment/transfer, Party Ledger print/PDF and gross AR/AP = Live accepted.

RC1.7 retained:
- Financial Control Tower = Production Live PASS.
- Financial Digital Twin = Production Live PASS.
- Working Capital + Evidence = Production Live PASS.
- Evidence-backed Operational Decision Layer = Production Live PASS.
- Dashboard Accounting Correctness = Production Live PASS.
- Counterparty 360 = Production Live PASS.

Permanent explicit regression/history markers:
- **«Financial Digital Twin Live PASS»**
- **«Working Capital + Evidence Live PASS»**
- **«RC1.7-D Evidence Readable PASS»**
- **«RC1.7-D Live PASS — Handoff Fixed»**
- **«Digital Twin Evidence Readable PASS»**
- **«Dashboard Accounting Correctness Audit Live PASS»**
- **«Counterparty 360 Live PASS»**
- historical post-Live mutation certification = **93 journal entries / 24 financial transactions / 42 invoices**.

---

## 3) Governing invariants

- PostgreSQL/Supabase is the financial Source of Truth; browser storage is not a financial datastore.
- canonical money = Toman with `0.1 Toman = 1 Rial`; no silent sub-Rial rounding.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Company/RLS boundary is mandatory; browser never receives Service Role/private secrets.
- no silent posting, payment, approval or submission from intelligence/automation features.
- integration writes must be idempotent, auditable, workspace-scoped and human-controlled.
- every important financial number should remain drillable to readable evidence.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Free Transactional Recovery Rehearsal = PASS.
- isolated external disaster restore remains **OPEN**; never restore against `Avan-production` itself.
- Leaked Password Protection remains disabled by provider/plan limitation and must not be falsely marked fixed.

Current backend truth retained:
- orphan journal lines = 0; cross-workspace journal-line mismatches = 0; unbalanced Posted journals = 0.
- orphan invoice lines = 0; cross-workspace invoice-line mismatches = 0.
- journal lines with fractional Toman = 42; one-Rial exactness is exercised by real data.
- effective public anon/auth `SECURITY DEFINER` exposure = 0.

---

## 4) Strategic architecture — ADR-0023

Official capabilities:
1. Financial Control Tower
2. Financial Digital Twin
3. Working Capital Autopilot
4. Continuous Close + Continuous Audit
5. Iran Compliance Radar
6. Counterparty 360
7. Smart Procurement & Spend Control
8. Avan Evidence Graph
9. Avan Connect / Automation Marketplace

Progress:
- Modules 1, 2, 3, 6 and current Module 8 scope = Production Live PASS.
- Module 4 = Engineering PASS + authenticated Staging Live PASS; CLOSED for Staging acceptance.
- Module 5 = Engineering PASS + authenticated Staging Live PASS; CLOSED for Staging acceptance.
- Module 7 = Engineering PASS + authenticated Staging Live PASS; CLOSED for Staging acceptance.
- Module 9 = **Engineering PASS; authenticated Staging Live pending**.

Current architectural train: **Module 9 — Avan Connect / Automation Marketplace Live Gate**.

---

## 5) Modules 4 and 5 — Staging accepted

Module 4 — Continuous Close + Continuous Audit:
- PR #164 foundation; PR #170 Live polish/parity; PR #172 print/4+3; PR #175 final Jalali hidden-ISO fix.
- final user acceptance = **«مورد تایید است برو گام بعد»**.
- `writeOperations = 0`; `actualLedgerMutation = false`.
- Production promotion not authorized / not performed.

Module 5 — Iran Compliance Radar:
- PR #176 foundation merge `2f7185aa3cc46f735387689274f4db8667d56081`.
- PR #177 runtime-parity hardening merge `7c3fcb636fa419200b37da30fc477771a7c0a6fb`.
- explicit user confirmation = **«Module 5 Iran Compliance Radar Live PASS»**.
- post-Live read-only Supabase verification = **94 journal entries / 24 financial transactions / 42 invoices / 23 documents** with unchanged latest timestamps.
- no fabricated legal deadlines; payroll/insurance remain explicitly unsupported until authoritative data exists.
- Production promotion not authorized / not performed.

---

## 6) ADR-0024, ADR-0025 and ADR-0026

ADR-0024 — Production/Staging Runtime Parity Contract = **Accepted**.
- shared runtime must be byte-identical unless explicitly allowlisted.
- active runtime scope is Service Worker `ASSETS`.
- parity never authorizes Production promotion.
- Staging runtime changes advance cache identity.

ADR-0025 — Strict Persian User-Facing Language Contract = **Accepted / permanent product invariant**.
- all unnecessary English user-facing text must be fluent Persian.
- English-coded database/system enums are localized at presentation boundary; canonical raw values remain intact for API/audit/integrity.
- unknown Latin system values must not leak raw to primary user-facing labels.
- user-entered Latin data, legal IDs, URLs and exact technical references are exempt only when exact form is required.
- each new module requires regression against unnecessary English UI leakage.
- PR #179 localization correction merge `96064e6d4009b9c0e1c5e01b60c14d0dc933f526`; Architecture #309/#310 PASS; Pages #422 PASS.

ADR-0026 — Avan Connect Automation Execution Boundary = **Accepted**.
- connector status must reflect real capability; disconnected providers must never be presented as active.
- a future real execution path must be workspace-scoped, idempotent and auditable.
- deduplication identity is server-side and includes workspace, connector, source reference and payload identity.
- financial write, posting, payment and external submission remain human-controlled.
- provider credentials/sensitive connection data are forbidden from browser financial storage.
- Module 9 foundation intentionally enables registry/marketplace/preview only; it does not activate generic external execution.

---

## 7) Module 7 — Smart Procurement & Spend Control — Engineering + authenticated Staging Live PASS

Architecture:
- id = `avan-smart-procurement-spend-control-v1`.
- methodology = deterministic controls; no arbitrary score.
- exact one-Rial purchase/spend calculations.
- read-only: `writeOperations = 0`, `actualLedgerMutation = false`, approval/payment mutation = false.
- every company-owned source query carries explicit `workspace_id` filter and remains behind RLS.

Supported controls:
- purchase invoice ↔ inventory receipt two-source matching.
- reused receipt-line detection.
- quantity mismatch and unit-price/receipt-cost mismatch.
- posted item purchases without linked receipt.
- posted receipt lines awaiting purchase invoice linkage.
- supplier-spend concentration.
- purchase-price change history.
- low-stock/reorder candidates from inventory data.
- accounting-readable evidence with no raw UUID user labels.
- fluent Persian UI under ADR-0025.
- shared Print/PDF with company identity, selected money unit and Jalali date.

Explicitly unsupported until authoritative source-of-truth exists:
- purchase request.
- purchase order.
- full three-way match using PO.
- budget control.
- approval workflow.
- payment execution.
These are not fabricated or inferred from unrelated data.

Engineering delivery:
- PR #181 **Module 7: Smart Procurement & Spend Control foundation**.
- pre-merge Architecture Gate #312 = **PASS**.
- merge = `06f77810bf6d754a449a1ab1b03f8910e98b41a5`.
- post-merge Architecture Gate #313 = **PASS**.
- GitHub Pages #424 = **PASS**.
- Staging cache = `avan-staging-rc1-v119-smart-procurement-spend-control`.
- Production runtime = unchanged.

Authenticated Staging Live acceptance:
- first Live pass confirmed navigation, date rerun, Persian UI, Print/PDF and other visible surfaces; no operational finding was available in the initially selected company/date, so evidence controls were not yet observable.
- user changed the as-of date to **۱۴۰۵/۰۵/۰۷** and confirmed the displayed data changed accordingly without creating records.
- direct read-only database inspection identified real test data in **«شرکت وفاداران نیما»** on `2026-09-07` / **۱۴۰۵/۰۶/۱۶**: one inventory receipt line linked to 5 purchase-invoice lines and 4 quantity mismatches.
- targeted follow-up Live test on that real-data scope was accepted by the user with **«اوکی بود پاس شود»**.
- Module 7 authenticated Staging Live = **PASS / CLOSED**.

Pre-Live baseline and post-Live mutation verification are identical:
- journal_entries = **94**; latest created_at = `2026-09-12 19:32:07.685779+00`.
- financial_transactions = **24**; latest = `2026-09-10 21:16:55.697626+00`.
- invoices = **42**; latest = `2026-09-10 16:37:20.676074+00`.
- documents = **23**; latest = `2026-09-07 21:11:31.272166+00`.
- inventory_documents = **9**; latest = `2026-09-07 12:44:33.272324+00`.
- therefore Module 7 remained mutation-free in authenticated Live use.

Module 7 Production promotion = **not authorized / not performed**.

---

## 8) Module 9 — Avan Connect / Automation Marketplace — Engineering PASS / Live pending

Architecture and safety contract:
- architecture id = `avan-connect-automation-marketplace-v1`.
- Foundation v1 is **registry + marketplace + deterministic preview only**.
- `writeOperations = 0`; `actualLedgerMutation = false`; `workflowExecution = false`; `connectionMutation = false`.
- human approval, idempotency and auditability are permanent execution requirements under ADR-0026.
- no provider credentials or sensitive connector values are introduced into browser financial storage.
- no database migration or new generic execution table/function was introduced in this foundation.

Truthful connector registry:
- **ورود فایل صورت‌حساب بانکی** = فعال در آوان; reuses accepted CSV import/reconciliation.
- **استخراج هوشمند اسناد** = فعال در آوان; reuses authenticated `avan-document-extract` Edge Function and human review.
- **پیش‌اعتبارسنجی صورتحساب الکترونیکی** = آماده با محدودیت; provider-neutral preflight exists, real external submission remains disabled.
- **اتصال پایانه فروش** = متصل‌نشده.
- **اتصال فروشگاه اینترنتی** = متصل‌نشده.
- **اتصال عمومی داده** = متصل‌نشده.
No unavailable provider is fabricated as connected.

Workflow preview scope:
- bank statement → controlled reconciliation preview.
- smart document → human financial review preview.
- sales invoice → electronic-invoice preflight preview.
- POS/store flows are visible only as disconnected future recipes and cannot execute.
- every preview returns `willExecute = false`, `writeOperations = 0` and `requiresHumanApproval = true`.

Engineering delivery:
- PR #184 **Module 9: Avan Connect / Automation Marketplace foundation**.
- initial Gate #314 found only a stale Module 7 exact-cache-name assertion; that historical test was corrected to require v119-or-newer while preserving all Module 7 behavioral guards.
- pre-merge Architecture Gate #315 = **PASS**.
- merge = `979222ec84755d463610d056503fd8984bfb00fb`.
- post-merge Architecture Gate #316 = **PASS**.
- GitHub Pages #427 = **PASS**.
- Staging cache = `avan-staging-rc1-v120-avan-connect-marketplace`.
- permanent regression marker = **`Avan Connect / Automation Marketplace foundation PASS`**.
- `sw-precache-integrity = PASS (214 declared runtime entries)`.
- runtime parity = **213 Staging assets / 192 Production assets checked; 32 intentional divergences declared**.
- architecture high findings = **0**; money architecture findings = **0**.
- Production runtime = unchanged.

Pre-Live read-only mutation baseline captured after Engineering delivery:
- journal_entries = **94**; latest created_at = `2026-09-12 19:32:07.685779+00`.
- financial_transactions = **24**; latest = `2026-09-10 21:16:55.697626+00`.
- invoices = **42**; latest = `2026-09-10 16:37:20.676074+00`.
- documents = **23**; latest = `2026-09-07 21:11:31.272166+00`.
- inventory_documents = **9**; latest = `2026-09-07 12:44:33.272324+00`.

Authenticated Staging Live Gate is now the only pending Module 9 acceptance step.

---

## 9) Current canonical pointers

Production:
- current release = **RC1.7**.
- Production Service Worker = `avan-prod-rc1-7-v1`.
- Modules 4, 5, 7 and 9 = not Production-promoted.

Staging:
- Module 4 = Live PASS / CLOSED.
- Module 5 = Live PASS / CLOSED.
- Module 7 = Engineering + authenticated Live PASS / CLOSED.
- Module 9 = Engineering PASS / authenticated Live pending.
- current Staging cache = `avan-staging-rc1-v120-avan-connect-marketplace`.
- latest runtime merge = `979222ec84755d463610d056503fd8984bfb00fb`.
- latest Architecture = #316 PASS.
- latest Pages = #427 PASS.

Next required user action: authenticated Staging Live Gate for Module 9. Production promotion of Staging-only modules still requires separate explicit approval and has not been performed.
