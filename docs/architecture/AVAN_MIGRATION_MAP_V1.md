# Avan Migration Map V1

Status: FROZEN
Architecture Gate: C-7.3B
Source: current monolithic app.js

---

## 1. هدف

این سند مشخص می‌کند کد موجود app.js به کدام ماژول جدید منتقل خواهد شد.

قاعده اصلی:

- انتقال تدریجی است.
- Production main دست‌نخورده می‌ماند.
- هر مرحله باید Regression Test داشته باشد.
- هیچ تابعی فقط برای کوچک‌کردن app.js جابه‌جا نمی‌شود؛ مسئولیت معماری باید روشن باشد.

---

## 2. معماری Target

ساختار هدف:

src/
  core/
  application/
  infrastructure/
  domains/
  documents/
  reports/
  ai/
  ui/
  platform/
    web/
    android/
    pwa-ios/

---

## 3. Dependency Direction

UI / Platform
        ↓
Application
        ↓
Domains
        ↓
Core Contracts
        ↑
Infrastructure Adapters

Infrastructure پیاده‌سازی Contractها است.

Domain نباید Supabase را بشناسد.

---

# 4. Core Migration

توابع Pure مربوط به تاریخ:

- jalCal
- g2d
- d2g
- j2d
- d2j
- jalaliToIso
- jalaliMonthDays
- isoToJalali

Target:

src/core/date/jalali.js

وظیفه:

- تبدیل Gregorian/Jalali
- بدون DOM
- بدون Supabase
- بدون UI

---

# 5. UI Date Migration

توابع:

- jalalizeDateInputs
- closeJalaliPicker
- openJalaliPicker
- bindJalaliPickers

Target:

src/ui/date/jalali-picker.js

این فایل مجاز است DOM را کنترل کند ولی منطق تبدیل تاریخ باید از:

src/core/date/jalali.js

وارد شود.

---

# 6. Error Presentation

تابع:

- msgFor

Target:

src/ui/errors/error-messages-fa.js

نکته:

Business Error Code باید از Core/Domain بیاید.

UI فقط Code را به پیام فارسی تبدیل می‌کند.

---

# 7. UI Feedback

توابع:

- toast
- showError

Target:

src/ui/feedback/toast.js

---

# 8. Modal UI

توابع:

- openModal
- closeModal

Target:

src/ui/components/modal.js

---

# 9. Application Shell / Navigation

توابع:

- setTitle
- setNav
- page
- navigate
- render
- bind

Target:

src/application/shell/app-controller.js

و بخش DOM-specific آن در:

src/ui/shell/

تقسیم خواهد شد.

قاعده:

app-controller تصمیم می‌گیرد چه View نمایش داده شود.

UI فقط آن را Render می‌کند.

---

# 10. Context Loading

توابع:

- loadContext
- reloadAndRender

Target:

src/application/context/workspace-context.js

اما Data Access داخل این توابع باید بعداً به Repositoryها منتقل شود.

این فایل نباید در حالت نهایی مستقیماً C.select یا C.rpc داشته باشد.

---

# 11. Authentication

توابع:

- showApp
- showAuth
- setAuthMode
- passwordRecoveryModal

Target تقسیم‌شده:

src/application/auth/auth-controller.js

و:

src/ui/auth/auth-view.js

Data access:

src/infrastructure/auth/supabase-auth-adapter.js

---

# 12. Dashboard

تابع:

- renderDashboard

Target:

src/ui/dashboard/dashboard-view.js

داده Dashboard در آینده باید از:

src/reports/

و Semantic Model دریافت شود.

Dashboard نباید خودش محاسبات مالی مستقل داشته باشد.

---

# 13. Accounts Domain

توابع فعلی:

- renderAccounts
- accountModal
- toggleArchive
- deleteAccount
- openingModal

تقسیم:

Business / Use Cases:

src/domains/accounts/

UI:

src/ui/accounts/

Infrastructure:

src/infrastructure/repositories/supabase-account-repository.js

Commands آینده:

- CreateAccount
- RenameAccount
- ArchiveAccount
- ActivateAccount
- DeleteAccount
- RecordOpeningBalance

---

# 14. Parties Domain

توابع:

- renderParties
- partyModal

تقسیم:

src/domains/parties/
src/ui/parties/
src/infrastructure/repositories/supabase-party-repository.js

Commands:

- CreateParty
- UpdateParty
- ArchiveParty

Queries:

- GetParty
- ListParties
- GetPartyBalance

---

# 15. Invoice Pure Logic

توابع:

- qtyMilli
- invoiceAmount

Target:

src/domains/invoices/invoice-calculator.js

این دو تابع باید Pure باقی بمانند.

---

# 16. Invoice UI Helpers

توابع:

- invoicePartyOptions
- invoiceAccountOptions
- invoiceLineRow
- updateInvoiceTotals
- bindInvoiceLines

Target:

src/ui/invoices/

Business validation نباید در این فایل‌ها باقی بماند.

