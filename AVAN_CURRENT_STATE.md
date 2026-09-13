# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-14**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production runtime**.
- `avan-staging/` = **Staging / next-release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Production current release = **RC1.8 — promoted / automated release gates PASS / authenticated Production Smoke pending**.
- RC1.8 readiness PR = **#188**; merge = `1286c6bb887a532f0cca7c2fe799e5aad831a1d3`.
- RC1.8 Production promotion PR = **#189**; merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- explicit promotion approval = **«RC1.8 Production Promotion APPROVED»**.
- pre-merge promotion branch head = `c3c2fe5f448aa4937bc08bad8debbadfa436b0f3`.
- pre-merge Architecture Gate #322 = **PASS**.
- pre-merge Production Release Gate #25 = **PASS**.
- post-merge Architecture Gate #323 = **PASS**.
- post-merge Production Release Gate #26 = **PASS**.
- GitHub Pages #432 = **PASS**.
- Production Service Worker cache = `avan-prod-rc1-8-v1`.
- Modules 4, 5, 7 and 9 are **Production-promoted at the release/runtime layer**.
- current Live validation pending = **authenticated RC1.8 Production Smoke for Modules 4, 5, 7 and 9**.
- RC1.8 must **not** be marked final Production Live PASS until that smoke test is explicitly accepted by the user and the post-smoke read-only integrity check is closed.

Production rollback points retained:
- `prod-backup-20260914-rc1-8-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-smoke-ux-hotfix`
- `prod-backup-20260912-company-onboarding-auth-hotfix-pre-promotion`

RC1.8 promotion invariants verified by release contract:
- Production `config.js` remained Production-only and was not replaced by Staging config.
- Staging package/tooling/tests/scripts and runtime-divergence metadata were not promoted into Production runtime.
- Production Service Worker is the exact vetted Staging asset projection with a Production-only cache prefix/identity.
- no database migration was introduced solely for Modules 4, 5, 7 or 9.
- no connector credential, Service Role secret, automatic posting/payment/approval or external submission was enabled.

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

RC1.8 current status is deliberately separated from those permanent Live markers:
- Modules 4, 5, 7 and 9 = authenticated **Staging Live PASS / CLOSED**.
- RC1.8 runtime promotion = **MERGED**.
- RC1.8 automated Production gates + Pages = **PASS**.
- RC1.8 authenticated Production Smoke = **PENDING**.

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

Current backend truth retained from RC1.8 readiness verification:
- journal_entries = **94**.
- financial_transactions = **24**.
- invoices = **42**.
- documents = **23**.
- inventory_documents = **9**.
- orphan journal lines = 0; cross-workspace journal-line mismatches = 0; unbalanced Posted journals = 0.
- orphan invoice lines = 0; cross-workspace invoice-line mismatches = 0.
- journal lines with fractional Toman = 42; one-Rial exactness is exercised by real data.
- effective public anon/auth `SECURITY DEFINER` exposure = 0.

A fresh post-Production-Smoke read-only verification is still required before RC1.8 final Live closure.

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
- Module 4 = Engineering PASS + authenticated Staging Live PASS + RC1.8 Production-promoted; Production Smoke pending.
- Module 5 = Engineering PASS + authenticated Staging Live PASS + RC1.8 Production-promoted; Production Smoke pending.
- Module 7 = Engineering PASS + authenticated Staging Live PASS + RC1.8 Production-promoted; Production Smoke pending.
- Module 9 = Engineering PASS + authenticated Staging Live PASS + RC1.8 Production-promoted; Production Smoke pending.

ADR-0023 capability train is complete for the currently defined scope. Current architectural train: **RC1.8 Production smoke / release closure for Modules 4, 5, 7 and 9**.

---

## 5) Modules 4 and 5 — Staging accepted / RC1.8 Production-promoted

Module 4 — Continuous Close + Continuous Audit:
- PR #164 foundation; PR #170 Live polish/parity; PR #172 print/4+3; PR #175 final Jalali hidden-ISO fix.
- final Staging user acceptance = **«مورد تایید است برو گام بعد»**.
- `writeOperations = 0`; `actualLedgerMutation = false`.
- promoted to Production in RC1.8 via PR #189.
- authenticated Production Smoke = **pending**.

