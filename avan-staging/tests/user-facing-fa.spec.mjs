import assert from 'node:assert/strict';
import { translateUserFacingText, safeUserFacingFa, safeDatabaseFacingFa } from '../src/ui/localization/user-facing-fa.js';

assert.equal(
  translateUserFacingText('Company member added as accountant'),
  'کاربر با نقش حسابدار به شرکت افزوده شد'
);
assert.equal(
  translateUserFacingText('شرکت member added as accountant'),
  'کاربر با نقش حسابدار به شرکت افزوده شد'
);
assert.equal(
  translateUserFacingText('Inventory document posted with financial bridge'),
  'سند انبار ثبت قطعی شد و سند حسابداری مرتبط ایجاد شد'
);
assert.equal(
  translateUserFacingText('Document uploaded'),
  'سند بارگذاری شد'
);
assert.equal(
  translateUserFacingText('داده‌های مالی از PostgreSQL/Supabase خوانده می‌شوند؛ LocalStorage فقط Session کاربر را نگه می‌دارد.'),
  'داده‌های مالی از پایگاه داده ابری آوان خوانده می‌شوند؛ حافظه محلی مرورگر فقط اطلاعات ورود کاربر را نگه می‌دارد.'
);
assert.equal(
  translateUserFacingText('PNG، JPG یا WEBP — حداکثر ۲ مگابایت. لوگو در Storage خصوصی شرکت نگهداری می‌شود.'),
  'فرمت‌های مجاز: پی‌ان‌جی، جی‌پی‌جی یا وب‌پی — حداکثر ۲ مگابایت. لوگو در فضای ذخیره‌سازی خصوصی شرکت نگهداری می‌شود.'
);
assert.equal(
  translateUserFacingText('ارسال صورتحساب الکترونیکی در این Gate فعال نیست و در RC1.5-D فقط با اقدام صریح کاربر بررسی می‌شود.'),
  'ارسال صورتحساب الکترونیکی در این مرحله فعال نیست و در مرحله بعد فقط با تأیید صریح کاربر انجام خواهد شد.'
);
assert.equal(translateUserFacingText('Snapshot مالیاتی'), 'اطلاعات ثبت‌شده مالیاتی');
assert.equal(translateUserFacingText('Foundation فعلی'), 'نسخه پایه فعلی');
assert.equal(translateUserFacingText('Source of Truth حقوق'), 'مرجع معتبر داده حقوق');
assert.equal(translateUserFacingText('active'), 'فعال');
assert.equal(translateUserFacingText('standard'), 'استاندارد');
assert.equal(translateUserFacingText('exempt'), 'معاف');
assert.equal(translateUserFacingText('zero'), 'نرخ صفر');
assert.equal(translateUserFacingText('both'), 'کالا و خدمت');
assert.equal(translateUserFacingText('fixed'), 'ثابت');
assert.equal(translateUserFacingText('rule'), 'تابع قاعده');
assert.equal(
  safeUserFacingFa('Totally unknown backend message', 'رویداد سامانه'),
  'رویداد سامانه'
);
assert.equal(
  safeDatabaseFacingFa('Unknown database enum', 'مقدار ثبت‌شده'),
  'مقدار ثبت‌شده'
);
assert.equal(/[A-Za-z]/.test(safeUserFacingFa('Company member added as accountant')), false);
assert.equal(/[A-Za-z]/.test(safeDatabaseFacingFa('active')), false);

console.log('user-facing-fa.spec.mjs: PASS');
