# ADR-0017 — Windows Desktop Packaging and Offline-Capable Direction

Status: **Proposed**  
Date: **2026-09-08**

## زمینه / مسئله

محصول نهایی آوان علاوه بر Web/PWA می‌تواند به نسخه نصب‌شونده Windows نیز نیاز داشته باشد. دو نیاز متفاوت وجود دارد:

1. Desktop package که همان Backend ابری Supabase را مصرف کند؛
2. Desktop واقعی که بدون اینترنت نیز بتواند کار کند.

گزینه دوم صرفاً با تبدیل سایت به `.exe` حل نمی‌شود و به Local persistence، امنیت محلی، Backup و Sync/Conflict policy نیاز دارد.

## جهت پیشنهادی

### Desktop shell

برای Windows، **Tauri** گزینه ترجیحی اولیه است چون معمولاً footprint و مصرف حافظه پایین‌تری نسبت به Electron دارد و می‌تواند Frontend وب موجود را reuse کند. Electron فقط در صورت نیاز سازگاری/اکوسیستم خاص به‌عنوان fallback بررسی می‌شود.

این انتخاب نهایی نیست و پیش از Build واقعی باید نسخه‌های جاری ابزارها، امنیت و پشتیبانی Windows دوباره ارزیابی شوند.

### معماری مشترک

Refactor وب باید طوری ادامه پیدا کند که:

- Domain و Application به Browser یا Supabase وابسته نباشند؛
- Data access پشت Repository/Adapter باشد؛
- UI مشترک تا جای ممکن reuse شود؛
- Platform-specific code در `src/platform/` محدود شود.

Target پیشنهادی آینده:

```text
src/platform/
  web/
  windows/
```

### حالت Online Desktop

ساده‌ترین نسخه Desktop:

`Windows UI shell → Application/Domain → Supabase adapters`

این نسخه نصب‌شونده است اما برای عملیات Cloud به اینترنت نیاز دارد.

### حالت Fully Offline

برای کار واقعی بدون اینترنت، معماری جداگانه لازم است:

`Windows UI → Application/Domain → Local Repository → Local durable database`

و در حالت Sync:

`Local database/outbox ↔ Sync engine ↔ Supabase/PostgreSQL`

Database محلی پیشنهادی برای بررسی آینده: SQLite یا موتور embedded قابل اعتماد. انتخاب نهایی بعد از طراحی Ledger sync انجام می‌شود.

## مسئله Source of Truth

ADRهای فعلی PostgreSQL/Supabase را Source of Truth مالی نسخه وب می‌دانند. بنابراین **Offline Posting کامل هنوز Accepted نیست**.

تا زمانی که Conflict/Sequence/Idempotency/Reversal design تصویب نشده باشد:

- Cache و Draft محلی می‌تواند طراحی شود؛
- Posted financial transaction نباید در حالت آفلاین به‌عنوان Canonical Ledger نهایی تلقی شود.

اگر محصول نهایی به یک نسخه کاملاً مستقل و بدون هیچ وابستگی اینترنتی نیاز داشته باشد، باید ADR جداگانه‌ای مدل Source of Truth را برای Desktop Offline مشخص کند.

## Guardrails

- Service Role/DB secret داخل EXE قرار نمی‌گیرد.
- credentialهای محلی باید از Windows secure storage/keychain استفاده کنند.
- فایل دیتابیس محلی باید encryption/backup policy داشته باشد.
- Sync باید idempotent، workspace-scoped و audit-able باشد.
- conflict مالی نباید با last-write-wins حل شود.
- Posted/Reversed immutability باید در Desktop نیز حفظ شود.
- نسخه Desktop باید signed installer/update داشته باشد.
- Offline data loss/recovery drill قبل از Production Desktop الزامی است.

## نتیجه

ساخت `.exe` از آوان **کاملاً ممکن است**. نسخه آنلاین Desktop نسبتاً مستقیم است. نسخه کاملاً بدون اینترنت نیز ممکن است، اما یک Feature معماری مستقل است و باید Local Ledger/Persistence و Sync را به‌صورت اصولی طراحی کند.

Refactor تحت ADR-0016 این مسیر را باز نگه می‌دارد و از قفل‌شدن Business Logic به Supabase جلوگیری می‌کند.