Module 5 — Iran Compliance Radar:
- PR #176 foundation merge `2f7185aa3cc46f735387689274f4db8667d56081`.
- PR #177 runtime-parity hardening merge `7c3fcb636fa419200b37da30fc477771a7c0a6fb`.
- explicit Staging user confirmation = **«Module 5 Iran Compliance Radar Live PASS»**.
- post-Live read-only Supabase verification = **94 journal entries / 24 financial transactions / 42 invoices / 23 documents** with unchanged latest timestamps.
- no fabricated legal deadlines; payroll/insurance remain explicitly unsupported until authoritative data exists.
- promoted to Production in RC1.8 via PR #189.
- authenticated Production Smoke = **pending**.

---

## 6) ADR-0024, ADR-0025 and ADR-0026

ADR-0024 — Production/Staging Runtime Parity Contract = **Accepted**.
- shared runtime must be byte-identical unless explicitly allowlisted.
- active runtime scope is Service Worker `ASSETS`.
- parity never authorizes Production promotion by itself.
- Staging runtime changes advance cache identity.
- RC1.8 promotion used the exact vetted Staging runtime projection, excluding Production-only configuration and Staging-only tooling/metadata.

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
- Module 9 foundation intentionally enables registry/marketplace/preview only; RC1.8 promotion does not activate generic external execution.

---

## 7) Module 7 — Smart Procurement & Spend Control — Staging Live PASS / RC1.8 Production-promoted

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
- Staging acceptance cache = `avan-staging-rc1-v119-smart-procurement-spend-control`.

Authenticated Staging Live acceptance:
- first Live pass confirmed navigation, date rerun, Persian UI, Print/PDF and other visible surfaces; no operational finding was available in the initially selected company/date, so evidence controls were not yet observable.
- user changed the as-of date to **۱۴۰۵/۰۵/۰۷** and confirmed the displayed data changed accordingly without creating records.
- direct read-only database inspection identified real test data in **«شرکت وفاداران نیما»** on `2026-09-07` / **۱۴۰۵/۰۶/۱۶**: one inventory receipt line linked to 5 purchase-invoice lines and 4 quantity mismatches.
- targeted follow-up Live test on that real-data scope was accepted by the user with **«اوکی بود پاس شود»**.
- Module 7 authenticated Staging Live = **PASS / CLOSED**.

Pre-Live baseline and post-Live mutation verification were identical:
- journal_entries = **94**; latest created_at = `2026-09-12 19:32:07.685779+00`.
- financial_transactions = **24**; latest = `2026-09-10 21:16:55.697626+00`.
- invoices = **42**; latest = `2026-09-10 16:37:20.676074+00`.
- documents = **23**; latest = `2026-09-07 21:11:31.272166+00`.
- inventory_documents = **9**; latest = `2026-09-07 12:44:33.272324+00`.
- therefore Module 7 remained mutation-free in authenticated Staging Live use.

RC1.8 Production status:
- promoted through PR #189.
- automated Production gates = PASS.
- authenticated Production Smoke = **pending**.

---

## 8) Module 9 — Avan Connect / Automation Marketplace — Staging Live PASS / RC1.8 Production-promoted

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
- initial Module 9 Staging cache = `avan-staging-rc1-v120-avan-connect-marketplace`.
- permanent regression marker = **`Avan Connect / Automation Marketplace foundation PASS`**.
- `sw-precache-integrity = PASS (214 declared runtime entries)`.
- architecture high findings = **0**; money architecture findings = **0**.

