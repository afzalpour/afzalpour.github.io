# Avan Module Contracts V1

Status: FROZEN
Architecture Gate: C-7.3
Product: Avan Smart Accounting

---

## 1. هدف

این سند مرز مسئولیت ماژول‌های آوان را تعریف می‌کند.

هیچ ماژولی نباید مستقیماً مسئولیت ماژول دیگر را بر عهده بگیرد.

هدف:

- جلوگیری از Monolith
- امکان توسعه مستقل ماژول‌ها
- اشتراک Business Logic بین Web / Android / PWA
- امکان تست مستقل
- آمادگی برای OCR و AI
- آمادگی برای Dynamic Reports
- کاهش وابستگی UI به Database

---

# 2. Dependency Direction

جهت کلی وابستگی:

Platform / UI
    ↓
Application / Domains
    ↓
Core Contracts
    ↓
Infrastructure Adapters
    ↓
Supabase / External Services

Reports و AI باید از Contractهای تعریف‌شده استفاده کنند و نباید مستقیماً UI را کنترل کنند.

---

# 3. src/core

مسئول:

- Authentication contracts
- Session context
- Workspace context
- Permissions
- Accounting primitives
- Shared errors
- Shared result types
- Date / Money primitives
- Ledger contracts
- Audit context

core نباید:

- HTML تولید کند
- Modal باز کند
- مستقیماً DOM را تغییر دهد
- به Android یا Web وابسته باشد
- OCR اجرا کند
- Report UI تولید کند

---

# 4. src/domains

مسئول Business Rules است.

Domainهای اصلی:

- accounts
- parties
- invoices
- journals
- payments
- banking
- receivables
- payables
- inventory
- tax
- cost-centers

هر Domain باید بتواند شامل این بخش‌ها باشد:

- model
- service
- repository contract
- validators
- commands
- queries

Domains نباید:

- مستقیماً document.querySelector استفاده کنند
- HTML بسازند
- Service Worker را کنترل کنند
- Camera API را صدا بزنند
- مستقیماً UI Notification بسازند

---

# 5. src/documents

مسئول:

- Document metadata
- File references
- Upload contracts
- Storage adapters
- Document links
- OCR job lifecycle
- Extraction results
- Confidence scores
- Review workflow

Document workflow:

Captured
→ Uploaded
→ OCR Pending
→ Extracted
→ Review Required
→ Approved
→ Linked

Documents نباید مستقیم Journal را Post کنند.

---

# 6. src/reports

مسئول:

- Semantic Model
- Subjects
- Dimensions
- Measures
- Filters
- Sort
- Group
- Saved Report Definition
- Report Query Planning
- Drill-down
- Data Lineage
- Dashboard measures

Reports نباید:

- SQL آزاد از ورودی User اجرا کنند
- RLS را دور بزنند
- مستقیماً DOM بسازند
- نتیجه AI را بدون Validation Query اجرا کنند

---

# 7. src/ai

مسئول:

- Accounting Assistant
- Natural Language Report Parsing
- Why This Number explanations
- OCR interpretation
- Accounting suggestions
- Duplicate detection
- Anomaly detection
- Variance explanation

AI Principle:

AI proposes.
Core validates.
User approves.
Domain executes.
Ledger records.

AI نباید:

- مستقیماً SQL دلخواه اجرا کند
- مستقیم Ledger را Post کند
- Permission را دور بزند
- بدون Audit Action ایجاد کند

---

# 8. src/ui

مسئول:

- Components
- Forms
- Modals
- Navigation
- Tables
- Responsive Views
- Jalali input
- Validation presentation
- Loading states
- Error presentation

UI باید از Service / Command / Query استفاده کند.

UI نباید:

- Business Rule اصلی را تعیین کند
- Accounting logic را محاسبه کند
- مستقیم Supabase RPCهای Domain را پراکنده صدا بزند

---

# 9. src/platform/web

مسئول Web-specific behavior:

