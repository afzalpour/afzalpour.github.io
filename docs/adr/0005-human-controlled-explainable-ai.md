# ADR-0005 — Explainable, Ledger-grounded, Human-controlled AI

- Status: Accepted
- Date: 2026-09-05

## Context
AI در آوان باید تصمیم‌یار مالی واقعی باشد؛ اما نباید بدون کنترل انسان عملیات حساس مالی انجام دهد یا تحلیل غیرقابل‌توضیح ارائه کند.

## Decision
AI آوان باید:

- Ledger-grounded باشد.
- Explainable باشد.
- Evidence/Drill-down ارائه کند.
- Action-oriented باشد.
- Human-controlled باقی بماند.

AI می‌تواند تحلیل، اولویت‌بندی، پیشنهاد و Draft ایجاد کند؛ اما Posting، پرداخت، ارسال مالیاتی یا عملیات حساس به‌صورت پیش‌فرض نیازمند تایید انسان است.

## Consequences
- UX باید مسیر «چرا این عدد؟» و Evidence را پشتیبانی کند.
- مدل‌های آینده نباید مستقیماً جایگزین Authorization شوند.
- AI output باید از داده معتبر Workspace مشتق شود.

## Guardrails
- هیچ عملیات حساس صرفاً با پاسخ مدل نهایی نشود.
- Confidence و uncertainty در سناریوهای لازم نمایش داده شوند.
- AI هیچ‌گاه مرزهای RLS/Role را دور نزند.
