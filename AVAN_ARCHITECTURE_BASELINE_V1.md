# معماری مرجع آوان — Avan Architecture Baseline V1

Status: FROZEN
Product: Avan Smart Accounting
Architecture Gate: C-7
Date: 2026-08-31

---

## 1. تعریف محصول

آوان یک نرم‌افزار حسابداری پایه نیست.

هسته حسابداری فعلی فقط Accounting Kernel محصول است و باید پایه‌ای قابل اعتماد برای ماژول‌های پیشرفته، گزارش‌سازی، اسناد، OCR و هوش مصنوعی باشد.

هدف آوان ساخت یک پلتفرم حسابداری هوشمند، قابل ردیابی و چندسکویی است.

---

## 2. لایه‌های اصلی معماری

معماری آوان شامل این لایه‌ها است:

1. Accounting Kernel
2. Business Domains
3. Document Platform
4. Semantic Data Layer
5. Dynamic Reporting Engine
6. Data Lineage
7. AI Layer
8. Cross-platform Experience

---

## 3. Accounting Kernel

هسته حسابداری مسئول این مفاهیم است:

- Chart of Accounts
- Journal Entries
- Journal Lines
- General Ledger
- Fiscal Years
- Fiscal Period Locks
- Workspace
- Roles
- RLS
- Accounting Integrity

اصول هسته:

- Posted data immutable است.
- اصلاح سند Posted با Reverse انجام می‌شود.
- AI اجازه دورزدن کنترل‌های حسابداری را ندارد.
- Ledger منبع اصلی حقیقت مالی است.

---

## 4. Business Domains

ماژول‌های کسب‌وکار باید مستقل از UI و Platform باشند.

دامنه‌های اصلی:

- Accounts
- Parties
- Sales
- Purchases
- Invoices
- Receipts
- Payments
- Transfers
- Accounts Receivable
- Accounts Payable
- Banking
- Bank Reconciliation
- Products
- Services
- Inventory
- Tax
- Cost Centers
- Fiscal Operations

هر Domain باید API و Contract مشخص خود را داشته باشد.

---

## 5. Document Platform

اسناد منبع باید First-class Object باشند.

انواع سند:

- Invoice Image
- Receipt
- Bank Slip
- Contract
- PDF
- JPEG
- PNG
- Other Accounting Evidence

فایل‌ها در Storage نگهداری می‌شوند و Database فقط Metadata و Relationها را نگه می‌دارد.

هر سند باید بتواند به این Objectها متصل شود:

- Invoice
- Payment
- Journal Entry
- Party
- Bank Transaction

---

## 6. OCR و Document Intelligence

Workflow استاندارد:

Image/PDF
→ OCR
→ AI Extraction
→ Draft Proposal
→ Human Review
→ Accounting Mapping
→ Approval
→ Post

OCR/AI نباید مستقیماً Ledger را Post کند.

اطلاعات قابل استخراج:

- Vendor / Customer
- Invoice Number
- Date
- Line Items
- Quantity
- Unit Price
- Discount
- Tax
- Total Amount
- Payment Information

برای هر Field باید Confidence Score قابل نگهداری باشد.

---

## 7. Semantic Data Layer

گزارش‌ها نباید فقط مجموعه‌ای از صفحات Hard-coded باشند.

آوان باید Business Semantic Model داشته باشد.

Business Objects نمونه:

- Account
- Party
- Invoice
- Payment
- Journal
- Product
- Service
- Document
- Bank Transaction
- Fiscal Period

Dimensions نمونه:

- Customer
- Vendor
- Account
- Date
- Month
- Invoice
- Product
- Cost Center
- Status

Measures نمونه:

- Gross Sales
- Discount
- Net Sales
- Expenses
- Paid Amount
- Outstanding Amount
- Profit
- Cash Flow
- Account Balance

---

## 8. Dynamic Report Engine

کاربر باید بتواند گزارش خود را بسازد.

Report Definition شامل:

- Subject
- Dimensions
- Measures
- Filters
- Grouping
- Sorting
- Drill-down
- Date Range

گزارش ساخته‌شده باید قابل ذخیره و استفاده مجدد باشد.

همان Report Engine باید مبنای این بخش‌ها باشد:

- Saved Reports
- Dashboards
- Drill-down
- AI Reports
- Natural Language Reports

---

## 9. Data Lineage — «چرا این عدد؟»

هر عدد مهم باید قابل ردیابی باشد.

مسیر استاندارد:

Dashboard / Report
→ Measure
→ Source Rows
→ Journal Lines
→ Transaction / Invoice
→ Source Document

