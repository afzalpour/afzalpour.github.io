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

const rank = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });
const txt = value => String(value ?? '').trim();
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(txt(value).slice(0, 10)) ? txt(value).slice(0, 10) : null;
const idOf = value => txt(value);

function ref(type, id, label, meta = '') {
  return Object.freeze({ type, id: id || null, label: txt(label) || 'مرجع خرید', meta: txt(meta) });
}

function finding(id, severity, category, title, description, evidence = []) {
  return Object.freeze({ id, severity, category, title, description, evidence: Object.freeze(evidence.filter(Boolean)) });
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

function exactDiff(current, previous) {
  const a = canonicalDecimalToTenths(current ?? '0');
  const b = canonicalDecimalToTenths(previous ?? '0');
  if (a === null || b === null) return null;
  return canonicalTenthsToDecimal(a - b);
}

function exactEqual(a, b) {
  const left = canonicalDecimalToTenths(a ?? '0');
  const right = canonicalDecimalToTenths(b ?? '0');
  return left !== null && right !== null && left === right;
}

function percentChange(current, previous) {
  const a = canonicalDecimalToTenths(current ?? '0');
  const b = canonicalDecimalToTenths(previous ?? '0');
  if (a === null || b === null || b === 0n) return null;
  const basisPoints = ((a - b) * 10000n) / (b < 0n ? -b : b);
  return Number(basisPoints) / 100;
}

function sharePercent(part, total) {
  const p = canonicalDecimalToTenths(part ?? '0');
  const t = canonicalDecimalToTenths(total ?? '0');
  if (p === null || t === null || t <= 0n) return 0;
  return Number((p * 10000n) / t) / 100;
}

function quantity(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function buildSmartProcurementSpendControl(input = {}) {
  const asOf = iso(input.asOf);
  if (!asOf) throw new Error('PROCUREMENT_AS_OF_REQUIRED');

  const periodFrom = iso(input.periodFrom) || null;
  const allInvoices = input.invoices || [];
  const purchaseInvoices = allInvoices.filter(row => row?.invoice_type === 'purchase')
    .filter(row => (!periodFrom || row.invoice_date >= periodFrom) && row.invoice_date <= asOf);
  const purchaseInvoiceIds = new Set(purchaseInvoices.map(row => idOf(row.id)).filter(Boolean));
  const purchaseLines = (input.invoiceLines || []).filter(row => purchaseInvoiceIds.has(idOf(row.invoice_id)));
  const parties = new Map((input.parties || []).map(row => [idOf(row.id), row]));
  const items = new Map((input.inventoryItems || []).map(row => [idOf(row.id), row]));
  const receiptDocs = (input.inventoryDocuments || []).filter(row => row?.document_type === 'receipt' && row?.status === 'posted' && (!periodFrom || row.document_date >= periodFrom) && row.document_date <= asOf);
  const receiptDocIds = new Set(receiptDocs.map(row => idOf(row.id)).filter(Boolean));
  const receiptLines = (input.inventoryDocumentLines || []).filter(row => receiptDocIds.has(idOf(row.inventory_document_id)));
  const receiptLineMap = new Map(receiptLines.map(row => [idOf(row.id), row]));
  const receiptDocMap = new Map(receiptDocs.map(row => [idOf(row.id), row]));
  const findings = [];

  const invoiceById = new Map(purchaseInvoices.map(row => [idOf(row.id), row]));
  const postedInvoices = purchaseInvoices.filter(row => row?.status === 'posted');
  const draftInvoices = purchaseInvoices.filter(row => row?.status === 'draft');
  const postedInvoiceIds = new Set(postedInvoices.map(row => idOf(row.id)));

  const postedSpendCanonical = sumExact(postedInvoices.map(row => row.total_amount ?? '0'));
  const draftSpendCanonical = sumExact(draftInvoices.map(row => row.total_amount ?? '0'));
  if (postedSpendCanonical === null || draftSpendCanonical === null) {
    findings.push(finding('money-precision', 'critical', 'money_integrity', 'جمع خرید با دقت یک ریال قابل محاسبه نیست', 'حداقل یک مبلغ خرید از قرارداد پولی دقیق آوان خارج است.'));
  }

  const supplierKindsAllowed = new Set(['vendor', 'both']);
  const invalidSuppliers = purchaseInvoices.filter(row => {
    const party = parties.get(idOf(row.party_id));
    return party && !supplierKindsAllowed.has(txt(party.kind));
  });
  if (invalidSuppliers.length) {
    findings.push(finding(
      'supplier-kind-mismatch',
      'high',
      'supplier',
      'نوع طرف‌حساب برخی خریدها با نقش تأمین‌کننده سازگار نیست',
      `${invalidSuppliers.length} فاکتور خرید به طرف‌حسابی متصل است که در اطلاعات پایه به‌عنوان تأمین‌کننده یا مشتری/تأمین‌کننده ثبت نشده است.`,
      invalidSuppliers.slice(0, 12).map(row => {
        const party = parties.get(idOf(row.party_id));
        return ref('invoice', row.id, `فاکتور خرید ${row.invoice_no || 'پیش‌نویس'}`, `${party?.name || 'طرف‌حساب'} · ${row.invoice_date || '—'}`);
      })
    ));
  }

  const postedItemWithoutReceipt = purchaseLines.filter(line => postedInvoiceIds.has(idOf(line.invoice_id)) && line.item_id && !line.receipt_line_id);
  if (postedItemWithoutReceipt.length) {
    findings.push(finding(
      'posted-item-without-receipt',
      'high',
      'receipt_match',
      'خرید کالایی قطعی بدون رسید انبار مرتبط وجود دارد',
      `${postedItemWithoutReceipt.length} ردیف کالایی در فاکتور خرید قطعی به رسید انبار متصل نیست. این کنترل برای خدمات یا ردیف‌های غیرکالایی اعمال نمی‌شود.`,
      postedItemWithoutReceipt.slice(0, 16).map(line => {
        const inv = invoiceById.get(idOf(line.invoice_id));
        const item = items.get(idOf(line.item_id));
        const party = parties.get(idOf(inv?.party_id));
        return ref('invoice_line', line.id, `${item?.name || line.description || 'قلم خرید'} · فاکتور ${inv?.invoice_no || '—'}`, `${party?.name || 'تأمین‌کننده'} · ${inv?.invoice_date || '—'}`);
      })
    ));
  }

  const linksByReceipt = new Map();
  for (const line of purchaseLines) {
    const receiptLineId = idOf(line.receipt_line_id);
    if (!receiptLineId) continue;
    const links = linksByReceipt.get(receiptLineId) || [];
    links.push(line);
    linksByReceipt.set(receiptLineId, links);
  }

  const multiReceiptLinks = [...linksByReceipt.entries()].filter(([, links]) => links.length > 1);
  if (multiReceiptLinks.length) {
    const multiplePosted = multiReceiptLinks.some(([, links]) => links.filter(line => postedInvoiceIds.has(idOf(line.invoice_id))).length > 1);
    findings.push(finding(
      'receipt-reused',
      multiplePosted ? 'critical' : 'high',
      'receipt_match',
      'یک ردیف رسید انبار به بیش از یک ردیف فاکتور خرید متصل شده است',
      `${multiReceiptLinks.length} ردیف رسید بیش از یک بار در فاکتورهای خرید استفاده شده است. این وضعیت الزاماً به معنی ثبت تکراری نیست، اما پیش از قطعی‌کردن پیش‌نویس‌های مرتبط باید بررسی شود.`,
      multiReceiptLinks.slice(0, 12).flatMap(([receiptLineId, links]) => {
        const receiptLine = receiptLineMap.get(receiptLineId);
        const receipt = receiptDocMap.get(idOf(receiptLine?.inventory_document_id));
        const item = items.get(idOf(receiptLine?.item_id));
        return [
          ref('inventory_receipt_line', receiptLineId, `رسید انبار ${receipt?.document_no || '—'} · ${item?.name || 'قلم انبار'}`, `${receipt?.document_date || '—'} · ${links.length} اتصال به فاکتور خرید`),
          ...links.slice(0, 4).map(line => {
            const inv = invoiceById.get(idOf(line.invoice_id));
            return ref('invoice_line', line.id, `فاکتور خرید ${inv?.invoice_no || 'پیش‌نویس'} · ردیف ${line.line_no || '—'}`, `${inv?.status === 'posted' ? 'قطعی' : 'پیش‌نویس'} · ${inv?.invoice_date || '—'}`);
          })
        ];
      })
    ));
  }

  const qtyMismatches = [];
  const priceMismatches = [];
  for (const line of purchaseLines) {
    const receiptLine = receiptLineMap.get(idOf(line.receipt_line_id));
    if (!receiptLine) continue;
    if (quantity(line.quantity) !== quantity(receiptLine.quantity)) qtyMismatches.push({ line, receiptLine });
    if (!exactEqual(line.unit_price, receiptLine.unit_cost)) priceMismatches.push({ line, receiptLine });
  }

  if (qtyMismatches.length) {
    findings.push(finding(
      'receipt-quantity-mismatch',
      'medium',
      'receipt_match',
      'مقدار فاکتور خرید با رسید انبار یکسان نیست',
      `${qtyMismatches.length} ردیف دارای اختلاف مقدار بین فاکتور و رسید است. خرید مرحله‌ای یا صورتحساب جزئی ممکن است مجاز باشد؛ تصمیم نهایی با کاربر است.`,
      qtyMismatches.slice(0, 12).map(({ line, receiptLine }) => {
        const inv = invoiceById.get(idOf(line.invoice_id));
        const receipt = receiptDocMap.get(idOf(receiptLine.inventory_document_id));
        const item = items.get(idOf(line.item_id || receiptLine.item_id));
        return ref('two_way_match', line.id, `${item?.name || 'قلم خرید'} · فاکتور ${inv?.invoice_no || 'پیش‌نویس'}`, `فاکتور: ${line.quantity} · رسید ${receipt?.document_no || '—'}: ${receiptLine.quantity}`);
      })
    ));
  }

  if (priceMismatches.length) {
    findings.push(finding(
      'receipt-price-mismatch',
      'medium',
      'receipt_match',
      'قیمت واحد فاکتور خرید با بهای واحد رسید انبار یکسان نیست',
      `${priceMismatches.length} ردیف دارای اختلاف قیمت واحد است. تخفیف، هزینه جانبی یا اصلاح بهای رسید می‌تواند علت معتبر داشته باشد و باید با شواهد بررسی شود.`,
      priceMismatches.slice(0, 12).map(({ line, receiptLine }) => {
        const inv = invoiceById.get(idOf(line.invoice_id));
        const receipt = receiptDocMap.get(idOf(receiptLine.inventory_document_id));
        const item = items.get(idOf(line.item_id || receiptLine.item_id));
        return ref('two_way_match', line.id, `${item?.name || 'قلم خرید'} · فاکتور ${inv?.invoice_no || 'پیش‌نویس'}`, `قیمت فاکتور: ${line.unit_price} · بهای رسید ${receipt?.document_no || '—'}: ${receiptLine.unit_cost}`);
      })
    ));
  }

  const receiptUsed = new Set([...linksByReceipt.keys()]);
  const unlinkedReceipts = receiptLines.filter(line => !receiptUsed.has(idOf(line.id)));
  if (unlinkedReceipts.length) {
    findings.push(finding(
      'receipt-awaiting-invoice',
      'medium',
      'receipt_match',
      'رسید انبار بدون فاکتور خرید مرتبط وجود دارد',
      `${unlinkedReceipts.length} ردیف رسید انبار قطعی هنوز به ردیف فاکتور خرید متصل نشده است.`,
      unlinkedReceipts.slice(0, 16).map(line => {
        const receipt = receiptDocMap.get(idOf(line.inventory_document_id));
        const item = items.get(idOf(line.item_id));
        return ref('inventory_receipt_line', line.id, `رسید انبار ${receipt?.document_no || '—'} · ${item?.name || 'قلم انبار'}`, `${receipt?.document_date || '—'} · مقدار ${line.quantity}`);
      })
    ));
  }

  const supplierBuckets = new Map();
  for (const invoice of postedInvoices) {
    const key = idOf(invoice.party_id) || 'unknown';
    const bucket = supplierBuckets.get(key) || { partyId: key, invoiceCount: 0, values: [] };
    bucket.invoiceCount += 1;
    bucket.values.push(invoice.total_amount ?? '0');
    supplierBuckets.set(key, bucket);
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
  }).sort((a, b) => {
    const left = canonicalDecimalToTenths(a.spendCanonical ?? '0') ?? 0n;
    const right = canonicalDecimalToTenths(b.spendCanonical ?? '0') ?? 0n;
    return left === right ? 0 : left > right ? -1 : 1;
  });

  const postedItemLines = purchaseLines.filter(line => postedInvoiceIds.has(idOf(line.invoice_id)) && line.item_id)
    .map(line => ({ line, invoice: invoiceById.get(idOf(line.invoice_id)) }))
    .filter(row => row.invoice)
    .sort((a, b) => `${a.invoice.invoice_date || ''}:${String(a.invoice.invoice_no || '').padStart(12, '0')}:${a.line.line_no || 0}`.localeCompare(`${b.invoice.invoice_date || ''}:${String(b.invoice.invoice_no || '').padStart(12, '0')}:${b.line.line_no || 0}`));

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
    const key = idOf(row.item_id);
    if (!key) continue;
    onHandByItem.set(key, (onHandByItem.get(key) || 0) + quantity(row.quantity_on_hand));
  }
  const reorderCandidates = [...items.values()].filter(row => row?.is_active !== false && quantity(row.min_stock) > onHandByItem.get(idOf(row.id)) ?? 0)
    .map(row => {
      const onHand = onHandByItem.get(idOf(row.id)) || 0;
      const minStock = quantity(row.min_stock);
      return Object.freeze({ itemId: row.id, itemName: row.name || row.sku || 'قلم موجودی', sku: row.sku || '', onHand, minStock, shortage: minStock - onHand });
    }).sort((a, b) => b.shortage - a.shortage);

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
      unlinkedReceiptLines: unlinkedReceipts.length,
      reusedReceiptLines: multiReceiptLinks.length,
      reorderCandidates: reorderCandidates.length
    }),
    findings: Object.freeze(findings.sort((a, b) => rank[b.severity] - rank[a.severity])),
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
