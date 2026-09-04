# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: پس از Live PASS شدن **RC1.2-B**.

این فایل وضعیت جاری پروژه است و باید بعد از هر Gate پاس‌شده یا تغییر معماری مهم به‌روزرسانی شود.

---

## 1) Repository / Workflow

Repository فعال:
- `afzalpour/afzalpour.github.io`

ساختار:
- Root = Production فعلی/مسیر انتشار اصلی.
- `avan-staging/` = محیط Staging برای توسعه و Gate.

Workflow:
- تغییرات ابتدا در Staging.
- Branch → PR → Merge به `main`.
- GitHub Pages استیجینگ را از تغییرات منتشر می‌کند.
- Production/root فقط پس از Gateها و Regression نهایی promote می‌شود.

آخرین Merge کد UI شناخته‌شده:
- RC1.2-B merge SHA: `bafdfe4b49b8a4d9b44305997abf452a3490fd80`

پس از آن اسناد مرجع پروژه نیز روی main اضافه شده‌اند.

---

## 2) Gateهای پاس‌شده

- Gate B-4 Live — PASS
- Gate B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A Money UX — PASS
- RC1.1-B Currency — PASS
- RC1.1-C Unit Density — PASS
- RC1.1-D User Administration — PASS
- Gate E: Owner changing another user password — live confirmed; سایر refinementها به F منتقل شدند.
- RC1.1-F UX Cleanup — PASS
- RC1.2-A Professional Visual System — design direction accepted and superseded/refined by B
- **RC1.2-B Premium polish + Persian cleanup + account tree colors — LIVE PASS**

هیچ Gate بعدی را پاس‌شده فرض نکن تا کاربر صریحاً تایید کند.

---

## 3) وضعیت Core مالی

نام محصول:
- آوان
- Core 1.0

معماری تاییدشده:
- PostgreSQL/Supabase منبع حقیقت مالی.
- LocalStorage برای داده مالی استفاده نمی‌شود.
- Auth + RLS فعال.
- Workspace-based isolation.
- Journal lifecycle: Draft → Posted → Reversed.
- Posted journal immutable.
- Reversal با سند معکوس.

Health snapshot تاریخی تاییدشده:
- Accounts: 18
- Cash/Bank: 2
- Posted/Reversed docs: در طول تست‌ها افزایش یافته و در RC1.2-B UI فارسی شده است.
- orphan lines: 0
- closed period: 0 در snapshot قبلی
- visible workspace: 1 برای سناریوی اصلی پس از workspace suppression

این اعداد snapshot هستند؛ برای تصمیم‌های جدید health live را دوباره بخوان.

---

## 4) Money / Currency

Gate A:
- ورودی پول با جداکننده هزارگان.
- normalize ارقام فارسی/عربی/لاتین.
- amount-in-words.
- canonical raw integer submission.

Gate B/C:
- Canonical Ledger = integer Toman.
- Rial نمایش = ×10.
- Rial submit = /10 با divisibility guard.
- بدون rewrite داده تاریخی.
- unit density کنترل‌شده؛ تکرار واحد از UI حذف شده است.

Preference:
- per-user/per-workspace Cloud preference از `workspace_user_preferences`.
- RPC:
  - `get_my_money_display_unit(wid)`
  - `set_my_money_display_unit(wid,p_unit)`

---

## 5) Users / Access / Workspace

UI roles:
- مالک = owner
- مدیر = manager
- حسابدار = accountant
- viewer legacy only

Security:
- browser mutation مستقیم workspace_members ممنوع.
- RPC امن برای مدیریت اعضا.
- last active Owner protected.
- primary owner protected where applicable.
- invitation flow برای existing auth user و pending invitation.
- claim_workspace_invitations() در login flow.

Multi-workspace behavior:
- session key: `avan.active_workspace_id`
- only session preference, not financial data.
- Gate F، Workspace شخصی پیش‌فرض `فضای مالی من` را برای کاربری که shared non-owner workspace دارد از context عملیاتی suppress می‌کند؛ بدون حذف داده.
- multi-company واقعی حفظ شده است.

