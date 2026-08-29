# حساب‌یار V17 — مسیر انتشار Production

1. یک پروژه Supabase جدا از Demo بسازید و `supabase-schema-v17-production.sql` را در SQL Editor اجرا کنید.
2. فقط URL پروژه و **publishable/anon key** را در `config.js` قرار دهید. Service Role، JWT secret یا کلید خصوصی Push هرگز نباید در مرورگر باشد.
3. GitHub Pages یا هر HTTPS host برای PWA مناسب است. Service Worker در HTTPS فعال می‌شود.
4. قبل از استفاده واقعی مالی، Migration/backup، تست RLS با حداقل دو کاربر، تست بستن دوره، برگشت سند و Disaster Recovery انجام شود.
5. Web Push کامل به یک Backend/Edge Function برای نگهداری VAPID private key و ارسال Push نیاز دارد. فایل Schema جای ذخیره Subscription را آماده کرده است.
6. قفل WebAuthn موجود در Prototype فقط **قفل محلی دستگاه** است. احراز هویت حساب Cloud و تأیید cryptographic سروری باید در Backend انجام شود.

## وضعیت پیاده‌سازی
- Auth/Workspace/RLS: Schema آماده و Client موجود است.
- ماژول‌های پایه Accounts/COA/Budgets/Transactions: REST sync نرمال‌شده موجود است.
- ماژول‌های جدیدتر V11–V17: Full Workspace Snapshot sync اضافه شده تا Cloud-persistent باشند؛ برای مقیاس Production بهتر است به‌تدریج به جداول نرمال‌شده مهاجرت شوند.
- Ledger/Audit/Periods/Approvals: جداول Production و DB guard آماده هستند؛ UI Prototype نیز Guard برنامه‌ای دارد.