---

# 17. Invoice Main Flow

توابع:

- renderInvoices
- invoiceModal
- viewInvoice
- reverseInvoiceModal

تقسیم:

Application:

src/application/invoices/invoice-controller.js

Domain:

src/domains/invoices/

UI:

src/ui/invoices/

Infrastructure:

src/infrastructure/repositories/supabase-invoice-repository.js

Commands:

- CreateDraftInvoice
- UpdateDraftInvoice
- DeleteDraftInvoice
- PostInvoice
- ReverseInvoice

Queries:

- GetInvoice
- ListInvoices
- GetInvoiceLines

---

# 18. Journal Domain

توابع:

- renderJournal
- lineRow
- bindLines
- updateLineTotals
- journalModal
- viewJournal
- reverseModal

تقسیم:

src/domains/journals/
src/application/journals/
src/ui/journals/
src/infrastructure/repositories/supabase-journal-repository.js

Commands:

- CreateDraftJournal
- UpdateDraftJournal
- DeleteDraftJournal
- PostJournal
- ReverseJournal

Queries:

- GetJournal
- ListJournals

---

# 19. Financial Operations

تابع:

- operationModal

این تابع فعلی چند مسئولیت دارد و باید شکسته شود.

Target:

Domain:

src/domains/payments/
src/domains/banking/

Application:

src/application/financial-operations/

UI:

src/ui/financial-operations/

Commands:

- RecordReceipt
- RecordPayment
- RecordTransfer

هیچ منطق مالی نباید در Modal باقی بماند.

---

# 20. Reporting

توابع:

- reportToolbar
- renderReports
- refreshLedger

این بخش نباید صرفاً منتقل شود.

این بخش بعداً با Semantic Report Engine جایگزین خواهد شد.

Legacy Target موقت:

src/reports/legacy/

Target نهایی:

src/reports/semantic/
src/reports/engine/
src/reports/lineage/
src/reports/saved-reports/
src/reports/dashboard/

---

# 21. Settings

تابع:

- renderSettings

Target:

src/ui/settings/settings-view.js

Core health queries باید از Application/Infrastructure بیایند.

---

# 22. Fiscal Period

تابع:

- closePeriodModal

تقسیم:

Domain:

src/domains/fiscal/

Application:

src/application/fiscal/

UI:

src/ui/fiscal/

Command:

- CloseFiscalPeriod
- ReopenFiscalPeriod

---

# 23. cloud.js Migration

cloud.js در معماری نهایی نباید Global utility برای همه ماژول‌ها باشد.

Target:

src/infrastructure/supabase/

تقسیم پیشنهادی:

- supabase-client.js
- auth-adapter.js
- rest-adapter.js
- rpc-adapter.js
- storage-adapter.js

Domains نباید مستقیماً این فایل‌ها را Import کنند.

---

# 24. config.js Migration

Target:

src/core/config/

Platform-specific configuration از Adapter دریافت می‌شود.

Secret واقعی نباید در Frontend قرار گیرد.

Publishable client configuration مجاز است.

---

# 25. Service Worker

sw.js

Target ownership:

src/platform/web/
src/platform/pwa-ios/

Service Worker مسئول Business Logic نیست.

---

# 26. Future Documents

Target:

src/documents/

Submodules:

- model
- upload
- storage
- links
- ocr-jobs
- extraction
- confidence
- review

---

# 27. Future AI

Target:

src/ai/

Submodules:

- accounting-assistant
- why-number
- nl-report
- document-understanding
- anomaly
- duplicate-detection
- variance-analysis

AI باید فقط Contractهای مجاز را مصرف کند.

---

# 28. Future Platform Modules

Web:

src/platform/web/

Android:

src/platform/android/

iPhone PWA:

src/platform/pwa-ios/

منطق مشترک نباید در این پوشه‌ها Duplicate شود.

---

# 29. Migration Order

ترتیب انتقال کد:

Phase 1
Core Pure Utilities

Phase 2
UI primitives

Phase 3
Infrastructure / Supabase

Phase 4
Authentication

Phase 5
Accounts

Phase 6
Parties

Phase 7
Invoices

Phase 8
Journals

Phase 9
Financial Operations

Phase 10
Fiscal Period

Phase 11
Application Shell

Phase 12
Legacy Reports Isolation

Phase 13
Semantic Report Engine

Phase 14
Documents / OCR

Phase 15
AI

Phase 16
Android / PWA platform hardening

---

# 30. Golden Rule

در طول Migration:

app.js قدیمی نقش Compatibility Shell دارد.

هر Module فقط وقتی از app.js حذف می‌شود که:

1. نسخه Module ساخته شده باشد.
2. تست همان Feature پاس شود.
3. Production behavior تغییر نکرده باشد.
4. وابستگی مستقیم به Global state حذف یا کنترل شده باشد.

Rewrite کامل و یکباره ممنوع است.

Migration باید Strangler Pattern باشد.
