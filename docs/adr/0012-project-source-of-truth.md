# ADR-0012 — GitHub Project Constitution Is the Source of Truth Across Chats

- Status: Accepted
- Date: 2026-09-05

## Context
تاریخچه چت به‌تنهایی مرجع قابل‌اعتماد بلندمدت برای یک پروژه چندمرحله‌ای نیست. تصمیم‌ها، Gateها و نقطه ادامه باید مستقل از Session گفتگو قابل بازیابی باشند.

## Decision
Source of Truth پروژه آوان سه لایه دارد:

1. `AVAN_MASTER_PROMPT.md` — Vision، قواعد ثابت و قرارداد همکاری.
2. `AVAN_CURRENT_STATE.md` — آخرین وضعیت اجرایی، Gateهای پاس‌شده، مشکلات باز و Next Gate.
3. `docs/adr/` — تصمیم‌های معماری شماره‌دار و تاریخچه تغییر آنها.

در هر چت جدید، Assistant باید پیش از تغییر فنی این سه لایه را بررسی کند.

بعد از هر Live Gate PASS یا تغییر معماری مهم، Current State و در صورت لزوم ADRها باید به‌روزرسانی شوند.

## Consequences
- ادامه پروژه از چت‌های جدید deterministicتر می‌شود.
- تصمیم‌های بنیادی کمتر دوباره‌کاری یا نقض می‌شوند.
- Git history به تاریخچه تصمیم‌ها متصل می‌شود.

## Guardrails
- هیچ Gate بدون تایید صریح کاربر PASS ثبت نشود.
- ADR Accepted بدون ADR جایگزین نقض نشود.
- Current State باید واقعیت Repository/Deploy/Live Test را منعکس کند، نه برنامه یا فرض.
- در تعارض، داده و Live Gate واقعی بر خلاصه قدیمی اولویت دارند.