Authenticated Staging Live acceptance:
- explicit main Live confirmation = **«ماژول ۹ اتصال و اتوماسیون — آزمون زنده پاس شد»**.
- Live confirmed truthful connector states, preview-only workflows, Persian presentation, refresh/print surfaces and no automatic financial/external execution.
- user reported two visual defects after functional PASS: compact spacing in **«قواعد اجرای امن»** and text overflow/collision in multi-part labels/cards such as **«ورود فایل / پیش‌نمایش / تطبیق بانکی»**.
- PR #186 **Module 9 Live polish: fix text wrapping and guardrail spacing** fixed the defects with styles scoped only to `.avan-connect`; no financial logic, connector execution or database behavior changed.
- PR #186 merge = `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- pre-merge Architecture Gate #317 = **PASS**; post-merge Architecture Gate #318 = **PASS**; GitHub Pages #429 = **PASS**.
- final Staging acceptance cache = `avan-staging-rc1-v121-module9-live-layout-polish`.
- explicit final visual confirmation = **«چیدمان ماژول ۹ نهایی PASS»**.
- Module 9 authenticated Staging Live = **PASS / CLOSED**.

Pre-Live baseline and final post-Live read-only mutation verification were identical:
- journal_entries = **94**; latest created_at = `2026-09-12 19:32:07.685779+00`.
- financial_transactions = **24**; latest = `2026-09-10 21:16:55.697626+00`.
- invoices = **42**; latest = `2026-09-10 16:37:20.676074+00`.
- documents = **23**; latest = `2026-09-07 21:11:31.272166+00`.
- inventory_documents = **9**; latest = `2026-09-07 12:44:33.272324+00`.
- therefore Module 9 remained mutation-free throughout authenticated Staging Live and final layout retest.

RC1.8 Production status:
- promoted through PR #189.
- automated Production gates = PASS.
- generic external execution remains disabled.
- authenticated Production Smoke = **pending**.

---

## 9) RC1.8 release evidence

Readiness closure:
- PR #188 = **RC1.8 release readiness: freeze rollback and promotion manifest**.
- readiness result = **PASS**, while promotion remained separately approval-gated.
- rollback point = `prod-backup-20260914-rc1-8-pre-promotion`.
- accepted Staging runtime baseline includes final Module 9 runtime merge `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- accepted Staging cache = `avan-staging-rc1-v121-module9-live-layout-polish`.

Controlled Production promotion:
- PR #189 = **RC1.8 Production promotion: Modules 4, 5, 7 and 9**.
- explicit approval = **«RC1.8 Production Promotion APPROVED»**.
- promotion branch head = `c3c2fe5f448aa4937bc08bad8debbadfa436b0f3`.
- Production merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- Production cache = `avan-prod-rc1-8-v1`.
- Production configuration was preserved; no Staging config/tooling/metadata was copied into the Production contract.
- pre-merge Architecture Gate #322 = PASS; Production Release Gate #25 = PASS.
- post-merge Architecture Gate #323 = PASS; Production Release Gate #26 = PASS; GitHub Pages #432 = PASS.

Release acceptance boundary:
- automated engineering/deployment evidence is complete.
- authenticated Production behavior has **not yet been explicitly accepted** after RC1.8 merge.
- therefore the release is **promoted but not yet final Production Live-closed**.

---

## 10) Current canonical pointers

Production:
- current release = **RC1.8**.
- merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- Production Service Worker = `avan-prod-rc1-8-v1`.
- Modules 4, 5, 7 and 9 = Production-promoted.
- Architecture Gate #323 = PASS.
- Production Release Gate #26 = PASS.
- GitHub Pages #432 = PASS.
- authenticated Production Smoke = **PENDING**.

Staging:
- Module 4 = Engineering + authenticated Live PASS / CLOSED.
- Module 5 = Engineering + authenticated Live PASS / CLOSED.
- Module 7 = Engineering + authenticated Live PASS / CLOSED.
- Module 9 = Engineering + authenticated Live PASS / CLOSED.
- current Staging cache = `avan-staging-rc1-v121-module9-live-layout-polish`.
- final accepted runtime merge before promotion = `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- latest Staging acceptance Architecture marker = #318 PASS.
- latest Staging acceptance Pages marker = #429 PASS.

Next train: **RC1.8 authenticated Production Smoke for Modules 4, 5, 7 and 9 → post-smoke read-only DB/integrity verification → final RC1.8 Production Live closure**.
