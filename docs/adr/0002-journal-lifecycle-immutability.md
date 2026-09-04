# ADR-0002 — Journal Lifecycle and Posted Immutability

- Status: Accepted
- Date: 2026-09-05

## Context
برای Auditability و سلامت مالی، سند قطعی نباید مانند Draft قابل ویرایش باشد.

## Decision
چرخه استاندارد سند:

`Draft → Posted → Reversed`

- Draft قابل ویرایش/حذف در چارچوب مجاز است.
- Posted و خطوط آن Immutable هستند.
- اصلاح سند قطعی با Reversal و ثبت سند اصلاحی انجام می‌شود.

## Consequences
- Audit trail قابل اتکا می‌ماند.
- گزارش‌های تاریخی قابل بازتولید هستند.
- UI باید تفاوت وضعیت‌ها را واضح نشان دهد.

## Guardrails
- هیچ endpoint یا RPC معمولی حق Update/Delete مستقیم Posted journal/lines را ندارد.
- Orphan journal lines باید صفر بماند.
- عملیات Reversal باید قابل ردیابی به سند اصلی باشد.

## Rejected alternatives
- ویرایش مستقیم سند Posted.
- حذف فیزیکی سند قطعی برای اصلاح خطا.
