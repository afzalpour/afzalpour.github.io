# ADR-0003 — Workspace + RLS as the Primary Data Security Boundary

- Status: Accepted
- Date: 2026-09-05

## Context
آوان Multi-user و در آینده Multi-company است. جداسازی داده نباید صرفاً به فیلتر UI وابسته باشد.

## Decision
- هر داده مالی باید به Workspace/Company context تعلق داشته باشد.
- Supabase/PostgreSQL RLS مرز اصلی جداسازی داده است.
- Role و active membership باید Server-side اعتبارسنجی شوند.
- Browser هرگز Service Role Key دریافت نمی‌کند.
- عملیات حساس از RPC امن یا Edge Function استفاده می‌کنند.

## Consequences
- خطای UI به‌تنهایی نباید موجب نشت داده شود.
- تست RLS دوکاربره جزو Regression اصلی است.
- Multi-company آینده بر همین boundary توسعه می‌یابد.

## Guardrails
- Direct mutationهای حساس از Browser محدود/ممنوع باشند.
- Last active Owner محافظت شود.
- Secret/Service Role فقط Server-side.
- هیچ Feature جدیدی نباید bypass امنیتی برای راحتی UI ایجاد کند.
