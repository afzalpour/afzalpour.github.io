'use strict';

import { canonicalDecimalToTenths } from '../core/money/canonical-money.js';
import { buildCollectionCloseSnapshot } from '../ai/collection-close.js';
import { buildRiskAuditSnapshot } from '../ai/risk-audit.js';

const SEVERITY_ORDER = Object.freeze({ critical: 1, high: 2, medium: 3, low: 4 });

function requiredIsoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('CONTINUOUS_CLOSE_AUDIT_AS_OF_REQUIRED');
  return text;
}

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`CONTINUOUS_CLOSE_AUDIT_INVALID_MONEY:${field}`);
  return parsed;
}

function uniqueEvidence(refs = []) {
  const seen = new Set();
  const out = [];
  for (const ref of refs) {
    if (!ref?.type || !ref?.id) continue;
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(Object.freeze({ type: String(ref.type), id: String(ref.id) }));
  }
  return Object.freeze(out);
}

function refs(type, rows = []) {
  return uniqueEvidence(rows.map(row => row?.id ? { type, id: row.id } : null));
}

function closeEvidence(id, { entries, invoices, documents, controlTower }) {
  if (id === 'draft_journals') return refs('journal_entry', entries.filter(row => row.status === 'draft'));
  if (id === 'draft_invoices') return refs('invoice', invoices.filter(row => row.status === 'draft'));
  if (id === 'pending_documents') {
    return refs('document', documents.filter(row => ['uploaded', 'extracted', 'reviewed'].includes(row.status)));
  }
  if (id === 'reviewed_unlinked') {
    return refs('document', documents.filter(row => row.status === 'reviewed' && !row.linked_journal_entry_id));
  }
  if (id === 'integrity') return Object.freeze([{ type: 'integrity_control', id: 'ledger_invoice_integrity' }]);
  if (id === 'bank_reconciliation_open') return uniqueEvidence(controlTower?.metrics?.bank?.evidence || []);
  if (id === 'inventory_reconciliation_open') return uniqueEvidence(controlTower?.metrics?.inventory?.evidence || []);
  if (id === 'control_account_party_links') {
    const action = (controlTower?.actions || []).find(item => item.id === 'review_control_account_party_links');
    return uniqueEvidence(action?.evidence || []);
  }
  return Object.freeze([]);
}

function control({ id, status, severity, title, description, count = 0, evidence = [] }) {
  return Object.freeze({ id, status, severity, title, description, count, evidence: uniqueEvidence(evidence) });
}

function towerCloseControls(controlTower) {
  const controls = [];
  const blockers = new Set(controlTower?.closeReadiness?.blockers || []);
  const bank = controlTower?.metrics?.bank;
  const inventory = controlTower?.metrics?.inventory;

  if (blockers.has('bank_reconciliation_open')) {
    controls.push(control({
      id: 'bank_reconciliation_open', status: 'attention', severity: 'high',
      title: 'مغایرت بانکی باز',
      description: 'پیش از Close، ردیف‌های صورتحساب بانکی تطبیق‌داده‌نشده باید تعیین تکلیف شوند.',
      count: Number(bank?.count || 0), evidence: bank?.evidence || []
    }));
  }
  if (blockers.has('inventory_reconciliation_open')) {
    controls.push(control({
      id: 'inventory_reconciliation_open', status: 'attention', severity: 'high',
      title: 'مغایرت کنترل انبار و حسابداری',
      description: 'کنترل انبار/حسابداری هنوز به وضعیت reconciled نرسیده است.',
      count: Number(inventory?.count || 0), evidence: inventory?.evidence || []
    }));
  }
  if (blockers.has('receivable_lines_without_party') || blockers.has('payable_lines_without_party')) {
    const action = (controlTower?.actions || []).find(item => item.id === 'review_control_account_party_links');
    controls.push(control({
      id: 'control_account_party_links', status: 'attention', severity: 'high',
      title: 'حساب کنترلی بدون طرف‌حساب',
      description: 'در دریافتنی/پرداختنی، ردیف‌هایی بدون party_id وجود دارد و باید قبل از Close بررسی شوند.',
      count: Number(action?.count || 0), evidence: action?.evidence || []
    }));
  }
  return controls;
}

function legacyCloseControls(monthEnd, context) {
  return (monthEnd?.items || [])
    .filter(item => item.id !== 'ready')
    .map(item => {
      const severity = item.level === 'blocked'
        ? 'critical'
        : item.id === 'draft_journals' || item.id === 'draft_invoices' ? 'medium' : 'low';
      return control({
        id: item.id,
        status: item.level === 'blocked' ? 'blocked' : 'attention',
        severity,
        title: item.title,
        description: item.description,
        count: Number(item.count || 0),
        evidence: closeEvidence(item.id, context)
      });
    });
}

