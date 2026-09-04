# ADR-0007 — Tax Rules Must Be Versioned and Configurable

- Status: Accepted
- Date: 2026-09-05

## Context
قوانین مالیاتی، نرخ‌ها، کدها و الزامات صورتحساب الکترونیکی ممکن است تغییر کنند. Hard-code دائمی این منطق ریسک عملیاتی ایجاد می‌کند.

## Decision
Tax/VAT rules باید **Versioned و Configurable** باشند.

- Tax profile برای کالا/خدمت/طرف‌حساب قابل تعریف باشد.
- Rule version بر اساس تاریخ اثرگذاری قابل انتخاب باشد.
- Pre-validation قبل از ارسال مالیاتی انجام شود.
- Status، Error، Retry و Audit trail نگهداری شود.

## Consequences
- تغییر مقررات بدون بازنویسی تاریخچه ممکن می‌شود.
- محاسبات تاریخی با Rule زمان خودش قابل بازتولید است.
- اتصال سامانه‌های مالیاتی باید Adapter-based باشد.

## Guardrails
- نرخ‌ها و قواعد متغیر در منطق پراکنده UI hard-code نشوند.
- ارسال مالیاتی عملیات حساس و Human-controlled است.
- هنگام پیاده‌سازی، مقررات روز و API رسمی باید دوباره بررسی شوند.
