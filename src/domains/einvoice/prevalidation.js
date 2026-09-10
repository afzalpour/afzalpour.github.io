'use strict';

import {
  UNIT_TOMAN,
  canonicalDecimalToTenths,
  decimalMicros,
  latinDigits,
  lineCanonicalAmount
} from '../../core/money/canonical-money.js';

const SEVERITY = Object.freeze({ error: 'error', warning: 'warning', info: 'info' });
const GOODS_SERVICE_ID = /^\d{13}$/;

function finding(code, severity, field, messageFa, source = 'avan-core') {
  return Object.freeze({
    code,
    severity,
    field,
    message_fa: messageFa,
    source
  });
}

function exactTenths(value) {
  return canonicalDecimalToTenths(value);
}

function positiveQuantity(value) {
  const parsed = decimalMicros(value);
  return parsed !== null && parsed > 0n;
}

function sumTenths(values) {
  let total = 0n;
  for (const value of values) {
    const parsed = exactTenths(value);
    if (parsed === null) return null;
    total += parsed;
  }
  return total;
}

function validateHeader(model, findings) {
  const invoice = model.invoice || {};
  const seller = model.seller || {};
  const buyer = model.buyer || {};

  if (invoice.type !== 'sale') {
    findings.push(finding(
      'OUTGOING_SALE_ONLY', SEVERITY.error, 'invoice.type',
      'پیش‌اعتبارسنجی صورتحساب خروجی فقط برای فاکتور فروش انجام می‌شود؛ فاکتور خرید مسیر دریافت/ورودی جداگانه دارد.'
    ));
  }
  if (!invoice.date) {
    findings.push(finding('INVOICE_DATE_MISSING', SEVERITY.error, 'invoice.date', 'تاریخ فاکتور برای صورتحساب الکترونیکی الزامی است.'));
  }
  if (!invoice.number) {
    findings.push(finding(
      'INVOICE_NUMBER_MISSING', SEVERITY.error, 'invoice.number',
      'فاکتور هنوز شماره قطعی ندارد؛ داده آن قابل بررسی است اما برای Adapter ارسال آماده نیست.'
    ));
  }
  if (invoice.status === 'reversed') {
    findings.push(finding('INVOICE_REVERSED', SEVERITY.error, 'invoice.status', 'فاکتور برگشتی نباید به‌عنوان صورتحساب عادی جدید ارسال شود.'));
  } else if (invoice.status === 'draft') {
    findings.push(finding(
      'INVOICE_DRAFT', SEVERITY.info, 'invoice.status',
      'این فاکتور پیش‌نویس است؛ پیش‌اعتبارسنجی مجاز است اما این Gate هیچ ارسال واقعی انجام نمی‌دهد.'
    ));
  }
  if (invoice.status === 'posted' && !invoice.journal_entry_id) {
    findings.push(finding(
      'POSTED_INVOICE_JOURNAL_MISSING', SEVERITY.error, 'invoice.journal_entry_id',
      'فاکتور قطعی است اما سند حسابداری مرجع ندارد؛ ابتدا مغایرت منبع اصلاح شود.'
    ));
  }

  if (!seller.taxpayer_memory_id) {
    findings.push(finding(
      'SELLER_MEMORY_ID_MISSING', SEVERITY.error, 'seller.taxpayer_memory_id',
      'شناسه یکتای حافظه مالیاتی فروشنده در تنظیمات تکمیل نشده است.', 'taxpayer-system-stable'
    ));
  }
  if (!seller.tax_identifier) {
    findings.push(finding(
      'SELLER_TAX_IDENTIFIER_MISSING', SEVERITY.error, 'seller.tax_identifier',
      'شناسه مالیاتی فروشنده در تنظیمات تکمیل نشده است.', 'taxpayer-system-stable'
    ));
  }
  if (!seller.economic_code) {
    findings.push(finding(
      'SELLER_ECONOMIC_CODE_MISSING', SEVERITY.warning, 'seller.economic_code',
      'کد اقتصادی فروشنده خالی است؛ Adapter نسخه‌دار باید براساس الگوی صورتحساب، الزام نهایی آن را کنترل کند.', 'provider-profile-required'
    ));
  }
  if (!seller.tax_enabled) {
    findings.push(finding(
      'TAX_WORKSPACE_DISABLED', SEVERITY.warning, 'seller.tax_enabled',
      'ماژول مالیات شرکت غیرفعال است؛ برای آمادگی ارسال باید وضعیت مالیاتی هر ردیف به‌صورت صریح Snapshot شده باشد.'
    ));
  }
  if (!seller.e_invoice_enabled) {
    findings.push(finding(
      'EINVOICE_WORKSPACE_DISABLED', SEVERITY.warning, 'seller.e_invoice_enabled',
      'ارسال صورتحساب الکترونیکی برای این شرکت فعال نشده است؛ این کنترل فقط آمادگی داده را می‌سنجد.'
    ));
  }

  if (!buyer.party_id || !buyer.name) {
    findings.push(finding('BUYER_MISSING', SEVERITY.error, 'buyer', 'طرف‌حساب/خریدار فاکتور مشخص نیست.'));
  } else if (!buyer.national_id && !buyer.economic_code) {
    findings.push(finding(
      'BUYER_IDENTITY_INCOMPLETE', SEVERITY.warning, 'buyer.national_id',
      'شناسه ملی/کد اقتصادی خریدار تکمیل نشده است؛ الزام دقیق آن به نوع و الگوی صورتحساب Provider وابسته است.', 'provider-profile-required'
    ));
  }
}

