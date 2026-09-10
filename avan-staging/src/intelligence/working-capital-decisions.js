'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`WORKING_CAPITAL_DECISION_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('WORKING_CAPITAL_DECISION_SERIALIZE_FAILED');
  return out;
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.valueOf())) throw new Error('WORKING_CAPITAL_DECISION_DATE_INVALID');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function collectionRecommendation(item) {
  const days = Number(item.maxDaysPastDue || 0);
  if (days > 90) {
    return Object.freeze({
      tier: 'critical',
      action: 'contact_and_commitment_today',
      label: 'توافق پرداخت امروز',
      reason: 'بیشترین مانده این طرف‌حساب بیش از ۹۰ روز از سررسید گذشته است.'
    });
  }
  if (days > 60) {
    return Object.freeze({
      tier: 'high',
      action: 'contact_today',
      label: 'پیگیری مستقیم امروز',
      reason: 'مطالبه بین ۶۱ تا ۹۰ روز سررسیدگذشته دارد.'
    });
  }
  if (days > 30) {
    return Object.freeze({
      tier: 'medium',
      action: 'remind_and_confirm_date',
      label: 'یادآوری و اخذ تاریخ پرداخت',
      reason: 'مطالبه بین ۳۱ تا ۶۰ روز سررسیدگذشته دارد.'
    });
  }
  return Object.freeze({
    tier: 'watch',
    action: 'due_reminder',
    label: 'یادآوری سررسیدگذشته',
    reason: 'مطالبه تا ۳۰ روز از سررسید گذشته است.'
  });
}

function paymentRecommendation(item, coveredByCashAtTurn) {
  const tier = item.paymentPriority?.tier || 'due_30';
  if (!coveredByCashAtTurn) {
    return Object.freeze({
      tier: 'liquidity_gap',
      action: 'simulate_before_commitment',
      label: 'ابتدا سناریوی نقدینگی را بررسی کنید',
      reason: 'در ترتیب اولویت فعلی، نقد موجود برای پوشش کامل این تعهد کافی نیست.'
    });
  }
  if (tier === 'overdue') {
    return Object.freeze({
      tier: 'critical',
      action: 'resolve_overdue_today',
      label: 'تعیین تکلیف امروز',
      reason: 'تعهد از سررسید گذشته و در این ترتیب با نقد فعلی قابل پوشش است.'
    });
  }
  if (tier === 'due_7') {
    return Object.freeze({
      tier: 'high',
      action: 'schedule_within_7_days',
      label: 'زمان‌بندی پرداخت این هفته',
      reason: 'تعهد حداکثر تا ۷ روز آینده سررسید می‌شود و در این ترتیب پوشش نقدی دارد.'
    });
  }
  return Object.freeze({
    tier: 'plan',
    action: 'reserve_and_schedule',
    label: 'رزرو نقد و زمان‌بندی',
    reason: 'تعهد در بازه ۳۰ روزه قرار دارد و در ترتیب فعلی پوشش نقدی دارد.'
  });
}

function uniqueEvidence(items) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    if (!item?.type || !item?.id) continue;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(Object.freeze({ type: String(item.type), id: String(item.id) }));
  }
  return Object.freeze(output);
}

function buildCollectionDecisions(snapshot) {
  return Object.freeze((snapshot.collectionPriorities || [])
    .filter(item => toTenths(item.overdue, 'collection_overdue') > 0n)
    .map(item => {
      const recommendation = collectionRecommendation(item);
      return Object.freeze({
        id: `collection:${item.partyId}`,
        kind: 'collection',
        partyId: item.partyId,
        partyName: item.partyName,
        openAmount: item.total,
        overdueAmount: item.overdue,
        maxDaysPastDue: Number(item.maxDaysPastDue || 0),
        recommendation,
        evidence: uniqueEvidence(item.evidence),
        simulationSeed: Object.freeze({
          from: snapshot.asOf,
          to: addDays(snapshot.asOf, 30),
          collections: item.overdue
        })
      });
    }));
}

function buildPaymentDecisions(snapshot) {
  const partyNames = new Map((snapshot.payables?.parties || []).map(item => [item.partyId, item.partyName]));
  const cutoff = addDays(snapshot.asOf, 30);
  const items = (snapshot.payables?.openItems || [])
    .filter(item => item.dueDate <= cutoff)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.id).localeCompare(String(b.id)));

  let runningCash = toTenths(snapshot.cash?.value, 'cash');
  const decisions = [];

  for (const item of items) {
    const amount = toTenths(item.remaining, 'payment_remaining');
    const cashBefore = runningCash;
    const cashAfter = cashBefore - amount;
    const covered = cashBefore >= amount;
    const shortfall = cashAfter < 0n ? -cashAfter : 0n;
    const recommendation = paymentRecommendation(item, covered);

    decisions.push(Object.freeze({
      id: `payment:${item.id}`,
      kind: 'payment',
      itemId: item.id,
      partyId: item.partyId,
      partyName: partyNames.get(item.partyId) || 'طرف‌حساب نامشخص',
      invoiceId: item.invoiceId || null,
      invoiceNo: item.invoiceNo ?? null,
      journalEntryId: item.journalEntryId,
      journalNo: item.journalNo ?? null,
      dueDate: item.dueDate,
      amount: item.remaining,
      cashBefore: decimal(cashBefore),
      projectedCashAfter: decimal(cashAfter),
      cumulativeShortfall: decimal(shortfall),
      coveredByCurrentCashAtTurn: covered,
      recommendation,
      evidence: uniqueEvidence(item.evidence),
      simulationSeed: Object.freeze({
        from: snapshot.asOf,
        to: item.dueDate < snapshot.asOf ? snapshot.asOf : item.dueDate,
        payments: item.remaining
      })
    }));

    runningCash = cashAfter;
  }

  return Object.freeze(decisions);
}

export function buildWorkingCapitalDecisions(snapshot) {
  if (!snapshot?.asOf || !snapshot?.cash || !snapshot?.payables || !snapshot?.receivables) {
    throw new Error('WORKING_CAPITAL_DECISION_SNAPSHOT_REQUIRED');
  }

  const collectionDecisions = buildCollectionDecisions(snapshot);
  const paymentDecisions = buildPaymentDecisions(snapshot);
  const uncoveredPaymentCount = paymentDecisions.filter(item => !item.coveredByCurrentCashAtTurn).length;
  const firstShortfall = paymentDecisions.find(item => toTenths(item.cumulativeShortfall, 'shortfall') > 0n)?.cumulativeShortfall || '0';

  return Object.freeze({
    architecture: 'avan-working-capital-decisions-v1',
    asOf: snapshot.asOf,
    summary: Object.freeze({
      overdueReceivables: snapshot.metrics.overdueReceivables,
      decisionCollectionCount: collectionDecisions.length,
      paymentDecisionCount: paymentDecisions.length,
      uncoveredPaymentCount,
      firstLiquidityShortfall: firstShortfall
    }),
    collections: collectionDecisions,
    payments: paymentDecisions,
    contracts: Object.freeze({
      deterministic: true,
      evidenceRequired: true,
      humanConfirmationRequired: true,
      oneRialExact: true,
      crossPartyNetting: false,
      aiGeneratedAmounts: false,
      aiGeneratedRecommendations: false,
      autonomousMessage: false,
      autonomousCollection: false,
      autonomousPayment: false,
      actualLedgerMutation: false,
      writeOperations: 0
    })
  });
}