- Browser integration
- Web navigation
- Browser storage adapter
- Service Worker integration
- File picker
- Clipboard
- Web notifications

---

# 10. src/platform/android

مسئول Android-specific adapters:

- Camera
- File system
- Secure storage
- Share sheet
- Push notification
- Native lifecycle
- Network state
- Offline integration

Business Logic نباید داخل این پوشه قرار گیرد.

---

# 11. src/platform/pwa-ios

مسئول iPhone PWA behavior:

- Add to Home Screen compatibility
- iOS PWA lifecycle
- Camera/photo capture
- File selection
- Offline shell
- Touch-specific behavior
- iOS browser limitations

Business Logic نباید داخل این پوشه قرار گیرد.

---

# 12. Repository Contract

Domain Service نباید مستقیماً Supabase syntax را بداند.

مثال:

InvoiceService

به جای:

C.select(...)
C.rpc(...)

باید به Contractهایی مانند زیر وابسته باشد:

InvoiceRepository
JournalRepository
PartyRepository
DocumentRepository

Infrastructure implementation می‌تواند از Supabase استفاده کند.

---

# 13. Command / Query Separation

برای عملیات مالی:

Commands:

- CreateDraftInvoice
- PostInvoice
- ReverseInvoice
- RecordReceipt
- RecordPayment
- PostJournal

Queries:

- GetInvoice
- ListInvoices
- GetPartyBalance
- GetJournal
- GetAccountBalance
- RunReport

Command تغییر ایجاد می‌کند.

Query فقط داده می‌خواند.

---

# 14. Accounting Write Rule

هر Write حسابداری حساس باید مسیر مشخص داشته باشد:

UI / AI
→ Command
→ Permission Check
→ Domain Validation
→ Database Transaction / RPC
→ Ledger
→ Audit Event
→ Result

نباید Write حساس از UI مستقیم به جدول‌های Posted انجام شود.

---

# 15. Cross-platform Rule

این بخش‌ها باید Shared باشند:

- Core
- Domain logic
- Report definitions
- Semantic model
- AI contracts
- Validation
- Accounting rules

این بخش‌ها Platform-specific هستند:

- Camera
- File picker
- Notifications
- Secure storage
- PWA lifecycle
- Android lifecycle
- Browser integration

---

# 16. Data Access Rule

هیچ Module نباید برای راحتی RLS را دور بزند.

تمام Data Access باید:

- Workspace-aware
- Permission-aware
- Auditable
- Testable

باشد.

---

# 17. Error Contract

خطاهای Business باید Code داشته باشند.

مثال:

INVOICE_NOT_FOUND
PERIOD_CLOSED
ACCOUNT_NOT_POSTABLE
PARTY_REQUIRED

UI فقط Error Code را به پیام فارسی تبدیل می‌کند.

---

# 18. Audit Contract

Actionهای مهم باید قابلیت ثبت Audit داشته باشند.

حداقل:

- actor_user_id
- workspace_id
- action
- entity_type
- entity_id
- before
- after
- source
- created_at

source می‌تواند باشد:

- web
- android
- pwa
- ai
- api

---

# 19. ممنوعیت‌ها

از این مرحله به بعد ممنوع است:

- افزودن Feature بزرگ مستقیم به app.js
- قرار دادن Business Logic داخل UI
- SQL آزاد تولیدشده توسط AI
- Post مستقیم AI به Ledger
- Platform-specific logic داخل Domain
- Cross-workspace data access
- استفاده از Report Engine برای دور زدن RLS

---

# 20. Definition of Done

هر Module جدید وقتی کامل است که:

1. Contract مشخص داشته باشد.
2. Business Rule از UI جدا باشد.
3. Platform-independent باشد مگر Adapter.
4. RLS-compatible باشد.
5. Error Code مشخص داشته باشد.
6. تست‌پذیر باشد.
7. Audit path داشته باشد.
8. Data lineage در صورت مالی بودن قابل تعریف باشد.
