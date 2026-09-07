'use strict';

const ERROR_MESSAGES_FA = Object.freeze({
  AUTH_REQUIRED: 'ابتدا وارد حساب کاربری شوید.',
  COMPANY_SELECTION_REQUIRED: 'برای ادامه، ابتدا یکی از شرکت‌های خود را انتخاب کنید.',
  COMPANY_REQUIRED: 'شرکت فعال مشخص نشده است.',
  COMPANY_ACCESS_REQUIRED: 'به این شرکت دسترسی ندارید یا دسترسی شما تغییر کرده است.',
  'Invalid login credentials': 'ایمیل یا رمز عبور صحیح نیست.',
  'Email not confirmed': 'ابتدا ایمیل ثبت‌نام را تأیید کنید.',
  'User already registered': 'این ایمیل قبلاً ثبت شده است.',
  ACCOUNT_HAS_ACTIVITY: 'این حساب گردش دارد و حذف نمی‌شود؛ آن را بایگانی کنید.',
  ACCOUNT_HAS_CHILDREN: 'این حساب زیرحساب دارد و قابل حذف نیست.',
  ACCOUNT_HAS_ACTIVE_CHILDREN: 'ابتدا زیرحساب‌های فعال را بایگانی کنید.',
  SYSTEM_ACCOUNT_PROTECTED: 'حساب سیستمی قابل تغییر یا حذف نیست.',
  ACCOUNT_CODE_NAME_REQUIRED: 'کد و نام حساب الزامی است.',
  POSTED_ENTRY_IMMUTABLE: 'سند ثبت‌شده قابل ویرایش مستقیم نیست.',
  POSTED_TRANSACTION_IMMUTABLE: 'تراکنش ثبت‌شده قابل ویرایش مستقیم نیست.',
  ENTRY_NOT_BALANCED: 'سند برای ثبت قطعی باید حداقل دو ردیف و جمع بدهکار و بستانکار برابر داشته باشد.',
  MIN_TWO_LINES: 'حداقل دو ردیف لازم است.',
  ACCOUNT_REQUIRED: 'برای ردیف سند، انتخاب حساب الزامی است.',
  INVALID_DRAFT_LINE: 'ردیف پیش‌نویس باید فقط بدهکار یا فقط بستانکار و دارای مبلغ مثبت باشد.',
  PERIOD_CLOSED: 'این تاریخ در یک دوره بسته قرار دارد.',
  FISCAL_YEAR_INVALID: 'تاریخ سند خارج از سال مالی باز است.',
  FISCAL_YEAR_CLOSED: 'سال مالی بسته است.',
  ACCOUNT_NOT_POSTABLE: 'فقط حساب تفصیلی فعال قابل ثبت است.',
  ACCOUNT_ARCHIVED: 'حساب بایگانی‌شده قابل ثبت نیست.',
  PRIMARY_ACCOUNT_NOT_FINANCIAL: 'حساب اصلی باید بانک یا صندوق باشد.',
  COUNTERPART_ACCOUNT_NOT_FINANCIAL: 'در انتقال، حساب مقصد نیز باید بانک یا صندوق باشد.',
  SAME_ACCOUNT_NOT_ALLOWED: 'حساب مبدأ و مقصد نمی‌توانند یکسان باشند.',
  OPENING_TARGET_INVALID: 'حساب سرمایه افتتاحیه نمی‌تواند خودش مانده افتتاحیه بگیرد.',
  USE_TRANSFER_FOR_FINANCIAL_ACCOUNTS: 'برای جابه‌جایی بین بانک و صندوق از «انتقال» استفاده کنید.',
  COUNTERPART_ACCOUNT_REQUIRED: 'حساب مقابل را انتخاب کنید.',
  AMOUNT_INVALID: 'مبلغ معتبر و صحیح وارد کنید.',
  PARTY_NOT_FOUND: 'طرف‌حساب معتبر نیست.',
  ROLE_NOT_ALLOWED: 'سطح دسترسی شما برای این عملیات کافی نیست.',
  PERIOD_OVERLAPS_CLOSED: 'این بازه با یک دوره بسته هم‌پوشانی دارد.',
  PERIOD_OUTSIDE_FISCAL_YEAR: 'بازه قفل باید داخل سال مالی باشد.',
  PERIOD_RANGE_INVALID: 'بازه دوره معتبر نیست.',
  PERIOD_NAME_REQUIRED: 'نام دوره الزامی است.',
  PATCH_B4_REQUIRED: 'بخش موردنیاز این عملیات هنوز روی پایگاه داده فعال نشده است.',
  CLOUD_CONFIG_MISSING: 'تنظیمات اتصال ابری ناقص است.',
  PATCH_D1_REQUIRED: 'بخش فاکتور هنوز روی پایگاه داده فعال نشده است.',
  INVOICE_NOT_FOUND: 'فاکتور پیدا نشد.',
  INVOICE_TYPE_INVALID: 'نوع فاکتور معتبر نیست.',
  INVOICE_DATE_REQUIRED: 'تاریخ فاکتور الزامی است.',
  DUE_DATE_INVALID: 'سررسید نمی‌تواند قبل از تاریخ فاکتور باشد.',
  PARTY_REQUIRED: 'انتخاب طرف‌حساب الزامی است.',
  PARTY_NOT_CUSTOMER: 'برای فاکتور فروش، طرف‌حساب باید مشتری یا دوطرفه باشد.',
  PARTY_NOT_VENDOR: 'برای فاکتور خرید، طرف‌حساب باید فروشنده یا دوطرفه باشد.',
  INVOICE_LINE_INVALID: 'مقدار، قیمت یا تخفیف ردیف فاکتور معتبر نیست.',
  SALE_LINE_MUST_BE_INCOME: 'ردیف فاکتور فروش باید به حساب درآمد ثبت شود.',
  PURCHASE_LINE_ACCOUNT_INVALID: 'ردیف فاکتور خرید باید به حساب هزینه یا دارایی ثبت شود.',
  DISCOUNT_TOO_LARGE: 'تخفیف ردیف از مبلغ ناخالص بیشتر است.',
  INVOICE_LINE_TOTAL_INVALID: 'مبلغ نهایی ردیف باید بیشتر از صفر باشد.',
  INVOICE_EMPTY: 'فاکتور بدون ردیف معتبر قابل ثبت قطعی نیست.',
  INVOICE_TOTAL_MISMATCH: 'جمع فاکتور با ردیف‌ها سازگار نیست.',
  INVOICE_CONTROL_ACCOUNT_MISSING: 'حساب کنترل دریافتنی یا پرداختنی تعریف نشده است.',
  POSTED_INVOICE_IMMUTABLE: 'فاکتور ثبت‌شده قابل ویرایش یا حذف نیست.',
  NEGATIVE_STOCK_FORBIDDEN: 'موجودی کالا برای این فروش کافی نیست. ابتدا موجودی قابل فروش را کنترل کنید.',
  negative_stock_forbidden: 'موجودی کالا برای این فروش کافی نیست. ابتدا موجودی قابل فروش را کنترل کنید.',
  CHECK_DETAILS_REQUIRED: 'برای چک، شماره چک و نام بانک الزامی است.',
  CHECK_DUPLICATE: 'چکی با همین مشخصات قبلاً ثبت شده است. شماره چک، بانک و شماره حساب را بررسی کنید.',
  CHECK_NOT_FOUND: 'چک موردنظر پیدا نشد.',
  CHECK_NOT_OUTSTANDING: 'این چک دیگر در وضعیت باز نیست و این عملیات روی آن مجاز نیست.',
  CHECK_CLEAR_DATE_INVALID: 'تاریخ وصول یا پاس‌شدن چک معتبر نیست.',
  CHECK_BOUNCE_DATE_INVALID: 'تاریخ برگشت چک معتبر نیست.',
  BANK_ACCOUNT_REQUIRED: 'برای این عملیات، انتخاب حساب بانکی الزامی است.',
  SETTLEMENT_PLAN_TYPE_INVALID: 'نوع شرایط تسویه معتبر نیست.',
  SETTLEMENT_SCHEDULE_REQUIRED: 'حداقل یک ردیف برای برنامه تسویه لازم است.',
  SETTLEMENT_AMOUNT_INVALID: 'مبلغ برنامه تسویه معتبر نیست.',
  SETTLEMENT_DUE_DATE_INVALID: 'تاریخ سررسید برنامه تسویه معتبر نیست.',
  SETTLEMENT_METHOD_INVALID: 'روش تسویه معتبر نیست.',
  SETTLEMENT_METHOD_REQUIRED: 'روش تسویه را انتخاب کنید.',
  SETTLEMENT_PLAN_TOTAL_MISMATCH: 'جمع برنامه تسویه باید دقیقاً با مبلغ فاکتور برابر باشد.',
  SETTLEMENT_FINANCIAL_ACCOUNT_REQUIRED: 'برای تسویه نقدی یا بانکی، حساب مالی را انتخاب کنید.',
  SETTLEMENT_SCHEDULE_NOT_FOUND: 'ردیف سررسید موردنظر پیدا نشد.',
  SETTLEMENT_ALREADY_PROCESSED: 'این سررسید قبلاً تسویه یا پردازش شده است.',
  SETTLEMENT_DATE_INVALID: 'تاریخ تسویه معتبر نیست.',
  INVOICE_NOT_POSTED: 'برای انجام تسویه، فاکتور باید ابتدا ثبت قطعی شده باشد.',
  FISCAL_YEAR_NOT_FOUND_FOR_SETTLEMENT: 'برای تاریخ تسویه، سال مالی معتبر پیدا نشد.'
});

