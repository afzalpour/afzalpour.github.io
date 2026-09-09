'use strict';

function positiveAmount(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  if (/^0+(?:\.0+)?$/.test(raw)) return null;
  return raw.replace(/\.0+$/, '');
}

export function buildTransactionJournalSuggestion(finding) {
  if (!finding || finding.suggestion_type !== 'journal_from_transaction') return null;
  const meta = finding.metadata || {};
  const amount = positiveAmount(finding.amount);
  if (!amount) return null;

  let debitAccountId = null;
  let creditAccountId = null;
  let description = 'پیشنهاد سند اصلاحی برای تراکنش مالی';

  if (meta.tx_type === 'receipt') {
    debitAccountId = meta.to_account_id;
    creditAccountId = meta.counterpart_account_id;
    description = 'پیشنهاد سند دریافت ثبت‌شده بدون سند حسابداری';
  } else if (meta.tx_type === 'payment') {
    debitAccountId = meta.counterpart_account_id;
    creditAccountId = meta.from_account_id;
    description = 'پیشنهاد سند پرداخت ثبت‌شده بدون سند حسابداری';
  } else if (meta.tx_type === 'transfer') {
    debitAccountId = meta.to_account_id;
    creditAccountId = meta.from_account_id;
    description = 'پیشنهاد سند انتقال ثبت‌شده بدون سند حسابداری';
  } else {
    return null;
  }

  if (!debitAccountId || !creditAccountId || debitAccountId === creditAccountId) return null;

  return Object.freeze({
    entry_date: finding.event_date || null,
    description,
    source_entity_id: finding.entity_id || null,
    lines: Object.freeze([
      Object.freeze({ account_id: debitAccountId, debit: amount, credit: '0' }),
      Object.freeze({ account_id: creditAccountId, debit: '0', credit: amount })
    ])
  });
}
