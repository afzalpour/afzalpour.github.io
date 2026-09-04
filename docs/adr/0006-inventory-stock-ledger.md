# ADR-0006 — Inventory Must Use a Stock Ledger

- Status: Accepted
- Date: 2026-09-05

## Context
انبارداری قابل‌اعتماد نباید موجودی را به‌صورت یک عدد قابل ویرایش نگه دارد؛ موجودی باید از گردش قابل Audit حاصل شود.

## Decision
Inventory بر پایه **Stock Ledger / Inventory Movements** طراحی می‌شود.

هر خرید، فروش، برگشت، انتقال، تعدیل و ورود/خروج باید Movement ثبت کند.

موجودی جاری و تاریخی از Movementها محاسبه یا به‌شکل امن Materialize می‌شود.

## Consequences
- Inventory auditability بالا می‌رود.
- اتصال فروش/خرید/انبار/حسابداری قابل اتکا می‌شود.
- Costing مثل Weighted Average یا FIFO می‌تواند روی ledger اعمال شود.

## Guardrails
- موجودی نباید با Update مستقیم یک فیلد balance اصلاح شود.
- تعدیل موجودی باید Movement مستقل داشته باشد.
- انتقال بین انبارها باید دو طرفه و قابل تطبیق باشد.
- Costing method باید صریح، نسخه‌پذیر و تست‌پذیر باشد.