function journalDuplicateExceptions({ entries = [], lines = [] }) {
  const linesByEntry = new Map();
  for (const line of lines) {
    if (!line?.journal_entry_id) continue;
    if (!linesByEntry.has(line.journal_entry_id)) linesByEntry.set(line.journal_entry_id, []);
    linesByEntry.get(line.journal_entry_id).push(line);
  }

  const groups = new Map();
  for (const entry of entries) {
    if (entry?.status !== 'posted' || entry?.reversal_of || entry?.source_type === 'reversal') continue;
    const entryLines = linesByEntry.get(entry.id) || [];
    if (entryLines.length < 2) continue;
    const signatureLines = entryLines.map(line => [
      line.account_id || '',
      line.party_id || '',
      toTenths(line.debit, 'journal_debit').toString(),
      toTenths(line.credit, 'journal_credit').toString()
    ].join(':')).sort();
    const key = `${String(entry.entry_date || '').slice(0, 10)}|${signatureLines.join('|')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  return [...groups.values()]
    .filter(group => group.length > 1)
    .slice(0, 5)
    .map((group, index) => Object.freeze({
      id: `audit_duplicate_journal_${index}`,
      source: 'audit',
      category: 'duplicate',
      severity: 'medium',
      title: 'اسناد ثبت‌شده بسیار مشابه',
      description: `${group.length} سند Posted در یک تاریخ با ترکیب حساب/طرف‌حساب/بدهکار/بستانکار یکسان دیده شد. این هشدار قطعیِ ثبت تکراری نیست و باید توسط حسابدار بررسی شود.`,
      count: group.length,
      value: null,
      confidence: 'exact_ledger_signature',
      evidence: refs('journal_entry', group)
    }));
}

function auditEvidence(finding) {
  if (Array.isArray(finding?.evidence) && finding.evidence.length) return uniqueEvidence(finding.evidence);
  if (finding?.entityType && finding?.entityId) {
    const typeMap = Object.freeze({
      invoice: 'invoice', document: 'document', journal: 'journal_entry',
      transaction: 'financial_transaction', party: 'party'
    });
    return uniqueEvidence([{ type: typeMap[finding.entityType] || finding.entityType, id: finding.entityId }]);
  }
  if (finding?.confidence === 'database_integrity') {
    return Object.freeze([{ type: 'integrity_control', id: 'ledger_invoice_integrity' }]);
  }
  return Object.freeze([]);
}

function riskExceptions(riskSnapshot) {
  return (riskSnapshot?.auditFindings || []).map(finding => Object.freeze({
    id: `audit_${finding.id}`,
    source: 'audit',
    category: String(finding.id || '').startsWith('duplicate_') ? 'duplicate'
      : String(finding.id || '').includes('integrity') || finding.confidence === 'database_integrity' ? 'integrity'
        : 'anomaly',
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    count: Number(finding.count || 1),
    value: finding.value ?? null,
    confidence: finding.confidence || 'rule',
    evidence: auditEvidence(finding)
  }));
}

function closeExceptions(controls) {
  return controls.map(item => Object.freeze({
    id: `close_${item.id}`,
    source: 'close',
    category: item.severity === 'critical' ? 'integrity' : 'close_readiness',
    severity: item.severity,
    title: item.title,
    description: item.description,
    count: item.count,
    value: null,
    confidence: 'deterministic_control',
    evidence: item.evidence
  }));
}

function sortExceptions(items) {
  return items.sort((a, b) => {
    const severity = (SEVERITY_ORDER[a.severity] || 99) - (SEVERITY_ORDER[b.severity] || 99);
    if (severity) return severity;
    const title = String(a.title || '').localeCompare(String(b.title || ''), 'fa');
    return title || String(a.id).localeCompare(String(b.id));
  });
}

export function buildContinuousCloseAuditFoundation({
  asOf,
  controlTower,
  entries = [],
  lines = [],
  invoices = [],
  transactions = [],
  documents = [],
  parties = [],
  periods = [],
  integrity = null,
  invoiceIntegrity = null
} = {}) {
  const normalizedAsOf = requiredIsoDate(asOf);
  if (!controlTower?.contracts?.deterministic) throw new Error('CONTINUOUS_CLOSE_AUDIT_CONTROL_TOWER_REQUIRED');

  const legacyClose = buildCollectionCloseSnapshot({
    asOf: normalizedAsOf,
    aging: null,
    entries,
    invoices,
    documents,
    periods,
    integrity,
    invoiceIntegrity
  });
  const riskSnapshot = buildRiskAuditSnapshot({
    asOf: normalizedAsOf,
    cash: controlTower?.metrics?.cash?.value || '0',
    aging: null,
    parties,
    invoices,
    transactions,
    documents,
    integrity,
    invoiceIntegrity
  });

  const context = { entries, invoices, documents, controlTower };
  const controls = Object.freeze([
    ...legacyCloseControls(legacyClose.monthEnd, context),
    ...towerCloseControls(controlTower)
  ]);

  const blocked = controls.some(item => item.status === 'blocked');
  const attention = controls.length > 0;
  const closeStatus = blocked ? 'blocked' : attention ? 'attention' : 'ready';

  const exceptions = Object.freeze(sortExceptions([
    ...closeExceptions(controls),
    ...riskExceptions(riskSnapshot),
    ...journalDuplicateExceptions({ entries, lines })
  ]));

  const summary = Object.freeze({
    total: exceptions.length,
    critical: exceptions.filter(item => item.severity === 'critical').length,
    high: exceptions.filter(item => item.severity === 'high').length,
    medium: exceptions.filter(item => item.severity === 'medium').length,
    low: exceptions.filter(item => item.severity === 'low').length,
    closeControlsOpen: controls.length
  });

  return Object.freeze({
    architecture: 'avan-continuous-close-audit-foundation-v1',
    asOf: normalizedAsOf,
    close: Object.freeze({
      status: closeStatus,
      alreadyClosed: Boolean(legacyClose.monthEnd?.alreadyClosed),
      methodology: 'deterministic-controls-no-arbitrary-score',
      controls
    }),
    audit: Object.freeze({
      exceptions,
      summary,
      methodology: 'continuous-rules-and-integrity-controls'
    }),
    contracts: Object.freeze({
      sourceOfTruth: 'ledger-and-authoritative-subledgers',
      deterministic: true,
      noArbitraryScore: true,
      oneRialExact: true,
      aiGeneratedAmounts: false,
      humanControlled: true,
      actualLedgerMutation: false,
      writeOperations: 0
    })
  });
}