function normalize(error) {
  return String(error?.message ?? error ?? '').trim();
}

export function errorMessageFa(error) {
  const key = normalize(error);
  if (ERROR_MESSAGES_FA[key]) return ERROR_MESSAGES_FA[key];

  const lower = key.toLowerCase();

  if (
    lower.includes('session from session_id claim') ||
    lower.includes('session does not exist') ||
    lower.includes('session not found')
  ) {
    return 'نشست شما دیگر معتبر نیست. لطفاً دوباره وارد شوید.';
  }

  if (
    lower.includes('financial_checks_unique_') ||
    lower.includes('financial_checks_workspace_id_direction_bank_name_check_num_key') ||
    (lower.includes('duplicate key') && lower.includes('financial_checks'))
  ) {
    return ERROR_MESSAGES_FA.CHECK_DUPLICATE;
  }

  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return 'رکوردی با همین مشخصات قبلاً ثبت شده است. اطلاعات را بررسی کنید.';
  }

  if (lower.includes('negative_stock_forbidden')) {
    return ERROR_MESSAGES_FA.NEGATIVE_STOCK_FORBIDDEN;
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('timeout')
  ) {
    return 'ارتباط با سامانه برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.';
  }

  if (lower.includes('permission denied') || lower.includes('not authorized') || lower.includes('forbidden')) {
    return 'اجازه انجام این عملیات را ندارید.';
  }

  // قاعده هسته: متن فنی یا خطای ناشناخته هرگز مستقیماً به کاربر نمایش داده نشود.
  return 'انجام عملیات با خطا روبه‌رو شد. اطلاعات واردشده را بررسی و دوباره تلاش کنید.';
}
