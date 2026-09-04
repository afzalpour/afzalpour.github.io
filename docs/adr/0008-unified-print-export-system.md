# ADR-0008 — Unified Print and Export System

- Status: Accepted
- Date: 2026-09-05

## Context
گزارش‌ها، فاکتورها، اسناد حسابداری و اسناد هوشمند همگی به چاپ/خروجی نیاز دارند. پیاده‌سازی جداگانه برای هر بخش باعث ناسازگاری RTL، فونت، Page Break و Company Identity می‌شود.

## Decision
آوان یک **Print Template System مشترک** خواهد داشت.

- Reports: Print + PDF + CSV/Excel
- Invoice: A4 Professional Print/PDF
- Journal: A4 Print/PDF با جمع بدهکار/بستانکار
- Smart Documents: View + Download + Print Original

## Consequences
- Header/Footer، فونت، Page Number و واحد پول یکدست می‌شوند.
- Company Identity در یک لایه مشترک اعمال می‌شود.
- توسعه قالب جدید ساده‌تر می‌شود.

## Guardrails
- Print renderer از داده Source of Truth استفاده کند، نه screenshot UI.
- RTL و فونت فارسی اجباری است.
- Page Break و اعداد مالی باید پایدار باشند.
- CSV/Excel برای داده تحلیلی و PDF برای ارائه/چاپ در نظر گرفته شود.
