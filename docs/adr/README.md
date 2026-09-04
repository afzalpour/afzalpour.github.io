# AVAN Architecture Decision Records (ADR)

این پوشه «دفتر تصمیم‌های معماری آوان» است. هدف آن جلوگیری از گم‌شدن تصمیم‌های بنیادی بین چت‌ها، توسعه‌دهندگان، Gateها و نسخه‌های آینده است.

## قانون استفاده

1. در شروع هر چت یا تغییر معماری، ابتدا `AVAN_MASTER_PROMPT.md` و سپس `AVAN_CURRENT_STATE.md` خوانده شود.
2. پیش از تغییر یک تصمیم بنیادی، ADRهای این پوشه بررسی شوند.
3. تصمیم‌های Accepted نباید بی‌سر و صدا نقض شوند. هر تغییر بنیادی باید با ADR جدید از نوع `Supersedes` انجام شود.
4. بعد از هر Gate پاس‌شده، `AVAN_CURRENT_STATE.md` به‌روزرسانی شود.
5. ADRها تاریخچه‌اند؛ حذف نمی‌شوند. اگر تصمیمی منسوخ شد، وضعیت آن `Superseded` می‌شود.

## وضعیت‌های مجاز

- `Proposed` — پیشنهاد برای بررسی
- `Accepted` — تصمیم فعال و لازم‌الاجرا
- `Deprecated` — هنوز ممکن است وجود داشته باشد ولی برای توسعه جدید توصیه نمی‌شود
- `Superseded` — با ADR جدید جایگزین شده
- `Rejected` — بررسی شده و رد شده

## قالب ADR

هر ADR باید شامل این بخش‌ها باشد:

- عنوان
- وضعیت
- تاریخ
- زمینه / مسئله
- تصمیم
- پیامدها
- Guardrails / Invariants
- گزینه‌های ردشده
- ارتباط با Gateها یا فایل‌های اجرایی

## ADRهای فعال

| ADR | تصمیم | وضعیت |
|---|---|---|
| [0001](0001-canonical-ledger-toman.md) | Canonical Ledger = integer Toman | Accepted |
| [0002](0002-journal-lifecycle-immutability.md) | Draft → Posted → Reversed و immutability سند قطعی | Accepted |
| [0003](0003-workspace-rls-security-boundary.md) | Workspace + RLS مرز امنیت داده | Accepted |
| [0004](0004-staging-gate-release-workflow.md) | Staging-first و Gate-based release | Accepted |
| [0005](0005-human-controlled-explainable-ai.md) | AI توضیح‌پذیر و Human-controlled | Accepted |
| [0006](0006-inventory-stock-ledger.md) | انبارداری بر پایه Stock Ledger | Accepted |
| [0007](0007-versioned-tax-rules.md) | قوانین مالیاتی Versioned/Configurable | Accepted |
| [0008](0008-unified-print-export-system.md) | Print/Export مشترک و استاندارد | Accepted |
| [0009](0009-smart-documents-ocr-review-pipeline.md) | OCR با اصل فایل محفوظ + Human Review | Accepted |
| [0010](0010-voice-ai-consent-and-safety.md) | Voice AI اختیاری؛ Voice cloning هرگز احراز هویت نیست | Accepted |
| [0011](0011-multi-workspace-multi-company.md) | حفظ Multi-workspace و توسعه به Multi-company | Accepted |
| [0012](0012-project-source-of-truth.md) | GitHub Master Prompt + Current State + ADR = Source of Truth | Accepted |

## اصل حاکم

آوان نباید در طول توسعه به یک نرم‌افزار حسابداری معمولی تبدیل شود. معیار معماری ثابت:

**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**