function validateLines(model, findings) {
  if (!model.lines?.length) {
    findings.push(finding('INVOICE_LINES_EMPTY', SEVERITY.error, 'lines', 'صورتحساب بدون ردیف قابل آماده‌سازی نیست.'));
    return;
  }

  model.lines.forEach((line, index) => {
    const prefix = `lines[${index}]`;
    const label = `ردیف ${line.line_no || index + 1}`;
    const officialId = latinDigits(line.official_goods_service_id || '').replace(/\s/g, '');

    if (!officialId) {
      findings.push(finding(
        'GOODS_SERVICE_ID_MISSING', SEVERITY.error, `${prefix}.official_goods_service_id`,
        `${label}: شناسه رسمی کالا/خدمت ثبت نشده است.`, 'taxpayer-system-stable'
      ));
    } else if (!GOODS_SERVICE_ID.test(officialId)) {
      findings.push(finding(
        'GOODS_SERVICE_ID_INVALID', SEVERITY.error, `${prefix}.official_goods_service_id`,
        `${label}: شناسه کالا/خدمت باید شناسه رسمی ۱۳ رقمی باشد.`, 'taxpayer-system-stable'
      ));
    }

    if (!positiveQuantity(line.quantity)) {
      findings.push(finding('LINE_QUANTITY_INVALID', SEVERITY.error, `${prefix}.quantity`, `${label}: تعداد باید عددی مثبت و معتبر باشد.`));
    }

    for (const [key, title] of [
      ['unit_price', 'فی'], ['discount', 'تخفیف'], ['line_total', 'جمع ردیف']
    ]) {
      if (exactTenths(line[key]) === null) {
        findings.push(finding(
          'LINE_MONEY_PRECISION_INVALID', SEVERITY.error, `${prefix}.${key}`,
          `${label}: ${title} باید با دقت یک ریال قابل نمایش باشد.`
        ));
      }
    }

    const expected = lineCanonicalAmount({
      quantity: line.quantity,
      unitPrice: line.unit_price,
      discount: line.discount || '0',
      unit: UNIT_TOMAN
    });
    const actualTotal = exactTenths(line.line_total);
    if (!expected.ok) {
      findings.push(finding('LINE_CALCULATION_INVALID', SEVERITY.error, prefix, `${label}: مبلغ ردیف از تعداد، فی و تخفیف قابل محاسبه دقیق نیست.`));
    } else if (actualTotal !== null && expected.tenths !== actualTotal) {
      findings.push(finding(
        'LINE_TOTAL_MISMATCH', SEVERITY.error, `${prefix}.line_total`,
        `${label}: جمع ذخیره‌شده با تعداد × فی − تخفیف برابر نیست.`
      ));
    }

    if (!line.tax_profile_id || !line.tax_rule_version_id || !line.tax_treatment) {
      findings.push(finding(
        'LINE_TAX_SNAPSHOT_MISSING', SEVERITY.error, `${prefix}.tax_profile_id`,
        `${label}: Snapshot وضعیت مالیاتی کامل نیست؛ پروفایل، نسخه قاعده و نوع برخورد مالیاتی باید مشخص باشند.`
      ));
    }
    if (exactTenths(line.taxable_amount) === null || exactTenths(line.tax_amount) === null) {
      findings.push(finding(
        'LINE_TAX_AMOUNT_INVALID', SEVERITY.error, `${prefix}.tax_amount`,
        `${label}: مبلغ مشمول و مالیات باید با دقت یک ریال ثبت شده باشند.`
      ));
    }
    if (!line.description && !line.item_name) {
      findings.push(finding('LINE_DESCRIPTION_MISSING', SEVERITY.warning, `${prefix}.description`, `${label}: شرح کالا/خدمت خالی است.`));
    }
  });
}

