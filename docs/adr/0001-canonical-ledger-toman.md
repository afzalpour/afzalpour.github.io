# ADR-0001 — Canonical Ledger = integer Toman

- Status: Accepted
- Date: 2026-09-05

## Context
آوان باید ریال و تومان را برای نمایش/ورودی پشتیبانی کند، بدون اینکه تغییر Preference باعث Drift یا بازنویسی تاریخچه مالی شود.

## Decision
مبلغ Canonical در Ledger به‌صورت **عدد صحیح تومان** ذخیره می‌شود.

- نمایش تومان = مقدار Canonical
- نمایش ریال = Canonical × 10
- ورودی ریال در Submit Boundary به تومان تبدیل می‌شود.
- ورودی ریال باید بر 10 بخش‌پذیر باشد.
- تغییر واحد نمایش نباید رکوردهای تاریخی Ledger را Rewrite کند.

## Consequences
- مقایسه و Audit مبالغ پایدار می‌ماند.
- UI می‌تواند Preference شخصی/Workspace داشته باشد.
- Conversion فقط در Boundaryهای UI/API انجام می‌شود.

## Guardrails
- هیچ Migration نباید مبالغ قدیمی را صرفاً به خاطر تغییر Display Unit ضرب/تقسیم کند.
- Money preference داده حسابداری نیست.
- در گزارش و Print، واحد فعال باید صریح و یکدست باشد.

## Rejected alternatives
- ذخیره مخلوط ریال و تومان در رکوردها.
- بازنویسی Ledger با تغییر تنظیمات کاربر.
