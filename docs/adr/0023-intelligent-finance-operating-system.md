# ADR-0023 — Intelligent Finance Operating System / Strategic Differentiation

- Status: Accepted
- Date: 2026-09-10
- Related: ADR-0005, ADR-0008, ADR-0011, ADR-0015, ADR-0016, ADR-0019, ADR-0020, ADR-0022

## Context

آوان نباید صرفاً با افزایش تعداد ماژول‌های حسابداری با محصولات داخلی و خارجی رقابت کند. مزیت پایدار محصول باید از ترکیب داده مالی قابل اتکا، قابلیت ردیابی، پیش‌بینی، کنترل مستمر و اقدام Human-controlled ساخته شود.

هدف راهبردی آوان از این پس تبدیل‌شدن از Accounting/ERP به یک **Intelligent Finance Operating System** است؛ سیستمی که فقط «چه اتفاقی افتاده» را گزارش نکند، بلکه «چرا»، «بعد چه می‌شود» و «چه اقدام کنترل‌شده‌ای مناسب است» را نیز پاسخ دهد.

## Decision

نه ماژول/Capability زیر به معماری و Roadmap رسمی آوان اضافه می‌شوند:

1. **Avan Financial Control Tower — برج کنترل مالی**
   - نمای مدیریتی روزانه بر نقدینگی، تعهدات، مطالبات، ریسک‌ها، موجودی و اقدامات اولویت‌دار.
   - هر هشدار/عدد مهم باید Drill-down و پاسخ «چرا؟» داشته باشد.

2. **Financial Digital Twin — دوقلوی مالی کسب‌وکار**
   - موتور سناریو و What-if روی Cash Flow، سود، مالیات، موجودی، بدهی و سرمایه در گردش.
   - سناریوها Simulation هستند و نباید خودکار Ledger/Post ایجاد کنند.

3. **Working Capital Autopilot — اتوپایلوت سرمایه در گردش**
   - پیش‌بینی ریسک وصول، اولویت‌بندی مطالبات، پیشنهاد زمان اقدام، بهینه‌سازی پرداخت تأمین‌کنندگان و اثر نقدی.

4. **Continuous Close + Continuous Audit — بستن و حسابرسی مستمر**
   - Close readiness، مغایرت، Duplicate، anomaly، integrity، unusual amount و کنترل‌های دوره‌ای مستمر.

5. **Iran Compliance Radar — رادار هوشمند تعهدات قانونی ایران**
   - تقویم و اثرسنجی تعهدات مالیاتی/بیمه/حقوق/صورتحساب الکترونیکی و تغییرات مقررات.
   - قوانین متغیر باید versioned/configurable باشند.

6. **Counterparty 360 — پرونده مالی هوشمند طرف‌حساب**
   - توسعه Party Ledger به نمای واحد طلب/بدهی/چک/فاکتور/رفتار پرداخت/ریسک اعتباری/سودآوری و اسناد مرتبط.

7. **Smart Procurement & Spend Control — خرید و کنترل هزینه هوشمند**
   - Request → PO → Receipt → Invoice → 2/3-way match → Approval → Payment، همراه Policy Engine و کنترل بودجه/ناهنجاری.

8. **Avan Evidence Graph — گراف شواهد مالی**
   - ارتباط قابل ردیابی Bank ↔ Financial Transaction ↔ Invoice ↔ Party ↔ Journal ↔ Inventory ↔ Document ↔ Tax ↔ Approval.
   - اصل محصول: **هیچ عدد مهمی بدون Evidence و lineage قابل بررسی نباشد.**

9. **Avan Connect / Automation Marketplace — پلتفرم اتصال و اتوماسیون**
   - Connector و Workflow برای بانک، POS، فروشگاه، Excel/CSV، API و سرویس‌های بیرونی.
   - Integrationها idempotent و auditable باشند.

## Priority Decision

ماژول‌های 1 و 2 به درخواست محصول و با تأیید صریح کاربر **Early Priority** هستند.