function validateTotals(model, findings) {
  const invoice = model.invoice || {};
  for (const [key, title] of [
    ['subtotal_amount', 'جمع قبل از مالیات'],
    ['tax_total', 'جمع مالیات'],
    ['total_amount', 'جمع نهایی']
  ]) {
    if (exactTenths(invoice[key]) === null) {
      findings.push(finding('INVOICE_MONEY_PRECISION_INVALID', SEVERITY.error, `invoice.${key}`, `${title} فاکتور با دقت یک ریال قابل نمایش نیست.`));
    }
  }

  const subtotal = exactTenths(invoice.subtotal_amount);
  const taxTotal = exactTenths(invoice.tax_total);
  const finalTotal = exactTenths(invoice.total_amount);
  const lineSubtotal = sumTenths(model.lines.map(line => line.line_total));
  const lineTax = sumTenths(model.lines.map(line => line.tax_amount));

  if (subtotal !== null && lineSubtotal !== null && subtotal !== lineSubtotal) {
    findings.push(finding('INVOICE_SUBTOTAL_MISMATCH', SEVERITY.error, 'invoice.subtotal_amount', 'جمع قبل از مالیات فاکتور با مجموع ردیف‌ها برابر نیست.'));
  }
  if (taxTotal !== null && lineTax !== null && taxTotal !== lineTax) {
    findings.push(finding('INVOICE_TAX_TOTAL_MISMATCH', SEVERITY.error, 'invoice.tax_total', 'جمع مالیات فاکتور با مجموع مالیات ردیف‌ها برابر نیست.'));
  }
  if (subtotal !== null && taxTotal !== null && finalTotal !== null && subtotal + taxTotal !== finalTotal) {
    findings.push(finding('INVOICE_FINAL_TOTAL_MISMATCH', SEVERITY.error, 'invoice.total_amount', 'جمع نهایی فاکتور با جمع قبل از مالیات + مالیات برابر نیست.'));
  }
}

export function prevalidateElectronicInvoice(model) {
  const findings = [];
  validateHeader(model, findings);
  validateLines(model, findings);
  validateTotals(model, findings);

  const errors = findings.filter(item => item.severity === SEVERITY.error).length;
  const warnings = findings.filter(item => item.severity === SEVERITY.warning).length;
  const info = findings.filter(item => item.severity === SEVERITY.info).length;

  return Object.freeze({
    schema_version: model?.schema_version || null,
    ready: errors === 0,
    submission_supported: false,
    summary: Object.freeze({ errors, warnings, info, total: findings.length }),
    findings: Object.freeze(findings),
    checked_at: new Date().toISOString()
  });
}
