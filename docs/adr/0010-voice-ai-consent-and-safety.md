# ADR-0010 — Voice AI Is Optional, Consent-based, and Never an Authentication Factor

- Status: Accepted
- Date: 2026-09-05

## Context
آوان در آینده Voice Command، Voice Query، Voice Response و احتمالاً پاسخ با صدای انتخابی/صدای خود کاربر خواهد داشت. صدا می‌تواند جعل شود و نباید جای Authorization را بگیرد.

## Decision
- Voice AI یک Interface برای Intent و Interaction است، نه مرز امنیتی.
- عملیات حساس بعد از Voice Intent همچنان Role/RLS/Confirmation معمول را طی می‌کنند.
- Voice cloning فقط Opt-in و با رضایت صریح کاربر قابل بررسی است.
- کاربر باید بتواند Voice profile را حذف/غیرفعال کند.
- صدای شبیه‌سازی‌شده هرگز به‌عنوان Authentication یا Approval مستقل پذیرفته نمی‌شود.

## Consequences
- UX صوتی می‌تواند قدرتمند باشد بدون تضعیف امنیت مالی.
- Privacy/consent بخشی از طراحی Feature خواهد بود.
- پاسخ صوتی باید با متن/خلاصه قابل مشاهده همراه باشد.

## Guardrails
- High-risk action فقط با voice نهایی نشود.
- رضایت، retention و deletion policy صریح باشد.
- Voice model/output نباید Secret یا credential نگهداری کند.
