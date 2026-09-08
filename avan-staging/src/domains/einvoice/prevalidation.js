'use strict';

const text = value => String(value ?? '').trim();
const big = value => {
  try { return BigInt(String(value ?? 0).replace(/\.0+$/, '') || '0'); }
  catch { return null; }
};

const ERROR_FA = Object.freeze({
  INVOICE_REQUIRED: 'فاکتور برای بررسی پیدا نشد.',
  SALE_ONLY: 'در این نسخه فقط فاکتور فروش قابل بررسی است.',
  POSTED_ONLY: 'برای صورتحساب الکترونیکی، فاکتور باید ثبت قطعی شده باشد.',
  SUBJECT_UNSUPPORTED: 'موضوع این صورتحساب در نسخه فعلی آوان پشتیبانی نمی‌شود.',
  PATTERN_UNSUPPORTED: 'الگوی این صورتحساب در نسخه فعلی آوان پشتیبانی نمی‌شود.',
  SELLER_MEMORY_ID_REQUIRED: 'شناسه حافظه مالیاتی شرکت ثبت نشده است.',
  SELLER_TAX_ID_REQUIRED: 'شناسه مالیاتی یا کد اقتصادی شرکت ثبت نشده است.',
  BUYER_ID_REQUIRED: 'برای الگوی عمومی، شناسه ملی/اقتصادی خریدار ثبت نشده است.',
  LINE_REQUIRED: 'فاکتور حداقل باید یک ردیف داشته باشد.',
  GOODS_SERVICE_ID_REQUIRED: 'شناسه مالیاتی کالا/خدمت برای یکی از ردیف‌ها ثبت نشده است.',
  TAX_SNAPSHOT_REQUIRED: 'اطلاعات مالیاتی یکی از ردیف‌ها Snapshot معتبر ندارد.',
  TOTAL_INVALID: 'جمع‌های مالی فاکتور با یکدیگر سازگار نیستند.',
  NOTE1_TOO_LONG: 'یادداشت ۱ از طول مجاز این نسخه بیشتر است.',
  NOTE2_TOO_LONG: 'یادداشت ۲ از طول مجاز این نسخه بیشتر است.',
  SEND_RULE_TOO_LONG: 'قاعده ارسال از طول مجاز این نسخه بیشتر است.'
});

const WARNING_FA = Object.freeze({
  TRANSPORT_DISABLED: 'ارسال واقعی در این مرحله فعال نیست و فقط آمادگی اطلاعات بررسی می‌شود.',
  SPEC_NEEDS_OFFICIAL_RECHECK: 'پیش از فعال‌شدن ارسال واقعی، نسخه رسمی روز سامانه مؤدیان باید دوباره تطبیق داده شود.',
  EINVOICE_DISABLED: 'قابلیت ارسال صورتحساب الکترونیکی برای این شرکت هنوز فعال نشده است.'
});

function issue(code, extra = {}) {
  return Object.freeze({ code, message: ERROR_FA[code] || 'اطلاعات صورتحساب کامل نیست.', ...extra });
}

function warning(code, extra = {}) {
  return Object.freeze({ code, message: WARNING_FA[code] || 'این مورد نیاز به بررسی دارد.', ...extra });
}

function lineHasTaxSnapshot(line) {
  const treatment = text(line?.tax_treatment);
  if (!treatment) return false;
  if (!text(line?.tax_profile_code)) return false;
  if (line?.taxable_amount === null || line?.taxable_amount === undefined) return false;
  if (line?.tax_amount === null || line?.tax_amount === undefined) return false;
  if (treatment === 'standard' && !text(line?.tax_rule_version_id)) return false;
  return true;
}

export function validateEInvoiceCandidate(candidate, manifest, options = {}) {
  const errors = [];
  const warnings = [];
  const invoice = candidate?.invoice || null;
  const settings = candidate?.settings || {};
  const buyer = candidate?.buyer || {};
  const lines = Array.isArray(candidate?.lines) ? candidate.lines : [];
  const subject = text(options.subject || 'original') || 'original';
  const pattern = text(options.pattern || 'general') || 'general';
  const sendRule = text(options.sendRule || '');
  const note1 = text(options.note1 || '');
  const note2 = text(options.note2 || '');

  if (!invoice?.id) errors.push(issue('INVOICE_REQUIRED'));
  if (invoice && !manifest.supportedInvoiceTypes.includes(invoice.invoice_type)) errors.push(issue('SALE_ONLY'));
  if (invoice && !manifest.supportedStatuses.includes(invoice.status)) errors.push(issue('POSTED_ONLY'));
  if (!manifest.supportedSubjects.includes(subject)) errors.push(issue('SUBJECT_UNSUPPORTED'));
  if (!manifest.supportedPatterns.includes(pattern)) errors.push(issue('PATTERN_UNSUPPORTED'));

  if (manifest.requirements.taxpayerMemoryId && !text(settings.taxpayer_memory_id)) {
    errors.push(issue('SELLER_MEMORY_ID_REQUIRED'));
  }
  if (
    manifest.requirements.sellerEconomicOrTaxId &&
    !text(settings.economic_code) &&
    !text(settings.tax_identifier)
  ) {
    errors.push(issue('SELLER_TAX_ID_REQUIRED'));
  }
  if (
    manifest.requirements.buyerIdentityForGeneralPattern &&
    pattern === 'general' &&
    !text(buyer.national_id) &&
    !text(buyer.economic_code)
  ) {
    errors.push(issue('BUYER_ID_REQUIRED'));
  }

  if (!lines.length) errors.push(issue('LINE_REQUIRED'));
  lines.forEach((line, index) => {
    if (
      manifest.requirements.officialGoodsServiceIdPerLine &&
      !text(line.official_goods_service_id)
    ) {
      errors.push(issue('GOODS_SERVICE_ID_REQUIRED', { line_no: line.line_no || index + 1 }));
    }
    if (manifest.requirements.taxSnapshotPerLine && !lineHasTaxSnapshot(line)) {
      errors.push(issue('TAX_SNAPSHOT_REQUIRED', { line_no: line.line_no || index + 1 }));
    }
  });

  if (manifest.requirements.deterministicTotals && invoice) {
    const subtotal = big(invoice.subtotal_amount);
    const tax = big(invoice.tax_total);
    const total = big(invoice.total_amount);
    if (subtotal === null || tax === null || total === null || subtotal + tax !== total) {
      errors.push(issue('TOTAL_INVALID'));
    }
  }

  if (note1.length > manifest.fields.note1MaxLength) errors.push(issue('NOTE1_TOO_LONG'));
  if (note2.length > manifest.fields.note2MaxLength) errors.push(issue('NOTE2_TOO_LONG'));
  if (sendRule.length > manifest.fields.sendRuleMaxLength) errors.push(issue('SEND_RULE_TOO_LONG'));

  if (!settings.e_invoice_enabled) warnings.push(warning('EINVOICE_DISABLED'));
  if (!manifest.transport.enabled) warnings.push(warning('TRANSPORT_DISABLED'));
  if (manifest.sourceStatus !== 'official-verified') warnings.push(warning('SPEC_NEEDS_OFFICIAL_RECHECK'));

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    normalized: Object.freeze({
      subject,
      pattern,
      send_rule: sendRule || null,
      note1: note1 || null,
      note2: note2 || null,
      adapter_key: manifest.key,
      adapter_version: manifest.adapterVersion,
      spec_version: manifest.reportedSpecVersion
    })
  });
}

export { ERROR_FA, WARNING_FA };
