# AVAN — Intelligent Finance Strategic Roadmap

Date: 2026-09-10  
Status: **Approved Product Architecture**  
Authority: ADR-0023

## Product thesis

آوان باید از «نرم‌افزار حسابداری/ERP» به **Intelligent Finance Operating System** تبدیل شود:

> آوان فقط نمی‌گوید چه اتفاقی افتاده؛ می‌گوید چرا اتفاق افتاده، بعد چه می‌شود، و الان چه اقدام کنترل‌شده‌ای باید انجام شود.

این Roadmap مکمل ماژول‌های Core/ERP است و جایگزین قواعد امنیت، Ledger، RLS، one-Rial precision یا Human-controlled automation نمی‌شود.

## Strategic modules

### P0 — Early differentiators

#### 1) Avan Financial Control Tower

هدف: تبدیل Dashboard به مرکز فرمان مالی روزانه.

خروجی‌های هدف:
- Cash position و runway؛
- مطالبات/بدهی‌های مهم و سررسید؛
- unresolved bank reconciliation؛
- inventory/control risks؛
- close readiness؛
- prioritized actions؛
- Drill-down و Why-number برای هر KPI مهم.

Foundation باید deterministic و Ledger-grounded باشد؛ narrative/AI مرحله بعدی است.

#### 2) Financial Digital Twin

هدف: مدل‌سازی آینده شرکت بدون دستکاری Actual Ledger.

قابلیت‌ها:
- Baseline snapshot؛
- Base vs Scenario؛
- sales/revenue shock؛
- collection delay؛
- cost/procurement shock؛
- liquidity impact؛
- working-capital impact؛
- scenario assumptions + provenance.

هیچ Scenario حق Posting، Reversal یا rewrite Actual data ندارد.

### P1 — High-value intelligence

#### 3) Working Capital Autopilot
- AR collection priority؛
- late-payment risk؛
- supplier payment prioritization؛
- cash-impact ranking؛
- suggested Human-approved actions.

#### 4) Continuous Close + Continuous Audit
- readiness score؛
- duplicate/anomaly/integrity checks؛
- unreconciled queues؛
- unusual postings؛
- period/control risk؛
- continuous evidence trail.

#### 5) Iran Compliance Radar
- versioned regulatory obligations؛
- deadlines؛
- tax/payroll/insurance/e-invoice impact mapping؛
- compliance readiness and exception queue.

#### 6) Counterparty 360
- Party Ledger + invoices + checks + bank + documents؛
- payment behavior؛
- credit risk؛
- profitability؛
- open obligations؛
- financial relationship score with explainable factors.

### P2 — Platform differentiators

#### 7) Smart Procurement & Spend Control
- requisition / PO / receipt / invoice / matching / approval / payment؛
- budget/policy controls؛
- anomaly and duplicate prevention؛
- auditable approval chain.

#### 8) Avan Evidence Graph
- common financial lineage layer across Ledger, Treasury, AR/AP, Inventory, Tax, Documents and Approval؛
- source links for every important number؛
- primary grounding layer for AI and Continuous Audit.

#### 9) Avan Connect / Automation Marketplace
- bank/POS/store/Excel/API connectors؛
- idempotent sync؛
- auditable workflows؛
- Human-controlled financial actions؛
- event/condition based automations.

## Execution sequence

### Phase R — Finish current release boundary

1. Record RC1.6 final Live PASS.
2. Freeze RC1.6 Release Candidate.
3. Full Architecture/Regression/PWA/Security/DB integrity Gate.
4. Create fresh rollback freeze.
5. Prepare controlled Staging → Production promotion.
6. Production Release Gate + post-release verification.

### Phase I0 — Early Intelligence Foundation

Immediately after RC1.6 release boundary is frozen:

1. Evidence/metric contract for Control Tower.
2. Control Tower deterministic KPI foundation.
3. Why-number / source-reference drill-down.
4. Digital Twin pure scenario domain model.
5. Baseline snapshot + Base vs Scenario.
6. First liquidity/collection/cost scenarios.
7. Live Gate before expanding AI narrative.

### Phase T — Treasury completeness

Checks, maturity workflow, bank intelligence, reconciliation depth and cash planning.

### Phase S/I — Sales/Purchase + Inventory completeness

Commercial lifecycle, AR/AP maturity, stock/costing maturity and accounting traceability.

### Phase C — Compliance/Tax

Production-grade electronic invoice, compliance radar and regulatory versioning.

### Phase E — ERP depth

Payroll, Fixed Assets, Workflow/Approval, Budget/Forecast and Multi-company consolidation.

### Phase P — Intelligence platform

Working Capital Autopilot, Continuous Close/Audit, Counterparty 360, Smart Procurement, Evidence Graph expansion and Connect marketplace.

### Phase AI — Advanced Finance Intelligence

CFO Autopilot, proactive recommendations, natural-language controlled reporting, forecasting and decision intelligence.

### Phase V — Voice and multimodal

Voice commands, OCR/document understanding and multimodal finance assistance under explicit Human Review.

## Portfolio rules

- Reliability before feature count.
- Financial clarity before decoration.
- Deterministic calculations before LLM interpretation.
- Evidence before recommendation.
- Human approval before sensitive financial action.
- No cross-company data leakage.
- No silent rounding below one Rial.
- Actual, Forecast and Scenario datasets remain explicitly separated.
- New modules should enrich the Evidence Graph rather than create isolated silos.

## Not a priority

آوان فعلاً CRM عمومی، Project Management عمومی و HR غیرمالی جامع را به‌عنوان Core محصول نمی‌سازد. فقط بخش‌هایی که مستقیماً اثر مالی دارند ساخته می‌شوند؛ سایر نیازها ترجیحاً از طریق Avan Connect پوشش داده خواهند شد.
