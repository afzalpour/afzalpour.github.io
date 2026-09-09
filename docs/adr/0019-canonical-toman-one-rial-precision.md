# ADR-0019 — Canonical Toman with one-Rial precision

- Status: Accepted
- Date: 2026-09-09
- Supersedes: ADR-0001

## Context
آوان واحد حسابداری Canonical را تومان نگه می‌دارد و ریال/تومان فقط در Boundary ورودی و Presentation تغییر می‌کنند. ADR-0001 Canonical را «عدد صحیح تومان» تعریف کرده بود و در نتیجه ورودی ریالی را فقط زمانی معتبر می‌دانست که بر ۱۰ بخش‌پذیر باشد.

این محدودیت با واقعیت داده و نیاز حسابداری فعلی آوان همسو نیست:

- Schema مالی موجود برای `invoice_lines.unit_price`, `invoice_lines.discount`, `invoice_lines.line_total`, `invoices.subtotal`, `invoices.total_amount`, `invoices.tax_total` و `journal_lines.debit/credit` از `numeric(...,1)` استفاده می‌کند.
- بنابراین کوچک‌ترین واحد قابل نگهداری در Canonical برابر **۰٫۱ تومان = ۱ ریال** است.
- مبلغ صحیح ریالی مانند ۱۵۱۵ ریال باید بدون خطا و بدون گردکردن به ۱۵۱٫۵ تومان Canonical تبدیل شود.
- تغییر Preference بین ریال و تومان نباید مقدار اقتصادی، Ledger یا تاریخچه را Rewrite کند.

## Decision
واحد Canonical همچنان **تومان** است، اما دقت Canonical برای مبالغ مالی تا **یک رقم اعشار تومان** تعریف می‌شود.

- ۱ ریال = ۰٫۱ تومان Canonical.
- ورودی صحیح ریالی لازم نیست مضرب ۱۰ باشد.
- ۱۵۱۵ ریال دقیقاً به ۱۵۱٫۵ تومان Canonical تبدیل می‌شود.
- در فاکتور، `unit_price` و `discount` از Decimal Money Boundary عبور می‌کنند.
- Line total مطابق Backend در دقت ۰٫۱ تومان Quantize می‌شود؛ هیچ Truncate یا Integer coercion مجاز نیست.
- VAT و جمع فاکتور در کوچک‌ترین واحد قابل ذخیره‌سازی، یعنی یک‌دهم تومان، محاسبه و سپس برای Persistence/Presentation به مقدار Canonical تبدیل می‌شوند.
- Generic integer-money flows که هنوز قرارداد عدد صحیح دارند، تا زمانی که جداگانه مهاجرت نکرده‌اند تغییر رفتار نمی‌دهند.
- Formatterهای Canonical باید مقدار اعشاری Backend را تشخیص دهند و نباید `151.5` را به `1515` تفسیر کنند.

## Consequences
- مبلغ‌های ریالی فرد مانند ۱۵۱۵، ۲۵۰۱ یا ۹۹۹۹ ریال در فاکتور معتبر می‌شوند.
- سوئیچ واحد نمایش بین ریال و تومان Lossless باقی می‌ماند.
- Schema فعلی Backend نیاز به Migration ندارد.
- مسیر فاکتور و گزارش باید Decimal-safe باشد.
- کدهایی که با `BigInt` بر حسب تومان کار می‌کنند نمی‌توانند مستقیماً مقدار Canonical اعشاری را نگه دارند؛ برای محاسبات فاکتور از BigInt بر حسب یک‌دهم تومان استفاده می‌شود.

## Guardrails / Invariants
- واحد ذخیره‌سازی مفهومی Ledger همچنان تومان است؛ ریال به‌عنوان واحد مختلط در رکوردها ذخیره نمی‌شود.
- هیچ داده تاریخی صرفاً به دلیل تغییر Display Unit ضرب/تقسیم یا Rewrite نمی‌شود.
- Persistence precision برای این قرارداد ۰٫۱ تومان است؛ Frontend باید با همین دقت Backend همسو باشد.
- تبدیل ریال ↔ تومان باید دقیق و فقط در Boundary انجام شود.
- هیچ مبلغ ریالی صحیح نباید صرفاً به دلیل غیرمضرب‌بودن بر ۱۰ رد شود.
- گزارش‌ها باید مقدار اعشاری Canonical را بدون Integer coercion نمایش دهند.
- واحد پول در گزارش‌های جدولی در Heading/metadata نمایش داده می‌شود و کنار تک‌تک سلول‌های مبلغ تکرار نمی‌شود.

## Rejected alternatives
- ادامه الزام مضرب ۱۰ برای ورودی ریال.
- گردکردن ۱۵۱۵ ریال به ۱۵۱۰ یا ۱۵۲۰ ریال.
- تغییر Canonical Ledger از تومان به ریال و Migration تاریخچه.
- ذخیره مخلوط ریال و تومان در رکوردهای مالی.
- حذف اعشار با تبدیل String/Number به BigInt.

## Gate / Implementation mapping

- `avan-staging/src/core/money/canonical-money.js`
- `avan-staging/src/ui/money/money-runtime.js`
- `avan-staging/src/ui/money/money-inputs.js`
- `avan-staging/src/ui/money/invoice-money-workspace.js`
- `avan-staging/src/ui/money/money-output-contract.js`
- `avan-staging/tests/money-core-v3.spec.mjs`
- `avan-staging/tests/c2-money-contract-v2.spec.mjs`
- `avan-staging/tests/money-architecture-v3.spec.mjs`

این تصمیم فقط پس از عبور Quality Gate و Review وارد شاخه اصلی می‌شود؛ Production root تا آن زمان بدون تغییر می‌ماند.
