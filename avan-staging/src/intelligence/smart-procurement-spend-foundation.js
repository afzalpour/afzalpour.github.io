'use strict';

import { canonicalDecimalToTenths, canonicalTenthsToDecimal } from '../core/money/canonical-money.js';

export const SMART_PROCUREMENT_SPEND_ARCHITECTURE = Object.freeze({
  id: 'avan-smart-procurement-spend-control-v1',
  methodology: 'deterministic-controls-no-arbitrary-score',
  writeOperations: 0,
  actualLedgerMutation: false,
  approvalMutation: false,
  paymentMutation: false,
  coverage: Object.freeze({
    purchaseInvoice: true,
    inventoryReceipt: true,
    twoWayMatch: true,
    purchaseRequest: false,
    purchaseOrder: false,
    threeWayMatch: false,
    budget: false,
    approval: false,
    paymentExecution: false
  })
});

const RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });
const txt = value => String(value ?? '').trim();
const idOf = value => txt(value);
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(txt(value).slice(0, 10)) ? txt(value).slice(0, 10) : null;

function evidence(type, id, label, meta = '') {
  return Object.freeze({ type, id: id || null, label: txt(label) || 'مرجع خرید', meta: txt(meta) });
}

function finding(id, severity, category, title, description, refs = []) {
  return Object.freeze({ id, severity, category, title, description, evidence: Object.freeze(refs.filter(Boolean)) });
}

function sumExact(values) {
  let total = 0n;
  for (const value of values) {
    const parsed = canonicalDecimalToTenths(value ?? '0');
    if (parsed === null) return null;
    total += parsed;
  }
  return canonicalTenthsToDecimal(total);
}

function exactEqual(leftValue, rightValue) {
  const left = canonicalDecimalToTenths(leftValue ?? '0');
  const right = canonicalDecimalToTenths(rightValue ?? '0');
  return left !== null && right !== null && left === right;
}

function exactDiff(currentValue, previousValue) {
  const current = canonicalDecimalToTenths(currentValue ?? '0');
  const previous = canonicalDecimalToTenths(previousValue ?? '0');
  if (current === null || previous === null) return null;
  return canonicalTenthsToDecimal(current - previous);
}

function percentChange(currentValue, previousValue) {
  const current = canonicalDecimalToTenths(currentValue ?? '0');
  const previous = canonicalDecimalToTenths(previousValue ?? '0');
  if (current === null || previous === null || previous === 0n) return null;
  const base = previous < 0n ? -previous : previous;
  return Number(((current - previous) * 10000n) / base) / 100;
}

function sharePercent(partValue, totalValue) {
  const part = canonicalDecimalToTenths(partValue ?? '0');
  const total = canonicalDecimalToTenths(totalValue ?? '0');
  if (part === null || total === null || total <= 0n) return 0;
  return Number((part * 10000n) / total) / 100;
}