---

## 6) Password / Auth

Owner → other user password:
- Edge Function: `owner-set-user-password`
- live confirmed working.
- service role server-side only.

Self password:
- Settings → `تغییر رمز من`
- re-auth با current password و سپس update password با user-scoped auth.
- Gate F passed.

Unresolved operational item:
- Password recovery email historically دریافت نمی‌شد.
- custom domain فعلاً وجود ندارد.
- SMTP / Auth redirect / email template باید قبل از Production نهایی حل شود.

---

## 7) UX / Visual System

RC1.2-A:
- Vazirmatn variable font + iOS/macOS/Windows fallback.
- dark desktop finance sidebar.
- light content area.
- modern KPI/cards/tables/forms/modals/mobile bottom nav.
- PWA cache v11.

RC1.2-B LIVE PASS:
- warm ivory/premium finance canvas.
- richer KPI and section cards.
- limited gold accent.
- refined forms/tables/tabs/modals/buttons.
- semantic finance status colors preserved.
- report copy cleanup.
- Settings copy cleanup.
- account tree branch coloring.
- PWA cache v12.

UI copy changes in B:
- زیر «از آوان بپرس» دو متن فنی اضافی حذف شد.
- `محل ذخیره` حذف شد.
- `سلامت Core` → `سلامت سیستم`.
- `اسناد Posted/Reversed` → `اسناد ثبت‌شده/برگشتی`.
- `Workspace قابل مشاهده` → `فضاهای مالی قابل مشاهده`.
- `دوره بسته` → `دوره‌های بسته`.

Account tree:
- deterministic color family per top-level branch.
- descendants inherit same Hue with lighter intensity.
- session-level UI toggle روشن/خاموش.
- no DB schema or financial data change.

---

## 8) Smart Documents / OCR — CURRENT NEXT PROBLEM

فعلاً این بخش مشکل عملیاتی دارد:
- OCR خروجی قابل اعتماد نیست.
- تصویر به‌درستی render نمی‌شود.

Current architecture:
- private storage bucket: `avan-documents`.
- allowed: JPG/PNG/WEBP/PDF up to 10MB.
- signed URL برای مشاهده فایل.
- local OCR runtime:
  - Tesseract.js
  - PDF.js
  - languages fas + eng
- preprocess image + multiple OCR passes + critical date/amount bands.
- review → accounting draft → link to Ledger flow وجود دارد.

**Next Gate قطعی:**
### RC1.2-C — Smart Document Viewer + OCR Reliability

ترتیب C:
1. اول Viewer/Renderer منبع را اصلاح کن.
2. image EXIF/orientation/rotation.
3. correct aspect ratio, contain/fit, zoom/pan.
4. PDF renderer مستقل و قابل اعتماد.
5. سپس OCR quality را روی منبع صحیح ارزیابی کن.
6. structured extraction/date/amount confidence را تقویت کن.
7. هیچ OCR result مستقیم Posting نشود؛ Human review حفظ شود.

تا RC1.2-C Live PASS نشده، D را پاس‌شده فرض نکن.

---

## 9) Print / Export — AFTER C

### RC1.2-D — Print & Export Center

نیاز تاییدشده کاربر:
- گزارش‌ها چاپ/ذخیره ندارند.
- اسناد حسابداری چاپ/ذخیره ندارند.
- فاکتورها چاپ/ذخیره ندارند.
- اسناد هوشمند چاپ/ذخیره اصل فایل ندارند.

هدف:
- shared Print Template System.
- Reports: Print/PDF + CSV/Excel.
- Invoice: professional A4 PDF/Print.
- Journal: professional A4 print/PDF.
- Smart documents: view/download/print original.
- RTL, Persian font, page breaks, page number, active currency.

---

## 10) Professional Document Templates — AFTER D

### RC1.2-E
- قالب A4 حرفه‌ای.
- نام/لوگو/اطلاعات شرکت.
- مشخصات فروشنده/خریدار در حد نیاز.
- اطلاعات مالیاتی مورد نیاز.
- page headers/footers.

