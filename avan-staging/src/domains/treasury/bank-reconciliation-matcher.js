// AVAN RC1.6-A — deterministic, explainable bank reconciliation candidate matcher.
// Pure domain module: no network, no writes, no auto-confirm.

const DAY_MS = 86_400_000;

function requiredText(value) {
  const out = String(value ?? '').trim();
  return out || null;
}

function canonicalTenth(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d))?$/);
  if (!match) return null;
  const sign = match[1] === '-' ? -1n : 1n;
  return sign * (BigInt(match[2]) * 10n + BigInt(match[3] || '0'));
}

function normalizeReference(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fa')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\s\-_/\\.:،,]+/g, '');
}

function descriptionTokens(value) {
  return new Set(String(value ?? '')
    .toLocaleLowerCase('fa')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => x.length >= 3));
}

function tokenOverlap(a, b) {
  const left = descriptionTokens(a);
  const right = descriptionTokens(b);
  if (!left.size || !right.size) return false;
  for (const token of left) if (right.has(token)) return true;
  return false;
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round(Math.abs(da.getTime() - db.getTime()) / DAY_MS);
}

export function resolveBankTransactionDirection(transaction, bankLedgerAccountId) {
  const tx = transaction || {};
  const ledgerId = requiredText(bankLedgerAccountId);
  if (!ledgerId || tx.status !== 'posted') return null;

  if (tx.tx_type === 'receipt' && tx.to_account_id === ledgerId) return 'credit';
  if (tx.tx_type === 'payment' && tx.from_account_id === ledgerId) return 'debit';
  if (tx.tx_type === 'transfer') {
    const incoming = tx.to_account_id === ledgerId;
    const outgoing = tx.from_account_id === ledgerId;
    if (incoming === outgoing) return null;
    return incoming ? 'credit' : 'debit';
  }
  return null;
}

export function evaluateBankReconciliationCandidate({ statementLine, transaction, financialAccount, maxDateDistanceDays = 3 } = {}) {
  const line = statementLine || {};
  const tx = transaction || {};
  const account = financialAccount || {};
  const workspaceId = requiredText(line.workspace_id);

  if (!workspaceId || tx.workspace_id !== workspaceId || account.workspace_id !== workspaceId) return null;
  if (account.kind !== 'bank') return null;
  if (!['credit', 'debit'].includes(line.direction)) return null;
  if (tx.status !== 'posted' || !['receipt', 'payment', 'transfer'].includes(tx.tx_type)) return null;

  const lineAmount = canonicalTenth(line.amount);
  const txAmount = canonicalTenth(tx.amount);
  if (lineAmount === null || txAmount === null || lineAmount <= 0n || lineAmount !== txAmount) return null;

  const direction = resolveBankTransactionDirection(tx, account.ledger_account_id);
  if (direction !== line.direction) return null;

  const distance = dateDistanceDays(line.booking_date, tx.tx_date);
  const maxDistance = Math.max(0, Math.min(30, Number(maxDateDistanceDays) || 0));
  if (distance === null || distance > maxDistance) return null;

  let score = 70;
  const reasons = ['EXACT_AMOUNT', 'BANK_ACCOUNT_SIDE_MATCH'];

  const lineRef = normalizeReference(line.reference_no);
  const txRef = normalizeReference(tx.reference);
  if (lineRef && txRef && lineRef === txRef) {
    score += 20;
    reasons.push('EXACT_REFERENCE');
  }

  if (distance === 0) {
    score += 10;
    reasons.push('SAME_DAY');
  } else if (distance === 1) {
    score += 7;
    reasons.push('DATE_WITHIN_1_DAY');
  } else if (distance <= 3) {
    score += 3;
    reasons.push('DATE_WITHIN_3_DAYS');
  }

  if (tokenOverlap(line.description, tx.description)) {
    score = Math.min(100, score + 3);
    reasons.push('DESCRIPTION_TOKEN_MATCH');
  }

  return {
    transaction_id: tx.id,
    score: Math.min(100, score),
    reason_codes: reasons,
    date_distance_days: distance,
    direction,
    amount_tenth_toman: lineAmount.toString(),
  };
}

export function suggestBankReconciliationMatches({ statementLine, transactions = [], financialAccount, maxDateDistanceDays = 3, limit = 10 } = {}) {
  const max = Math.max(1, Math.min(50, Number(limit) || 10));
  return transactions
    .map(transaction => evaluateBankReconciliationCandidate({ statementLine, transaction, financialAccount, maxDateDistanceDays }))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.date_distance_days - b.date_distance_days || String(a.transaction_id).localeCompare(String(b.transaction_id)))
    .slice(0, max);
}
