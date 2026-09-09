# ADR-0021 — Electronic Invoice Pre-Validation and Provider Adapter Boundary

- Status: Accepted
- Date: 2026-09-09
- Scope: RC1.5-D

## Context

آوان باید برای صورتحساب الکترونیکی و سامانه مؤدیان آماده شود، اما قالب‌ها، قواعد کنترلی، روش اتصال و نسخه‌های فنی Provider/سازمان ممکن است تغییر کنند. اتصال مستقیم Browser به سرویس ارسال، نگهداری کلید/توکن مالیاتی در Frontend یا Hard-code کردن تمام قواعد متغیر در Core، هم ریسک امنیتی دارد و هم هزینه نگهداری و خطای حقوقی را بالا می‌برد.

در RC1.5-C آوان Snapshot مالیاتی نسخه‌دار، پروفایل مالیاتی ردیف، جمع مالیات و شناسه رسمی کالا/خدمت را در مدل داده دارد. RC1.5-D باید از همین داده استفاده کند و منطق موازی مالیاتی نسازد.

## Decision

### 1. Provider-neutral normalized model

آوان یک مدل میانی مستقل از Provider با نسخه `avan.einvoice.preflight.v1` می‌سازد. این مدل شامل هویت شرکت/فروشنده، خریدار، مشخصات فاکتور، ردیف‌ها، شناسه رسمی کالا/خدمت، Snapshot مالیاتی و مبالغ Canonical است.

### 2. Pre-validation before any submission

پیش‌اعتبارسنجی تمام Findingها را یکجا بازمی‌گرداند و در اولین خطا متوقف نمی‌شود. Finding شامل `code`, `severity`, `field`, `message_fa`, `source` است.

قواعد پایه شامل موارد پایدار زیر است:
- مسیر خروجی فقط برای فاکتور فروش؛
- وجود تاریخ، شماره آماده ارسال و ردیف؛
- وجود هویت مالیاتی پایه فروشنده و شناسه حافظه مالیاتی؛
- وجود شناسه رسمی کالا/خدمت برای هر ردیف؛
- Snapshot مالیاتی ردیف؛
- کنترل دقت یک ریال؛
- تطبیق تعداد × فی − تخفیف با جمع ردیف؛
- تطبیق مجموع ردیف‌ها، مالیات و جمع نهایی؛
- کنترل لینک Ledger برای فاکتور Posted.

قواعدی که به نوع صورتحساب، الگوی سازمان، وضعیت خریدار یا نسخه Provider وابسته‌اند در Core به‌صورت قطعی Hard-code نمی‌شوند و تا زمان وجود Adapter نسخه‌دار به‌عنوان Warning/Provider-required مشخص می‌شوند.

### 3. Adapter contract

هر Adapter آینده باید حداقل عملیات زیر را پیاده‌سازی کند:
- `preflight(normalizedInvoice)`
- `buildPayload(normalizedInvoice)`
- نسخه و شناسه Provider

در RC1.5-D `submit()` عمداً غیرفعال است و با خطای `EINVOICE_SUBMISSION_NOT_AVAILABLE_IN_RC15D` متوقف می‌شود.

### 4. Security boundary

- هیچ کلید خصوصی، service role، token یا credential سامانه مؤدیان در Browser ذخیره یا پردازش نمی‌شود.
- هیچ ارسال واقعی از Frontend در این Gate وجود ندارد.
- اتصال واقعی آینده باید پشت یک مرز Server-side امن قرار گیرد و Adapter سمت سرور مسئول امضا، credential، retry/idempotency، ثبت response و کنترل نسخه رسمی باشد.
- هیچ عملیات مالی/حسابداری یا Post Ledger توسط Preflight انجام نمی‌شود.
- ارسال واقعی آینده نیازمند اقدام صریح انسانی خواهد بود.

### 5. Money precision

تمام مبالغ مدل میانی Canonical Toman با دقت `0.1 Toman = 1 Rial` باقی می‌مانند. Preflight حق Round پنهان یا تبدیل lossful ندارد.

## Consequences

- تغییر Provider یا نسخه دستورالعمل نیازمند تغییر Core مالیاتی نیست.
- خطاهای داده قبل از ورود به مسیر ارسال دیده می‌شوند.
- امنیت credential از Frontend جدا می‌ماند.
- در RC1.5-D برچسب «آماده از نظر داده» به معنی «ارسال شده» یا حتی «قابل ارسال با آخرین نسخه رسمی» نیست؛ Provider adapter نسخه‌دار باید Gate نهایی اتصال را انجام دهد.