کاربر باید بتواند روی یک عدد کلیک کند و بپرسد:

«چرا این عدد؟»

و تا سند منبع پایین برود.

---

## 10. AI Layer

هوش مصنوعی آوان شامل این قابلیت‌ها خواهد بود:

- Accounting Assistant
- Why This Number Assistant
- Natural Language Report Builder
- OCR Document Understanding
- Accounting Mapping Suggestions
- Duplicate Detection
- Anomaly Detection
- Variance Analysis
- Trend Analysis
- Financial Explanation

اصل مهم:

AI پیشنهاد، تحلیل و توضیح می‌دهد.

عملیات حساس حسابداری باید دارای کنترل، Approval و Audit Trail باشد.

---

## 11. Accounting Assistant

دستیار حسابدار باید Context واقعی Workspace را درک کند.

نمونه سؤال‌ها:

- مانده این مشتری چقدر است؟
- چرا بانک با دفتر کل اختلاف دارد؟
- آیا این فاکتور قبلاً ثبت شده؟
- این هزینه در چه حسابی ثبت شود؟
- فاکتورهای سررسیدگذشته را نشان بده.
- چرا سود این ماه کاهش پیدا کرده؟

دسترسی AI باید تابع Permission و RLS کاربر باشد.

---

## 12. Cross-platform Architecture

آوان از ابتدا سه خروجی محصول اجباری دارد:

### Web

نسخه کامل Desktop/Web برای:

- مدیریت
- حسابداری
- گزارش‌سازی
- تنظیمات
- عملیات پیچیده

### Android

نسخه قابل نصب Android الزامی است.

Android باید تا حد ممکن Business Logic مشترک با Web داشته باشد.

Platform Adapter می‌تواند مسئول این قابلیت‌ها باشد:

- Camera
- File Access
- Share
- Notifications
- Secure Storage
- Offline Capabilities

### iPhone

نسخه iPhone در مرحله فعلی به‌صورت PWA الزامی است.

الزامات:

- Add to Home Screen
- Responsive Mobile UI
- Touch-first Navigation
- Camera / Photo Upload
- Document Upload
- Service Worker
- Offline Shell در موارد مناسب

معماری نباید مانع ساخت Native iOS در آینده شود.

---

## 13. Mobile-first Workflows

Mobile فقط نسخه کوچک Desktop نیست.

Workflowهای مهم Mobile:

- عکس گرفتن از فاکتور
- عکس گرفتن از رسید
- OCR
- بررسی نتیجه OCR
- ثبت سریع خرید
- ثبت سریع فروش
- دریافت
- پرداخت
- جستجوی مشتری
- مانده مشتری
- Dashboard
- گزارش
- Why This Number
- Accounting Assistant
- Approval
- Notification

---

## 14. ساختار هدف Source Code

ساختار هدف:

/src
  /core
  /domains
  /documents
  /reports
  /ai
  /ui
  /platform
    /web
    /android
    /pwa-ios

منطق Business و Accounting نباید به Platform خاص وابسته باشد.

---

## 15. اصول توسعه

1. Ledger correctness مقدم بر AI convenience است.
2. Posted accounting data immutable است.
3. Source Document یک Accounting Evidence است.
4. OCR نتیجه نهایی نیست؛ Proposal است.
5. AI بدون کنترل مستقیماً Post نمی‌کند.
6. Reports بر پایه Semantic Model ساخته می‌شوند.
7. هر عدد مهم باید Data Lineage داشته باشد.
8. Web، Android و iPhone PWA خروجی‌های رسمی محصول هستند.
9. Business Logic باید Platform-independent باشد.
10. app.js فعلی معماری نهایی محصول نیست.
11. توسعه Monolithic app.js باید متوقف شود.
12. Refactor باید تدریجی و Regression-safe باشد.

---

## 16. ترتیب توسعه معماری

ترتیب کلی:

1. Modularization
2. Core Contracts
3. Domain Contracts
4. Semantic Model
5. Dynamic Report Engine
6. Data Lineage / Why This Number
7. Document Platform
8. OCR
9. Accounting Assistant
10. AI Analytics
11. AR/AP
12. Bank Reconciliation
13. Inventory / Tax / Cost Centers
14. Audit / Workflow / Permissions
15. Web / Android / iPhone PWA Hardening
16. Beta
17. Avan 1.0

---

## 17. قانون تغییر این سند

این سند Baseline معماری آوان است.

تغییرات اساسی در این سند فقط باید با تصمیم معماری آگاهانه انجام شود.

هیچ Feature جدیدی نباید معماری فوق را دور بزند.
