'use strict';

const ERROR_MESSAGES_FA = {
  'AUTH_REQUIRED':
    'ابتدا وارد حساب کاربری شوید.',

  'Invalid login credentials':
    'ایمیل یا رمز عبور صحیح نیست.',

  'Email not confirmed':
    'ابتدا ایمیل ثبت‌نام را تأیید کنید.',

  'User already registered':
    'این ایمیل قبلاً ثبت شده است.',

  'ACCOUNT_HAS_ACTIVITY':
    'این حساب گردش دارد و حذف نمی‌شود؛ آن را بایگانی کنید.',

  'ACCOUNT_HAS_CHILDREN':
    'این حساب زیرحساب دارد و قابل حذف نیست.',

  'ACCOUNT_HAS_ACTIVE_CHILDREN':
    'ابتدا زیرحساب‌های فعال را بایگانی کنید.',

  'SYSTEM_ACCOUNT_PROTECTED':
    'حساب سیستمی قابل تغییر یا حذف نیست.',

  'ACCOUNT_CODE_NAME_REQUIRED':
    'کد و نام حساب الزامی است.',

  'POSTED_ENTRY_IMMUTABLE':
    'سند ثبت‌شده قابل ویرایش مستقیم نیست.',

  'POSTED_TRANSACTION_IMMUTABLE':
    'تراکنش ثبت‌شده قابل ویرایش مستقیم نیست.',

  'ENTRY_NOT_BALANCED':
    'سند برای ثبت قطعی باید حداقل دو ردیف و جمع بدهکار/بستانکار برابر داشته باشد.',

  'MIN_TWO_LINES':
    'حداقل دو ردیف لازم است.',

  'ACCOUNT_REQUIRED':
    'برای ردیف سند، انتخاب حساب الزامی است.',

  'INVALID_DRAFT_LINE':
    'ردیف پیش‌نویس باید فقط بدهکار یا فقط بستانکار و دارای مبلغ مثبت باشد.',

  'PERIOD_CLOSED':
    'این تاریخ در یک دوره بسته قرار دارد.',

  'FISCAL_YEAR_INVALID':
    'تاریخ سند خارج از سال مالی باز است.',

  'FISCAL_YEAR_CLOSED':
    'سال مالی بسته است.',

  'ACCOUNT_NOT_POSTABLE':
    'فقط حساب تفصیلی فعال قابل ثبت است.',

  'ACCOUNT_ARCHIVED':
    'حساب بایگانی‌شده قابل ثبت نیست.',

  'PRIMARY_ACCOUNT_NOT_FINANCIAL':
    'حساب اصلی باید بانک یا صندوق باشد.',

  'COUNTERPART_ACCOUNT_NOT_FINANCIAL':
    'در انتقال، حساب مقصد نیز باید بانک یا صندوق باشد.',

  'SAME_ACCOUNT_NOT_ALLOWED':
    'حساب مبدأ و مقصد نمی‌توانند یکسان باشند.',

  'OPENING_TARGET_INVALID':
    'حساب سرمایه افتتاحیه نمی‌تواند خودش مانده افتتاحیه بگیرد.',

  'USE_TRANSFER_FOR_FINANCIAL_ACCOUNTS':
    'برای جابه‌جایی بین بانک/صندوق از «انتقال» استفاده کنید.',

  'COUNTERPART_ACCOUNT_REQUIRED':
    'حساب مقابل را انتخاب کنید.',

  'AMOUNT_INVALID':
    'مبلغ معتبر و صحیح وارد کنید.',

  'PARTY_NOT_FOUND':
    'طرف‌حساب معتبر نیست.',

  'ROLE_NOT_ALLOWED':
    'سطح دسترسی شما برای این عملیات کافی نیست.',

  'PERIOD_OVERLAPS_CLOSED':
    'این بازه با یک دوره بسته هم‌پوشانی دارد.',

  'PERIOD_OUTSIDE_FISCAL_YEAR':
    'بازه قفل باید داخل سال مالی باشد.',

  'PERIOD_RANGE_INVALID':
    'بازه دوره معتبر نیست.',

  'PERIOD_NAME_REQUIRED':
    'نام دوره الزامی است.',

  'PATCH_B4_REQUIRED':
    'Patch Gate B-4 روی دیتابیس اجرا نشده است.',

  'CLOUD_CONFIG_MISSING':
    'تنظیمات اتصال Supabase ناقص است.',

  'PATCH_D1_REQUIRED':
    'ماژول فاکتور D1 روی دیتابیس نصب یا در دسترس نیست.',

  'INVOICE_NOT_FOUND':
    'فاکتور پیدا نشد.',

  'INVOICE_TYPE_INVALID':
    'نوع فاکتور معتبر نیست.',

  'INVOICE_DATE_REQUIRED':
    'تاریخ فاکتور الزامی است.',

  'DUE_DATE_INVALID':
    'سررسید نمی‌تواند قبل از تاریخ فاکتور باشد.',

  'PARTY_REQUIRED':
    'انتخاب طرف‌حساب الزامی است.',

  'PARTY_NOT_CUSTOMER':
    'برای فاکتور فروش، طرف‌حساب باید مشتری یا دوطرفه باشد.',

  'PARTY_NOT_VENDOR':
    'برای فاکتور خرید، طرف‌حساب باید فروشنده یا دوطرفه باشد.',

  'INVOICE_LINE_INVALID':
    'مقدار، قیمت یا تخفیف ردیف فاکتور معتبر نیست.',

  'SALE_LINE_MUST_BE_INCOME':
    'ردیف فاکتور فروش باید به حساب درآمد ثبت شود.',

  'PURCHASE_LINE_ACCOUNT_INVALID':
    'ردیف فاکتور خرید باید به حساب هزینه یا دارایی ثبت شود.',

  'DISCOUNT_TOO_LARGE':
    'تخفیف ردیف از مبلغ ناخالص بیشتر است.',

  'INVOICE_LINE_TOTAL_INVALID':
    'مبلغ نهایی ردیف باید بیشتر از صفر باشد.',

  'INVOICE_EMPTY':
    'فاکتور بدون ردیف معتبر قابل ثبت قطعی نیست.',

  'INVOICE_TOTAL_MISMATCH':
    'جمع فاکتور با ردیف‌ها سازگار نیست.',

  'INVOICE_CONTROL_ACCOUNT_MISSING':
    'حساب کنترل دریافتنی یا پرداختنی تعریف نشده است.',

  'POSTED_INVOICE_IMMUTABLE':
    'فاکتور ثبت‌شده قابل ویرایش یا حذف نیست.'
};

export function errorMessageFa(error) {

  const key =
    String(
      error?.message ??
      error ??
      'خطای نامشخص'
    );

  return (
    ERROR_MESSAGES_FA[key] ||
    key
  );
}
