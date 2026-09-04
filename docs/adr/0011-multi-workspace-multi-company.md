# ADR-0011 — Preserve Multi-workspace and Evolve It into Multi-company

- Status: Accepted
- Date: 2026-09-05

## Context
آوان اکنون Workspace-based است و برای کاربران Shared Workspace و RLS فعال دارد. در آینده محصول باید چند شرکت/شعبه و گزارش تجمیعی را پشتیبانی کند.

## Decision
- معماری Multi-workspace موجود حفظ می‌شود.
- Workspace شخصی پیش‌فرض می‌تواند در UX در سناریوهای مشخص Suppress شود، اما داده آن صرفاً برای ساده‌سازی UI حذف نمی‌شود.
- Workspace در مسیر آینده به Company/Business context واقعی توسعه می‌یابد.
- نقش‌ها، تنظیمات، واحد پول و داده عملیاتی باید در Context شرکت صحیح Resolve شوند.
- Consolidated Reporting در لایه‌ای بالاتر از Company ledger ساخته می‌شود.

## Consequences
- UX فعلی ساده می‌ماند و قابلیت آینده قربانی نمی‌شود.
- Multi-company نیازمند مرز امنیتی مستقل برای هر Company است.
- گزارش تجمیعی نباید Ledger شرکت‌ها را با هم مخلوط کند.

## Guardrails
- حذف Workspace فقط برای رفع duplicate UX ممنوع است.
- Context فعال باید صریح و قابل Audit باشد.
- RLS Company isolation باید مستقل از UI باقی بماند.
