'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`COLLECTION_CLOSE_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('COLLECTION_CLOSE_MONEY_SERIALIZE_FAILED');
  return out;
}

function daysPastDue(dueDate, asOf) {
  if (!dueDate || !asOf || dueDate >= asOf) return 0;
  const a = new Date(`${dueDate}T12:00:00Z`);
  const b = new Date(`${asOf}T12:00:00Z`);
  if (Number.isNaN(a.valueOf()) || Number.isNaN(b.valueOf())) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function priorityLevel(score) {
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function collectionAction({ level, maxDays }) {
  if (level === 'high' || maxDays > 90) {
    return Object.freeze({
      title: 'پیگیری امروز',
      suggestion: 'تماس مستقیم و تعیین تاریخ پرداخت؛ در صورت نیاز پیگیری رسمی با تأیید کاربر.'
    });
  }
  if (level === 'medium') {
    return Object.freeze({
      title: 'یادآوری ظرف ۲۴ ساعت',
      suggestion: 'یادآوری مودبانه، تأیید مانده و درخواست تاریخ دقیق پرداخت.'
    });
  }
  return Object.freeze({
    title: 'پیگیری برنامه‌ریزی‌شده',
    suggestion: 'یادآوری سبک و ثبت زمان پیگیری بعدی.'
  });
}

function buildCollection({ aging, asOf }) {
  const ar = aging?.receivables;
  if (!ar?.available) {
    return Object.freeze({
      available: false,
      total: '0',
      overdue: '0',
      top3CashOpportunity: '0',
      priorities: Object.freeze([])
    });
  }

  const totalTenths = toTenths(ar.total, 'ar_total');
  const internal = (ar.parties || []).map(party => {
    let overdueTenths = 0n;
    let over90Tenths = 0n;
    let maxDays = 0;

    for (const item of party.openItems || []) {
      const days = Number.isFinite(Number(item.daysPastDue))
        ? Number(item.daysPastDue)
        : daysPastDue(item.dueDate, asOf);
      maxDays = Math.max(maxDays, days);
      const remainingTenths = toTenths(item.remaining, 'open_item_remaining');
      if (days > 0) overdueTenths += remainingTenths;
      if (days > 90) over90Tenths += remainingTenths;
    }

    const partyTotalTenths = toTenths(party.total, 'party_total');
    const amountShare = totalTenths > 0n
      ? Number((partyTotalTenths * 10000n) / totalTenths) / 100
      : 0;
    const overdueShare = partyTotalTenths > 0n
      ? Number((overdueTenths * 10000n) / partyTotalTenths) / 100
      : 0;

    let score = Math.min(35, Math.round(amountShare * 0.35));
    score += Math.min(30, Math.round(overdueShare * 0.30));
    if (maxDays > 90) score += 25;
    else if (maxDays > 60) score += 18;
    else if (maxDays > 30) score += 12;
    else if (maxDays > 0) score += 6;
    if (over90Tenths > 0n) score += 10;
    score = Math.min(100, score);
    const level = priorityLevel(score);

    return {
      partyId: party.partyId,
      partyName: party.partyName,
      total: decimal(partyTotalTenths),
      totalTenths: partyTotalTenths,
      overdue: decimal(overdueTenths),
      overdueTenths,
      over90: decimal(over90Tenths),
      over90Tenths,
      maxDays,
      amountShare,
      overdueShare,
      score,
      level,
      action: collectionAction({ level, maxDays })
    };
  }).filter(item => item.totalTenths > 0n);

  internal.sort((a, b) =>
    a.score === b.score
      ? a.totalTenths === b.totalTenths ? 0 : a.totalTenths > b.totalTenths ? -1 : 1
      : b.score - a.score
  );

  const overdueTenths = internal.reduce((sum, item) => sum + item.overdueTenths, 0n);
  const top3Tenths = internal.slice(0, 3).reduce((sum, item) => sum + item.overdueTenths, 0n);
  const priorities = internal.slice(0, 8).map(({ totalTenths: _t, overdueTenths: _o, over90Tenths: _n, ...item }) => Object.freeze(item));

  return Object.freeze({
    available: true,
    total: decimal(totalTenths),
    overdue: decimal(overdueTenths),
    top3CashOpportunity: decimal(top3Tenths),
    priorities: Object.freeze(priorities),
    contracts: Object.freeze({ deterministic: true, oneRialExact: true, autonomousCollection: false })
  });
}

function checklistItem({ id, level, title, description, count = 0, page = null }) {
  return Object.freeze({ id, level, title, description, count, page });
}

function buildMonthEnd({ asOf, entries, invoices, documents, periods, integrity, invoiceIntegrity }) {
  const draftJournals = entries.filter(entry => entry.status === 'draft').length;
  const draftInvoices = invoices.filter(invoice => invoice.status === 'draft').length;
  const pendingDocuments = documents.filter(document =>
    ['uploaded', 'extracted', 'reviewed'].includes(document.status)
  ).length;
  const reviewedUnlinked = documents.filter(document =>
    document.status === 'reviewed' && !document.linked_journal_entry_id
  ).length;
  const unbalanced = Number(integrity?.unbalanced_journals || 0);
  const orphanLines = Number(integrity?.orphan_lines || 0);
  const postedInvoiceNoJournal = Number(invoiceIntegrity?.posted_without_journal || 0);
  const invoiceMismatch = Number(invoiceIntegrity?.total_mismatch || 0);
  const integrityProblems = unbalanced + orphanLines + postedInvoiceNoJournal + invoiceMismatch;
  const alreadyClosed = periods.some(period =>
    period.status === 'closed' && period.date_from <= asOf && period.date_to >= asOf
  );
  const items = [];

  if (integrityProblems > 0) items.push(checklistItem({
    id: 'integrity', level: 'blocked', title: 'رفع خطاهای یکپارچگی',
    description: 'قبل از بستن دوره، خطاهای Ledger/Invoice Integrity باید بررسی شوند.',
    count: integrityProblems, page: 'settings'
  }));
  if (draftJournals > 0) items.push(checklistItem({
    id: 'draft_journals', level: 'attention', title: 'تکمیل پیش‌نویس اسناد',
    description: 'سندهای حسابداری Draft باید تعیین تکلیف شوند.', count: draftJournals, page: 'journal'
  }));
  if (draftInvoices > 0) items.push(checklistItem({
    id: 'draft_invoices', level: 'attention', title: 'تکمیل پیش‌نویس فاکتورها',
    description: 'فاکتورهای Draft را ثبت قطعی یا حذف کنید.', count: draftInvoices, page: 'invoices'
  }));
  if (pendingDocuments > 0) items.push(checklistItem({
    id: 'pending_documents', level: 'attention', title: 'تعیین تکلیف اسناد هوشمند',
    description: 'اسناد Uploaded/Extracted/Reviewed هنوز چرخه حسابداری را کامل نکرده‌اند.',
    count: pendingDocuments, page: 'documents'
  }));
  if (reviewedUnlinked > 0) items.push(checklistItem({
    id: 'reviewed_unlinked', level: 'attention', title: 'اتصال اسناد بازبینی‌شده به Ledger',
    description: 'اسناد Reviewed وجود دارند که هنوز به سند حسابداری نهایی متصل نشده‌اند.',
    count: reviewedUnlinked, page: 'documents'
  }));
  if (!items.length) items.push(checklistItem({
    id: 'ready', level: 'ready', title: 'کنترل‌های پایه آماده‌اند',
    description: 'در کنترل‌های 1.0، مانع شناخته‌شده‌ای برای بستن دوره دیده نشد.', count: 0, page: 'settings'
  }));

  let readiness = 100 - integrityProblems * 30 - draftJournals * 6 - draftInvoices * 5 - pendingDocuments * 3;
  readiness = Math.max(0, Math.min(100, readiness));
  const status = integrityProblems > 0
    ? 'blocked'
    : draftJournals + draftInvoices + pendingDocuments > 0 ? 'attention' : 'ready';

  return Object.freeze({
    asOf,
    alreadyClosed,
    readiness,
    status,
    items: Object.freeze(items),
    counts: Object.freeze({ draftJournals, draftInvoices, pendingDocuments, reviewedUnlinked, integrityProblems })
  });
}

export function buildCollectionCloseSnapshot({
  asOf,
  aging = null,
  entries = [],
  invoices = [],
  documents = [],
  periods = [],
  integrity = null,
  invoiceIntegrity = null
} = {}) {
  if (!asOf) throw new Error('COLLECTION_CLOSE_AS_OF_REQUIRED');
  return Object.freeze({
    asOf,
    collection: buildCollection({ aging, asOf }),
    monthEnd: buildMonthEnd({ asOf, entries, invoices, documents, periods, integrity, invoiceIntegrity }),
    contracts: Object.freeze({
      deterministic: true,
      oneRialExact: true,
      autonomousCollection: false,
      actualLedgerMutation: false
    })
  });
}
