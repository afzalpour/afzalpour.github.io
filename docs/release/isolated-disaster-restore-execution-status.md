# آوان — وضعیت اجرای آزمون بازیابی فاجعه

تاریخ: **2026-09-14**  
وضعیت: **محیط مستقل آماده / بازیابی منطقی در انتظار اجرای محلی امن**

## محیط‌ها

- محیط عملیاتی: `Avan-production`
- شناسه محیط عملیاتی: `dkyqsxnllvxypigxpygo`
- محیط مستقل بازیابی: `Avan-recovery-drill-20260914`
- شناسه محیط بازیابی: `summnepwuziwulzvpcms`
- ناحیه هر دو پروژه: `eu-central-1`
- وضعیت محیط بازیابی: `ACTIVE_HEALTHY`

شناسه منبع و مقصد متفاوت است؛ بنابراین مقصد از نظر مرز ایمنی برای آزمون بازیابی مستقل معتبر است.

## بررسی آماده‌بودن مقصد

پیش از بازیابی، مقصد فقط ساختارهای پیش‌فرض Supabase را داشت:

- `auth`: 23 جدول
- `storage`: 8 جدول
- `vault`: 1 جدول
- هیچ جدول `public` آوان در مقصد وجود نداشت.

محیط عملیاتی در همان زمان دارای ساختار زیر بود:

- `public`: 40 جدول
- `private`: 7 جدول
- `auth`: 23 جدول
- `storage`: 8 جدول
- `realtime`: 3 جدول
- `supabase_migrations`: 1 جدول
- `vault`: 1 جدول

افزونه‌های نصب‌شده در منبع و مقصد یکسان بودند:

- `pg_stat_statements` 1.11
- `pgcrypto` 1.3
- `plpgsql` 1.0
- `supabase_vault` 0.3.1
- `uuid-ossp` 1.1

در محیط عملیاتی تعداد رازهای ثبت‌شده در `vault.secrets` برابر **0** بود؛ بنابراین برای این آزمون خاص، انتقال راز Vault موضوع فعالی نیست.

## مرز دسترسی فعلی

اتصال مدیریتی موجود در این جلسه اجازه اجرای SQL روی هر دو پروژه و ایجاد پروژه مستقل را می‌دهد، اما گذرواژه اتصال مستقیم PostgreSQL یا عملیات `pg_dump`/`psql` از طریق همین اتصال در دسترس نیست. گذرواژه‌ها نباید در گفتگو، Repository یا گزارش آزمون قرار گیرند.

بنابراین مرحله بازیابی منطقی باید روی دستگاه مورد اعتماد کاربر با رشته اتصال محلی انجام شود. محیط عملیاتی در این مرحله فقط خوانده می‌شود و تمام نوشتن‌ها فقط به پروژه `summnepwuziwulzvpcms` محدود می‌مانند.

## فرمان‌های مرجع اجرای محلی

طبق راهنمای رسمی Supabase، ابتدا از منبع فایل‌های نقش‌ها، ساختار، داده و تاریخچه مهاجرت گرفته می‌شود و سپس با `psql` در مقصد مستقل بازیابی می‌شود. رشته‌های اتصال و گذرواژه‌ها باید فقط به‌صورت محلی جایگزین شوند و هرگز commit نشوند.

```text
supabase db dump --db-url <SOURCE_DB_URL> -f roles.sql --role-only
supabase db dump --db-url <SOURCE_DB_URL> -f schema.sql
supabase db dump --db-url <SOURCE_DB_URL> -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url <SOURCE_DB_URL> -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url <SOURCE_DB_URL> -f history_data.sql --use-copy --data-only --schema supabase_migrations

psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql --dbname <RECOVERY_DB_URL>
psql --single-transaction --variable ON_ERROR_STOP=1 --file history_schema.sql --file history_data.sql --dbname <RECOVERY_DB_URL>
```

## پس از بازیابی

به‌محض پایان موفق بازیابی، کنترل‌های DR-2 و DR-3 باید مستقیماً روی پروژه بازیابی اجرا شوند:

- شمارش و زمان آخرین رکوردهای مالی اصلی؛
- سطر یتیم سند حسابداری؛
- مغایرت بین شرکت و خطوط سند؛
- اسناد قطعی نامتوازن؛
- سطر یتیم و مغایرت خطوط فاکتور؛
- دقت یک‌ریالی؛
- RLS و نشت بین شرکت‌ها؛
- دسترسی مؤثر `SECURITY DEFINER` برای `anon`/`authenticated`.

تا زمان بازیابی واقعی و پاس‌شدن این کنترل‌ها، آزمون بازیابی فاجعه **OPEN** باقی می‌ماند.