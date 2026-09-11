import assert from 'node:assert/strict';
import fs from 'node:fs';
import { executeReportIntent } from '../src/reports/nl-report-executor.js';
import { naturalReportResultHtml } from '../src/ui/reports/nl-report-view.js';

const calls = [];
const rows = [
  {
    account_id: 'a100', account_code: '100', account_name: 'دارایی‌ها',
    parent_id: null, account_level: 1, is_postable: false,
    debit_turnover: '309398021.2', credit_turnover: '235315879.7', net: '74082141.5'
  },
  {
    account_id: 'a110', account_code: '110', account_name: 'وجوه نقد و بانک',
    parent_id: 'a100', account_level: 2, is_postable: false,
    debit_turnover: '124553748.2', credit_turnover: '226883413.0', net: '-102329664.8'
  },
  {
    account_id: 'a1101', account_code: '1101', account_name: 'صندوق',
    parent_id: 'a110', account_level: 3, is_postable: true,
    debit_turnover: '117949066.1', credit_turnover: '1039066.7', net: '116909999.4'
  },
  {
    account_id: 'a1102', account_code: '1102', account_name: 'بانک',
    parent_id: 'a110', account_level: 3, is_postable: true,
    debit_turnover: '6604682.1', credit_turnover: '225844346.3', net: '-219239664.2'
  }
];

const result = await executeReportIntent({
  intent: {
    intent: 'trial_balance', metric: null,
    period: { from: '2026-08-01', to: '2026-09-12' },
    read_only: true, allow_raw_sql: false
  },
  workspaceId: 'w1',
  rpc: async (name, params) => {
    calls.push({ name, params });
    return rows;
  }
});

assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'report_trial_balance_hierarchy');
assert.equal(result.source.name, 'report_trial_balance_hierarchy');
assert.equal(result.hierarchy_rollup, true);
assert.equal(result.one_rial_exact, true);
assert.equal(result.rows[1].account_code, '110');
assert.equal(result.rows[1].net, '-102329664.8');

const html = naturalReportResultHtml({
  payload: { result },
  money: value => String(value),
  dateFa: value => String(value),
  esc: value => String(value ?? '')
});

assert.match(html, /data-avan-account-hierarchy="1"/);
assert.match(html, /data-account-level="1"/);
assert.match(html, /data-account-level="2"/);
assert.match(html, /data-account-level="3"/);
assert.match(html, /padding-inline-start:0px/);
assert.match(html, /padding-inline-start:22px/);
assert.match(html, /padding-inline-start:44px/);
assert.ok(html.indexOf('100') < html.indexOf('110'));
assert.ok(html.indexOf('110') < html.indexOf('1101'));
assert.match(html, />کل</);
assert.match(html, />معین</);
assert.match(html, />تفصیلی</);

const sql = fs.readFileSync(
  new URL('../sql/APPLIED_RC17_TRIAL_BALANCE_HIERARCHY_ROLLUP.sql', import.meta.url),
  'utf8'
);
assert.match(sql, /with recursive/i);
assert.match(sql, /descendants/i);
assert.match(sql, /security invoker/i);
assert.match(sql, /has_workspace_access\(wid\)/);
assert.match(sql, /grant execute[\s\S]*to authenticated/i);
assert.doesNotMatch(sql, /security definer/i);

console.log('trial-balance-hierarchy.spec.mjs: PASS');