این مرحله به Company Settings آینده متصل است.

---

## 11) Mobile / iPhone

فونت قدیمی IRAN fallback مشکل داشت؛ Vazirmatn در RC1.2-A اضافه شد.

بعد از Print/OCR:
### RC1.2-F — Mobile/iPhone final UX regression
- Safari/iPhone typography.
- forms.
- modal.
- bottom nav.
- wide tables.
- document viewer.
- print/share/download flows.
- safe-area.

---

## 12) Product Vision — ماژول‌های آینده تاییدشده

کاربر تاکید کرده آوان باید یکی از بهترین و هوشمندترین محصولات بازار باشد و قابلیت‌های زیر بخشی از Roadmap رسمی هستند:

### Finance Intelligence
- CFO Autopilot
- Explainable KPI / Why this number
- Cash Forecast
- What-if scenarios
- Budget vs Actual
- Proactive management alerts

### Continuous Audit
- duplicate detection
- unusual amount
- integrity checks
- anomalous behavior/pattern
- period/control risk
- explainable evidence

### Collection Agent
- Aging
- collection priority
- delay probability
- suggested action/message
- cash impact

### Close Autopilot
- month-end checklist
- readiness score
- unresolved items
- discrepancy detection
- draft adjustments with human approval

### AI Accounting
- document OCR
- document classification
- party recognition
- account suggestion
- learned recurring patterns
- accounting draft
- human-controlled posting

### Voice AI
- Persian speech-to-text.
- voice commands to create Draft transactions/invoices/reports.
- voice management questions.
- voice response.
- optional user-voice cloning only with explicit opt-in/consent and never as financial authentication.

### Inventory
- Stock Ledger / movement-based architecture.
- products/services.
- warehouses.
- receipts/issues/transfers/adjustments/returns.
- real-time and historical stock.
- reorder alerts.
- costing.
- accounting integration.

### Sales / Purchase
- quote/proforma.
- order.
- purchase/sales invoices.
- return/discount/settlement.
- AR/AP + inventory + tax + Ledger integration.

### Tax
- VAT/tax profiles.
- product/party mapping.
- electronic invoice / Iranian taxpayer-system requirements according to current law when implemented.
- pre-validation, status tracking, audit, error/retry.
- rules must be versioned/configurable.

### Treasury
- cash/bank.
- cheques.
- maturities.
- bank reconciliation.

### Bank AI
- transaction import/API where feasible.
- automatic matching.
- internal transfer detection.
- unmatched queue.
- confidence score.

### Payroll
- employee/payroll/benefit/deduction/insurance/tax/accounting posting.

### Fixed Assets
- asset register/depreciation/disposal/accounting.

### Workflow
- approval chains.
- role/amount/type limits.

### Multi-company / Branch
- true isolation.
- consolidated reporting later.

### Integrations
- banks, POS, e-commerce, Excel/CSV, external APIs.

---

## 13) Production Roadmap

بعد از RC1.2-C/D/E/F:
- RC1.3-A: Auth recovery / SMTP / redirect production readiness.
- RC1.3-B: Company profile / logo / tax identity.
- RC1.3-C: operational controls, backup/restore strategy, audit log UX, session/recovery.
- RC1.3-D: full regression.
- RC1.3-RC: feature freeze, blocker/critical fixes only.
- Production promotion.
- custom domain + final auth/email/branding configuration بعد از تهیه دامنه.

پس از Core production-ready، توسعه Intelligence/Inventory/Tax/Treasury/Voice به‌صورت staged module gates ادامه یابد.

---

## 14) Immediate Next Action

**همین حالا گام بعدی پروژه: RC1.2-C — اصلاح کامل Smart Document Viewer و OCR.**

Assistant باید این مرحله را خودش در GitHub پیاده‌سازی کند، Branch/PR/Diff را مدیریت کند و فقط Live Gate را به کاربر بسپارد، مگر اقدام Supabase غیرقابل انجام بدون دسترسی مستقیم لازم شود.
