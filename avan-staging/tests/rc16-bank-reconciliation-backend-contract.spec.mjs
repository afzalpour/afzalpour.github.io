import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation = readFileSync(new URL('../APPLIED_RC1_6_A_BANK_RECONCILIATION.sql', import.meta.url), 'utf8');
const compat = readFileSync(new URL('../APPLIED_RC1_6_A_BANK_RECONCILIATION_COMPAT.sql', import.meta.url), 'utf8');
const allSql = `${foundation}\n${compat}`;
const executableSql = allSql.replace(/^\s*--.*$/gm, '');

function expect(pattern, source, message) {
  assert.match(source, pattern, message);
}

for (const table of ['bank_statement_imports', 'bank_statement_lines', 'bank_reconciliation_matches']) {
  expect(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i'), foundation, `${table} table must exist`);
  expect(new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'), foundation, `${table} must have RLS enabled`);
  expect(new RegExp(`create\\s+policy\\s+${table}_select[\\s\\S]*?for\\s+select\\s+to\\s+authenticated[\\s\\S]*?has_workspace_access\\(workspace_id\\)`, 'i'), foundation, `${table} SELECT must be Company-scoped`);
  expect(new RegExp(`create\\s+policy\\s+${table}_insert[\\s\\S]*?for\\s+insert\\s+to\\s+authenticated[\\s\\S]*?workspace_role\\(workspace_id\\)[\\s\\S]*?owner[\\s\\S]*?manager[\\s\\S]*?accountant`, 'i'), foundation, `${table} INSERT must require a financial-write role`);
  expect(new RegExp(`create\\s+policy\\s+${table}_update[\\s\\S]*?for\\s+update\\s+to\\s+authenticated[\\s\\S]*?workspace_role\\(workspace_id\\)`, 'i'), foundation, `${table} UPDATE must require a financial-write role`);
}

// One-Rial precision remains canonical across statement balances and lines.
expect(/opening_balance\s+numeric\(20,1\)/i, foundation, 'opening balance must preserve one-Rial precision');
expect(/closing_balance\s+numeric\(20,1\)/i, foundation, 'closing balance must preserve one-Rial precision');
expect(/amount\s+numeric\(20,1\)\s+not\s+null\s+check\s*\(amount\s*>\s*0\)/i, foundation, 'statement amount must be positive numeric(20,1)');
expect(/balance_after\s+numeric\(20,1\)/i, foundation, 'running balance must preserve one-Rial precision');

// Tenant-safe parent references and active-match uniqueness are mandatory.
expect(/foreign\s+key\s*\(workspace_id,\s*financial_account_id\)[\s\S]*?financial_accounts\s*\(workspace_id,\s*id\)/i, foundation, 'statement import must bind the bank account inside the same workspace');
expect(/foreign\s+key\s*\(workspace_id,\s*financial_transaction_id\)[\s\S]*?financial_transactions\s*\(workspace_id,\s*id\)/i, foundation, 'match must bind the transaction inside the same workspace');
expect(/bank_reconciliation_active_line_uidx[\s\S]*?where\s+voided_at\s+is\s+null/i, foundation, 'one active match per statement line is required');
expect(/bank_reconciliation_active_tx_account_uidx[\s\S]*?where\s+voided_at\s+is\s+null/i, foundation, 'one active match per bank transaction/account is required');

// Finalization is blocked until evidence is resolved and the bank balance equation is exact.
expect(/BANK_RECONCILIATION_UNRESOLVED_LINES/, foundation, 'unresolved lines must block finalization');
expect(/BANK_STATEMENT_BALANCE_MISMATCH/, foundation, 'closing-balance mismatch must block finalization');
expect(/BANK_STATEMENT_LINE_EVIDENCE_IMMUTABLE/, foundation, 'bank statement evidence must be immutable');
expect(/BANK_RECONCILIATION_MATCH_UPDATE_REQUIRES_VOID/, foundation, 'match changes must use void lifecycle');
expect(/BANK_RECONCILIATION_VOID_REASON_REQUIRED/, foundation, 'void must retain a reason');
assert.doesNotMatch(foundation, /create\s+policy\s+\w+\s+on\s+public\.(?:bank_statement_imports|bank_statement_lines|bank_reconciliation_matches)[\s\S]{0,160}?for\s+delete\b/i, 'reconciliation evidence must not expose a DELETE policy');

// Live-schema compatibility: reference is additive; historical tx_no must not appear in executable SQL.
expect(/alter\s+table\s+public\.financial_transactions[\s\S]*?add\s+column\s+if\s+not\s+exists\s+reference\s+text/i, compat, 'financial transaction reference column must be additive and nullable');
assert.doesNotMatch(executableSql, /\btx_no\b/i, 'RC1.6 migrations must not depend on nonexistent financial_transactions.tx_no');

// Candidate RPC must remain read-only, SECURITY INVOKER and Company-scoped.
const rpcMatch = compat.match(/create\s+or\s+replace\s+function\s+public\.avan_bank_reconciliation_candidates[\s\S]*?\$\$;/i);
assert.ok(rpcMatch, 'candidate RPC definition must exist in compatibility migration');
const rpc = rpcMatch[0];
expect(/security\s+invoker/i, rpc, 'candidate RPC must be SECURITY INVOKER');
expect(/has_workspace_access\(wid\)/i, rpc, 'candidate RPC must check workspace access');
expect(/fa\.kind\s*=\s*'bank'/i, rpc, 'candidate RPC must only use bank financial accounts');
expect(/t\.workspace_id\s*=\s*l\.workspace_id/i, rpc, 'candidate RPC must remain inside one workspace');
expect(/t\.status\s*=\s*'posted'/i, rpc, 'candidate RPC must only consider Posted transactions');
expect(/t\.tx_type\s+in\s*\('receipt','payment','transfer'\)/i, rpc, 'candidate RPC must exclude opening_balance and other transaction types');
expect(/t\.amount\s*=\s*l\.amount/i, rpc, 'candidate RPC must require exact amount equality');
expect(/l\.direction\s*=\s*'credit'[\s\S]*?t\.to_account_id\s*=\s*l\.ledger_account_id/i, rpc, 'credit candidates must hit the bank side correctly');
expect(/l\.direction\s*=\s*'debit'[\s\S]*?t\.from_account_id\s*=\s*l\.ledger_account_id/i, rpc, 'debit candidates must hit the bank side correctly');
assert.doesNotMatch(rpc, /\b(?:insert|update|delete|merge|truncate)\b/i, 'candidate RPC must never perform financial DML');
expect(/revoke\s+all\s+on\s+function\s+public\.avan_bank_reconciliation_candidates\(uuid,uuid,integer\)[\s\S]*?from\s+public,\s*anon/i, compat, 'candidate RPC must be revoked from public/anon');
expect(/grant\s+execute\s+on\s+function\s+public\.avan_bank_reconciliation_candidates\(uuid,uuid,integer\)[\s\S]*?to\s+authenticated/i, compat, 'candidate RPC must only be exposed to authenticated users');

console.log('RC1.6 bank reconciliation backend contract: PASS');