ترتیب اجرا:

1. RC1.6 Release Candidate consolidation و Production Release Gate؛
2. بلافاصله پس از freeze/release boundary، **Control Tower Foundation + Digital Twin Foundation** در Staging شروع شود؛
3. این Foundation نباید انتشار RC1.6 را با Feature creep مخلوط کند؛
4. سپس Treasury/Checks، Sales/Purchase completeness و Inventory completeness ادامه می‌یابد؛
5. Evidence Graph به‌صورت cross-cutting در هر Feature جدید توسعه یابد؛
6. سایر ماژول‌های 3 تا 9 در مناسب‌ترین نقطه Roadmap و بر پایه داده Source-of-Truth اجرا شوند.

## Control Tower Foundation — Minimum Architecture

Foundation اولیه باید بدون AI مبهم و بدون داده ساختگی، از Ledger-grounded metrics شروع شود:

- Cash position واقعی؛
- AR/AP gross exposure؛
- overdue/near-due obligations در صورت وجود داده معتبر؛
- bank reconciliation unresolved count/value؛
- open inventory/control risks موجود؛
- close readiness primitives؛
- «چرا این عدد؟» با source references.

AI narrative فقط روی Metricهای deterministic و evidence-backed سوار می‌شود.

## Digital Twin Foundation — Minimum Architecture

Digital Twin ابتدا یک **pure scenario engine** خواهد بود:

- baseline snapshot از داده قطعی؛
- scenario inputs صریح و قابل حذف؛
- projection بدون نوشتن در Ledger؛
- نتیجه deterministic تا حد امکان؛
- provenance برای baseline و assumptions؛
- مقایسه Base vs Scenario؛
- سناریوی نمونه: تغییر فروش، تاخیر وصول، افزایش هزینه/خرید و شوک نقدینگی.

## Guardrails / Invariants

- PostgreSQL/Supabase financial data remains Source of Truth.
- هیچ AI/Agent حق Silent Posting، Silent Payment یا تغییر خودکار سند قطعی ندارد.
- Forecast/Simulation با Actual Ledger مخلوط نمی‌شود و namespace/model جدا دارد.
- هر عدد مدیریتی مهم باید به Evidence قابل ردیابی باشد.
- Company/RLS boundary در تمام Intelligence/Scenario/Connector layers اجباری است.
- Canonical money و one-Rial precision تحت ADR-0019 حفظ می‌شود.
- Simulation نباید history مالی را Rewrite کند.
- AI confidence و assumption باید قابل مشاهده/توضیح باشد.
- Rule-based deterministic calculation بر LLM arithmetic ترجیح دارد.
- Browser نباید secret/provider credential دریافت کند.
- Integration write paths باید idempotent، auditable و Human-controlled باشند.
- Featureهای هوشمند باید graceful degradation داشته باشند؛ Core accounting بدون AI هم صحیح و قابل استفاده می‌ماند.

## Rejected Alternatives

- ساخت Chatbot عمومی بدون grounding به Ledger.
- AI-first automation قبل از کامل‌شدن Evidence/Data contracts.
- ترکیب Forecast با Actual در جداول مالی منبع حقیقت.
- افزودن CRM/Project/HR عمومی صرفاً برای افزایش تعداد Featureها؛ این موارد فقط در مرز مالی یا از طریق Integration وارد می‌شوند.
- توقف انتشار RC1.6 برای افزودن Control Tower/Digital Twin؛ این Foundation در چرخه بعدی Staging شروع می‌شود.

## Gate

هر Capability این ADR باید Gate مستقل داشته باشد. برای Control Tower/Digital Twin حداقل Gate شامل موارد زیر است:

- deterministic calculation correctness؛
- exact one-Rial preservation؛
- Company/RLS isolation؛
- Evidence/drill-down completeness؛
- no financial mutation from scenario/analysis؛
- Base vs Scenario reproducibility؛
- mobile/RTL/print presentation where applicable؛
- explicit user Live PASS before Production promotion.
