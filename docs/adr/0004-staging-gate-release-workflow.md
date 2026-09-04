# ADR-0004 — Staging-first, Gate-based Release Workflow

- Status: Accepted
- Date: 2026-09-05

## Context
آوان یک سیستم مالی است و تغییرات باید قابل‌کنترل، قابل‌برگشت و قابل Live-test باشند.

## Decision
روال استاندارد توسعه:

`Requirement محدود → Branch → Patch → PR → Diff review → Merge → Staging → Live Gate → Next Gate`

Production/root فقط پس از Gateهای لازم و Regression نهایی Promote می‌شود.

## Consequences
- Featureهای بزرگ به Patchهای کوچک‌تر شکسته می‌شوند.
- Live PASS فقط توسط کاربر تایید می‌شود.
- Assistant نباید Gate را صرفاً بر اساس Merge پاس‌شده تلقی کند.

## Guardrails
- Staging محل توسعه و Gate است.
- Production promotion مستقل است.
- هر Patch ترجیحاً Rollback ساده داشته باشد.
- تغییرات DB/Edge/Frontend در صورت ریسک متفاوت به Gateهای جدا تقسیم شوند.
