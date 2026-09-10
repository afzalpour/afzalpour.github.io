'use strict';

function required(value, code) {
  const out = String(value ?? '').trim();
  if (!out) throw new Error(code);
  return out;
}

function safeIdList(rows = []) {
  return rows.map(row => String(row?.id || '')).filter(Boolean);
}

export function createBankReconciliationService(client) {
  if (!client?.select || !client?.insert || !client?.update || !client?.rpc) {
    throw new Error('BANK_RECONCILIATION_CLIENT_REQUIRED');
  }

  async function listBankAccounts(workspaceId) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    return client.select('financial_accounts', `select=id,workspace_id,ledger_account_id,kind,is_active&workspace_id=eq.${wid}&kind=eq.bank&is_active=eq.true&order=created_at.asc`);
  }

  async function listImports(workspaceId, financialAccountId) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const accountId = required(financialAccountId, 'BANK_ACCOUNT_REQUIRED');
    return client.select('bank_statement_imports', `select=*&workspace_id=eq.${wid}&financial_account_id=eq.${accountId}&order=created_at.desc&limit=100`);
  }

  async function importStatement({ workspaceId, financialAccountId, fileName, fileSha256, statementFrom = null, statementTo = null, openingBalance = null, closingBalance = null, rows = [] } = {}) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const accountId = required(financialAccountId, 'BANK_ACCOUNT_REQUIRED');
    if (!Array.isArray(rows) || !rows.length) throw new Error('BANK_STATEMENT_ROWS_REQUIRED');
    return client.rpc('avan_import_bank_statement', {
      wid,
      p_financial_account_id: accountId,
      p_file_name: required(fileName, 'BANK_STATEMENT_FILE_NAME_REQUIRED'),
      p_file_sha256: required(fileSha256, 'BANK_STATEMENT_FILE_HASH_REQUIRED'),
      p_statement_from: statementFrom,
      p_statement_to: statementTo,
      p_opening_balance: openingBalance,
      p_closing_balance: closingBalance,
      p_rows: rows
    });
  }

  async function listLines(workspaceId, importId) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const iid = required(importId, 'BANK_STATEMENT_IMPORT_REQUIRED');
    return client.select('bank_statement_lines', `select=*&workspace_id=eq.${wid}&import_id=eq.${iid}&order=line_no.asc`);
  }

  async function listMatches(workspaceId, financialAccountId) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const accountId = required(financialAccountId, 'BANK_ACCOUNT_REQUIRED');
    return client.select('bank_reconciliation_matches', `select=*&workspace_id=eq.${wid}&financial_account_id=eq.${accountId}&order=confirmed_at.desc&limit=5000`);
  }

  async function candidates(workspaceId, statementLineId, dateWindow = 3) {
    return client.rpc('avan_bank_reconciliation_candidates', {
      wid: required(workspaceId, 'WORKSPACE_REQUIRED'),
      p_statement_line_id: required(statementLineId, 'BANK_STATEMENT_LINE_REQUIRED'),
      p_date_window: Math.max(0, Math.min(30, Number(dateWindow) || 0))
    });
  }

  async function confirmMatch({ workspaceId, financialAccountId, statementLineId, candidate } = {}) {
    const reasonCodes = Array.isArray(candidate?.reason_codes) ? candidate.reason_codes : [];
    const method = reasonCodes.includes('EXACT_REFERENCE') ? 'reference'
      : reasonCodes.includes('SAME_DAY') ? 'exact'
      : 'date_amount';
    const rows = await client.insert('bank_reconciliation_matches', {
      workspace_id: required(workspaceId, 'WORKSPACE_REQUIRED'),
      financial_account_id: required(financialAccountId, 'BANK_ACCOUNT_REQUIRED'),
      statement_line_id: required(statementLineId, 'BANK_STATEMENT_LINE_REQUIRED'),
      financial_transaction_id: required(candidate?.transaction_id, 'FINANCIAL_TRANSACTION_REQUIRED'),
      match_method: method,
      score: Number(candidate?.score || 0),
      reason_codes: reasonCodes
    });
    return rows?.[0] || null;
  }

  async function voidMatch(workspaceId, matchId, reason) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const id = required(matchId, 'BANK_RECONCILIATION_MATCH_REQUIRED');
    const why = required(reason, 'BANK_RECONCILIATION_VOID_REASON_REQUIRED');
    const rows = await client.update('bank_reconciliation_matches', {
      voided_at: new Date().toISOString(),
      void_reason: why
    }, `id=eq.${id}&workspace_id=eq.${wid}`);
    return rows?.[0] || null;
  }

  async function ignoreLine(workspaceId, lineId, reason) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const id = required(lineId, 'BANK_STATEMENT_LINE_REQUIRED');
    const why = required(reason, 'BANK_STATEMENT_IGNORE_REASON_REQUIRED');
    const rows = await client.update('bank_statement_lines', {
      ignored_at: new Date().toISOString(),
      ignore_reason: why
    }, `id=eq.${id}&workspace_id=eq.${wid}`);
    return rows?.[0] || null;
  }

  async function finalizeImport(workspaceId, importId) {
    const wid = required(workspaceId, 'WORKSPACE_REQUIRED');
    const iid = required(importId, 'BANK_STATEMENT_IMPORT_REQUIRED');
    const rows = await client.update('bank_statement_imports', { status: 'finalized' }, `id=eq.${iid}&workspace_id=eq.${wid}`);
    return rows?.[0] || null;
  }

  function activeMatchesForLines(matches = [], lines = []) {
    const lineIds = new Set(safeIdList(lines));
    return new Map(matches
      .filter(match => !match.voided_at && lineIds.has(String(match.statement_line_id)))
      .map(match => [String(match.statement_line_id), match]));
  }

  return Object.freeze({
    listBankAccounts,
    listImports,
    importStatement,
    listLines,
    listMatches,
    candidates,
    confirmMatch,
    voidMatch,
    ignoreLine,
    finalizeImport,
    activeMatchesForLines
  });
}