function quantity(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildSmartProcurementSpendControl(input = {}) {
  const asOf = iso(input.asOf);
  if (!asOf) throw new Error('PROCUREMENT_AS_OF_REQUIRED');
  const periodFrom = iso(input.periodFrom) || null;

  const purchaseInvoices = (input.invoices || [])
    .filter(row => row?.invoice_type === 'purchase')
    .filter(row => (!periodFrom || row.invoice_date >= periodFrom) && row.invoice_date <= asOf);
  const purchaseInvoiceIds = new Set(purchaseInvoices.map(row => idOf(row.id)).filter(Boolean));
  const purchaseLines = (input.invoiceLines || []).filter(row => purchaseInvoiceIds.has(idOf(row.invoice_id)));
  const invoiceById = new Map(purchaseInvoices.map(row => [idOf(row.id), row]));
  const parties = new Map((input.parties || []).map(row => [idOf(row.id), row]));
  const items = new Map((input.inventoryItems || []).map(row => [idOf(row.id), row]));

  const receiptDocuments = (input.inventoryDocuments || [])
    .filter(row => row?.document_type === 'receipt' && row?.status === 'posted')
    .filter(row => (!periodFrom || row.document_date >= periodFrom) && row.document_date <= asOf);
  const receiptDocumentIds = new Set(receiptDocuments.map(row => idOf(row.id)).filter(Boolean));
  const receiptLines = (input.inventoryDocumentLines || []).filter(row => receiptDocumentIds.has(idOf(row.inventory_document_id)));
  const receiptLineById = new Map(receiptLines.map(row => [idOf(row.id), row]));
  const receiptDocumentById = new Map(receiptDocuments.map(row => [idOf(row.id), row]));

  const postedInvoices = purchaseInvoices.filter(row => row?.status === 'posted');
  const draftInvoices = purchaseInvoices.filter(row => row?.status === 'draft');
  const postedInvoiceIds = new Set(postedInvoices.map(row => idOf(row.id)));
  const findings = [];

  const postedSpendCanonical = sumExact(postedInvoices.map(row => row.total_amount ?? '0'));
  const draftSpendCanonical = sumExact(draftInvoices.map(row => row.total_amount ?? '0'));
  if (postedSpendCanonical === null || draftSpendCanonical === null) {
    findings.push(finding(
      'money-precision', 'critical', 'money_integrity',
      'جمع خرید با دقت یک ریال قابل محاسبه نیست',
      'حداقل یک مبلغ خرید از قرارداد پولی دقیق آوان خارج است.'
    ));
  }

  const allowedSupplierKinds = new Set(['vendor', 'both']);
  const invalidSuppliers = purchaseInvoices.filter(row => {
    const party = parties.get(idOf(row.party_id));
    return party && !allowedSupplierKinds.has(txt(party.kind));
  });
  if (invalidSuppliers.length) {
    findings.push(finding(
      'supplier-kind-mismatch', 'high', 'supplier',
      'نوع طرف‌حساب برخی خریدها با نقش تأمین‌کننده سازگار نیست',
      `${invalidSuppliers.length} فاکتور خرید به طرف‌حسابی متصل است که در اطلاعات پایه به‌عنوان تأمین‌کننده یا مشتری/تأمین‌کننده ثبت نشده است.`,
      invalidSuppliers.slice(0, 12).map(row => {
        const party = parties.get(idOf(row.party_id));
        return evidence('invoice', row.id, `فاکتور خرید ${row.invoice_no || 'پیش‌نویس'}`, `${party?.name || 'طرف‌حساب'} · ${row.invoice_date || '—'}`);
      })
    ));
  }

  const postedItemWithoutReceipt = purchaseLines.filter(line =>
    postedInvoiceIds.has(idOf(line.invoice_id)) && line.item_id && !line.receipt_line_id
  );
  if (postedItemWithoutReceipt.length) {
    findings.push(finding(
      'posted-item-without-receipt', 'high', 'receipt_match',
      'خرید کالایی قطعی بدون رسید انبار مرتبط وجود دارد',
      `${postedItemWithoutReceipt.length} ردیف کالایی در فاکتور خرید قطعی به رسید انبار متصل نیست. این کنترل برای خدمات یا ردیف‌های غیرکالایی اعمال نمی‌شود.`,
      postedItemWithoutReceipt.slice(0, 16).map(line => {
        const invoice = invoiceById.get(idOf(line.invoice_id));
        const item = items.get(idOf(line.item_id));
        const party = parties.get(idOf(invoice?.party_id));
        return evidence('invoice_line', line.id, `${item?.name || line.description || 'قلم خرید'} · فاکتور ${invoice?.invoice_no || '—'}`, `${party?.name || 'تأمین‌کننده'} · ${invoice?.invoice_date || '—'}`);
      })
    ));
  }

  const invoiceLinksByReceipt = new Map();
  for (const line of purchaseLines) {
    const receiptLineId = idOf(line.receipt_line_id);
    if (!receiptLineId) continue;
    const links = invoiceLinksByReceipt.get(receiptLineId) || [];
    links.push(line);
    invoiceLinksByReceipt.set(receiptLineId, links);
  }

  const reusedReceiptLines = [...invoiceLinksByReceipt.entries()].filter(([, links]) => links.length > 1);
  if (reusedReceiptLines.length) {
    const hasMultiplePostedLinks = reusedReceiptLines.some(([, links]) =>
      links.filter(line => postedInvoiceIds.has(idOf(line.invoice_id))).length > 1
    );
    const refs = reusedReceiptLines.slice(0, 12).flatMap(([receiptLineId, links]) => {
      const receiptLine = receiptLineById.get(receiptLineId);
      const receiptDocument = receiptDocumentById.get(idOf(receiptLine?.inventory_document_id));
      const item = items.get(idOf(receiptLine?.item_id));
      const receiptRef = evidence(
        'inventory_receipt_line',
        receiptLineId,
        `رسید انبار ${receiptDocument?.document_no || '—'} · ${item?.name || 'قلم انبار'}`,
        `${receiptDocument?.document_date || '—'} · ${links.length} اتصال به فاکتور خرید`
      );
      const invoiceRefs = links.slice(0, 4).map(line => {
        const invoice = invoiceById.get(idOf(line.invoice_id));
        return evidence(
          'invoice_line',
          line.id,
          `فاکتور خرید ${invoice?.invoice_no || 'پیش‌نویس'} · ردیف ${line.line_no || '—'}`,
          `${invoice?.status === 'posted' ? 'قطعی' : 'پیش‌نویس'} · ${invoice?.invoice_date || '—'}`
        );
      });
      return [receiptRef, ...invoiceRefs];
    });
    findings.push(finding(
      'receipt-reused', hasMultiplePostedLinks ? 'critical' : 'high', 'receipt_match',
      'یک ردیف رسید انبار به بیش از یک ردیف فاکتور خرید متصل شده است',
      `${reusedReceiptLines.length} ردیف رسید بیش از یک بار در فاکتورهای خرید استفاده شده است. این وضعیت الزاماً به معنی ثبت تکراری نیست، اما پیش از قطعی‌کردن پیش‌نویس‌های مرتبط باید بررسی شود.`,
      refs
    ));
  }

  const quantityMismatches = [];
  const priceMismatches = [];
  for (const line of purchaseLines) {
    const receiptLine = receiptLineById.get(idOf(line.receipt_line_id));
    if (!receiptLine) continue;
    if (quantity(line.quantity) !== quantity(receiptLine.quantity)) quantityMismatches.push({ line, receiptLine });
    if (!exactEqual(line.unit_price, receiptLine.unit_cost)) priceMismatches.push({ line, receiptLine });
  }

  if (quantityMismatches.length) {
    findings.push(finding(
      'receipt-quantity-mismatch', 'medium', 'receipt_match',
      'مقدار فاکتور خرید با رسید انبار یکسان نیست',
      `${quantityMismatches.length} ردیف دارای اختلاف مقدار بین فاکتور و رسید است. خرید مرحله‌ای یا صورتحساب جزئی ممکن است مجاز باشد؛ تصمیم نهایی با کاربر است.`,
      quantityMismatches.slice(0, 12).map(({ line, receiptLine }) => {
        const invoice = invoiceById.get(idOf(line.invoice_id));
        const receiptDocument = receiptDocumentById.get(idOf(receiptLine.inventory_document_id));
        const item = items.get(idOf(line.item_id || receiptLine.item_id));
        return evidence('two_way_match', line.id, `${item?.name || 'قلم خرید'} · فاکتور ${invoice?.invoice_no || 'پیش‌نویس'}`, `فاکتور: ${line.quantity} · رسید ${receiptDocument?.document_no || '—'}: ${receiptLine.quantity}`);
      })
    ));
  }

  if (priceMismatches.length) {
    findings.push(finding(
      'receipt-price-mismatch', 'medium', 'receipt_match',
      'قیمت واحد فاکتور خرید با بهای واحد رسید انبار یکسان نیست',
      `${priceMismatches.length} ردیف دارای اختلاف قیمت واحد است. تخفیف، هزینه جانبی یا اصلاح بهای رسید می‌تواند علت معتبر داشته باشد و باید با شواهد بررسی شود.`,
      priceMismatches.slice(0, 12).map(({ line, receiptLine }) => {
        const invoice = invoiceById.get(idOf(line.invoice_id));
        const receiptDocument = receiptDocumentById.get(idOf(receiptLine.inventory_document_id));
        const item = items.get(idOf(line.item_id || receiptLine.item_id));
        return evidence('two_way_match', line.id, `${item?.name || 'قلم خرید'} · فاکتور ${invoice?.invoice_no || 'پیش‌نویس'}`, `قیمت فاکتور: ${line.unit_price} · بهای رسید ${receiptDocument?.document_no || '—'}: ${receiptLine.unit_cost}`);
      })
    ));
  }

  const usedReceiptLineIds = new Set(invoiceLinksByReceipt.keys());
  const unlinkedReceiptLines = receiptLines.filter(line => !usedReceiptLineIds.has(idOf(line.id)));
  if (unlinkedReceiptLines.length) {
    findings.push(finding(
      'receipt-awaiting-invoice', 'medium', 'receipt_match',
      'رسید انبار بدون فاکتور خرید مرتبط وجود دارد',
      `${unlinkedReceiptLines.length} ردیف رسید انبار قطعی هنوز به ردیف فاکتور خرید متصل نشده است.`,
      unlinkedReceiptLines.slice(0, 16).map(line => {
        const receiptDocument = receiptDocumentById.get(idOf(line.inventory_document_id));
        const item = items.get(idOf(line.item_id));
        return evidence('inventory_receipt_line', line.id, `رسید انبار ${receiptDocument?.document_no || '—'} · ${item?.name || 'قلم انبار'}`, `${receiptDocument?.document_date || '—'} · مقدار ${line.quantity}`);
      })
    ));
  }

  const supplierBuckets = new Map();
  for (const invoice of postedInvoices) {
    const partyId = idOf(invoice.party_id) || 'unknown';
    const bucket = supplierBuckets.get(partyId) || { partyId, invoiceCount: 0, values: [] };
    bucket.invoiceCount += 1;
    bucket.values.push(invoice.total_amount ?? '0');
    supplierBuckets.set(partyId, bucket);
  }
  const supplierSpend = [...supplierBuckets.values()].map(bucket => {
    const spendCanonical = sumExact(bucket.values);
    const party = parties.get(bucket.partyId);
    return Object.freeze({
      partyId: bucket.partyId,
      partyName: party?.name || 'تأمین‌کننده بدون نام',
      invoiceCount: bucket.invoiceCount,
      spendCanonical,
      sharePercent: spendCanonical === null || postedSpendCanonical === null ? null : sharePercent(spendCanonical, postedSpendCanonical)
    });
  }).sort((left, right) => {
    const leftAmount = canonicalDecimalToTenths(left.spendCanonical ?? '0') ?? 0n;
    const rightAmount = canonicalDecimalToTenths(right.spendCanonical ?? '0') ?? 0n;
    return leftAmount === rightAmount ? 0 : leftAmount > rightAmount ? -1 : 1;
  });

  const postedItemLines = purchaseLines
    .filter(line => postedInvoiceIds.has(idOf(line.invoice_id)) && line.item_id)
    .map(line => ({ line, invoice: invoiceById.get(idOf(line.invoice_id)) }))
    .filter(row => row.invoice)
    .sort((left, right) => `${left.invoice.invoice_date || ''}:${String(left.invoice.invoice_no || '').padStart(12, '0')}:${left.line.line_no || 0}`.localeCompare(`${right.invoice.invoice_date || ''}:${String(right.invoice.invoice_no || '').padStart(12, '0')}:${right.line.line_no || 0}`));

  const previousByItem = new Map();
  const priceChanges = [];
  for (const row of postedItemLines) {
    const itemId = idOf(row.line.item_id);
    const previous = previousByItem.get(itemId);
    if (previous && !exactEqual(row.line.unit_price, previous.line.unit_price)) {
      const item = items.get(itemId);
      const party = parties.get(idOf(row.invoice.party_id));
      priceChanges.push(Object.freeze({
        itemId,
        itemName: item?.name || row.line.description || 'قلم خرید',
        supplierName: party?.name || 'تأمین‌کننده',
        invoiceNo: row.invoice.invoice_no || null,
        invoiceDate: row.invoice.invoice_date,
        currentUnitPrice: row.line.unit_price,
        previousUnitPrice: previous.line.unit_price,
        deltaCanonical: exactDiff(row.line.unit_price, previous.line.unit_price),
        percentChange: percentChange(row.line.unit_price, previous.line.unit_price),
        previousInvoiceNo: previous.invoice.invoice_no || null,
        previousInvoiceDate: previous.invoice.invoice_date
      }));
    }
    previousByItem.set(itemId, row);
  }

  const onHandByItem = new Map();
  for (const row of input.inventoryOnHand || []) {
    const itemId = idOf(row.item_id);
    if (!itemId) continue;
    onHandByItem.set(itemId, (onHandByItem.get(itemId) || 0) + quantity(row.quantity_on_hand));
  }
  const reorderCandidates = [...items.values()]
    .filter(row => row?.is_active !== false && quantity(row.min_stock) > (onHandByItem.get(idOf(row.id)) ?? 0))
    .map(row => {
      const onHand = onHandByItem.get(idOf(row.id)) ?? 0;
      const minStock = quantity(row.min_stock);
      return Object.freeze({ itemId: row.id, itemName: row.name || row.sku || 'قلم موجودی', sku: row.sku || '', onHand, minStock, shortage: minStock - onHand });
    })
    .sort((left, right) => right.shortage - left.shortage);

  const critical = findings.filter(row => row.severity === 'critical').length;
  const high = findings.filter(row => row.severity === 'high').length;
  const medium = findings.filter(row => row.severity === 'medium').length;

  return Object.freeze({
    architecture: SMART_PROCUREMENT_SPEND_ARCHITECTURE,
    asOf,
    periodFrom,
    readiness: critical ? 'blocked' : (high || medium) ? 'attention' : 'ready',
    summary: Object.freeze({
      postedPurchaseInvoices: postedInvoices.length,
      draftPurchaseInvoices: draftInvoices.length,
      postedSpendCanonical,
      draftSpendCanonical,
      findings: findings.length,
      critical,
      high,
      medium,
      postedReceiptLines: receiptLines.length,
      unlinkedReceiptLines: unlinkedReceiptLines.length,
      reusedReceiptLines: reusedReceiptLines.length,
      reorderCandidates: reorderCandidates.length
    }),
    findings: Object.freeze(findings.sort((left, right) => RANK[right.severity] - RANK[left.severity])),
    supplierSpend: Object.freeze(supplierSpend.slice(0, 12)),
    priceChanges: Object.freeze(priceChanges.slice(-12).reverse()),
    reorderCandidates: Object.freeze(reorderCandidates.slice(0, 20)),
    coverage: SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage,
    notices: Object.freeze([
      'این ماژول کنترل و تصمیم‌یار خرید است و هیچ درخواست خرید، سفارش خرید، فاکتور، پرداخت یا سند حسابداری را خودکار ایجاد نمی‌کند.',
      'تطبیق فعلی بر فاکتور خرید و رسید انبار موجود در آوان استوار است؛ تا ایجاد مرجع معتبر سفارش خرید، تطبیق سه‌مرحله‌ای صادر نمی‌شود.',
      'نبود منبع حقیقت بودجه و گردش تأیید به معنی نبود کنترل بودجه یا تأیید در نسخه فعلی است؛ سامانه این داده‌ها را حدس نمی‌زند.'
    ])
  });
}
