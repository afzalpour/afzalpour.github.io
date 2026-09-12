import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFinancialDigitalTwinService } from '../src/application/intelligence/financial-digital-twin-service.js';

const loadCalls = [];
const controlTowerService = {
  async load({ asOf }) {
    loadCalls.push(asOf);
    return {
      workspace: { id: 'w1', name: 'شرکت تست', role: 'owner' },
      snapshot: {
        metrics: {
          cash: {
            value: '1000.1',
            label: 'موقعیت نقد و بانک',
            explanation: 'از دفترکل واقعی',
            evidence: [
              { type: 'financial_account', id: 'fa1' },
              { type: 'journal_entry', id: 'j1' }
            ]
          }
        }
      }
    };
  }
};

const service = createFinancialDigitalTwinService({ controlTowerService });
const prepared = await service.prepare({ from: '2026-09-11', to: '2026-10-11' });
assert.deepEqual(loadCalls, ['2026-09-10'], 'opening cash must come from the actual ledger through end of prior day');
assert.equal(prepared.opening.cash, '1000.1');
assert.equal(prepared.contracts.writeOperations, 0);
assert.equal(prepared.contracts.futureFlowsAreUserInputs, true);

const evaluated = service.run({
  prepared,
  baseline: {
    revenue: '500.1',
    collections: '200',
    operatingCosts: '300.1',
    payments: '100'
  },
  assumptions: {
    revenueChangeBps: 1000,
    collectionChangeBps: -5000,
    operatingCostChangeBps: 500,
    paymentChangeBps: 0,
    oneOffCashImpact: '-50.1'
  }
});

assert.equal(evaluated.scenario.base.openingCash, '1000.1');
assert.equal(evaluated.scenario.base.endingCash, '1300.1');
assert.equal(evaluated.scenario.scenario.endingCash, '1185');
assert.equal(evaluated.scenario.scenario.deltaEndingCash, '-115.1');
assert.equal(evaluated.contracts.actualLedgerMutation, false);
assert.equal(evaluated.contracts.scenarioPersistence, false);
assert.equal(evaluated.contracts.aiGeneratedAmounts, false);
assert.ok(evaluated.scenario.provenance.openingCash.some(ref => ref.type === 'journal_entry' && ref.id === 'j1'));
assert.deepEqual(evaluated.scenario.provenance.revenue, [{ type: 'user_input', id: 'baseline.cash_sales' }]);

await assert.rejects(
  () => service.prepare({ from: '2026-10-12', to: '2026-10-11' }),
  /DIGITAL_TWIN_HORIZON_INVALID/
);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/intelligence/financial-digital-twin-workspace.js');
const moneyInputs = read('src/ui/money/money-inputs.js');
const css = read('rc17-financial-digital-twin.css');
const index = read('index.html');
const sw = read('sw.js');

assert.match(ui, /دوقلوی مالی کسب‌وکار/);
assert.match(ui, /فروش نقدی جدید/,
  'cash sales must be distinguished from accrual sales to avoid double-counting with collections');
assert.match(ui, /فروش نسیه در این فیلد وارد نمی‌شود/);
assert.match(ui, /وصول مطالبات/);
assert.match(ui, /هزینه‌های نقدی عملیاتی/);
assert.match(ui, /پرداخت بدهی‌ها/);
assert.match(ui, /منشأ این عدد/);
assert.match(ui, /سند حسابداری شماره/,
  'Digital Twin opening evidence must render accounting-facing journal labels');
assert.match(ui, /کد حساب/,
  'Digital Twin opening evidence must render the ledger account code/name instead of a technical id');
assert.match(ui, /financial_accounts/);
assert.match(ui, /journal_entries/);
assert.match(ui, /workspace_id=eq\.\$\{workspaceId\}/,
  'readable evidence lookups must remain explicitly Company-scoped');
assert.doesNotMatch(ui, /<code>\$\{esc\(id\)\}<\/code>/,
  'raw technical evidence ids must never be rendered in the Digital Twin evidence modal');
assert.match(ui, /هیچ سند حسابداری، دریافت، پرداخت یا مانده واقعی/);
assert.match(ui, /Math\.round\(number \* 100\)/,
  'percentage inputs must be converted explicitly to basis points');
assert.match(ui, /MoneyRuntime\?\.parseInput/,
  'money inputs must use the central Money Runtime');

assert.match(moneyInputs, /\[data-digital-twin-form\]/,
  'Digital Twin editable numbers must be enhanced through the central money-input lifecycle');
for (const name of [
  'revenue', 'collections', 'operatingCosts', 'payments',
  'revenueChange', 'collectionChange', 'operatingCostChange', 'paymentChange',
  'oneOffCashImpact'
]) {
  assert.match(moneyInputs, new RegExp(`['"]${name}['"]`),
    `Digital Twin input ${name} must receive live three-digit grouping`);
}
assert.match(moneyInputs, /signed-decimal/,
  'Digital Twin grouping must preserve signed decimal values');
assert.match(moneyInputs, /startsWith\('-'\)/,
  'negative percentage and one-off scenario inputs must retain their sign');
assert.match(moneyInputs, /replace\(\/\\B\(\?=\(\\d\{3\}\)\+\(\?!\\d\)\)\/g, '٬'\)/,
  'Digital Twin numeric inputs must use the Persian thousands separator');

assert.doesNotMatch(ui, /localStorage|sessionStorage/,
  'scenario UI must not persist financial scenario data in browser storage');
assert.doesNotMatch(ui, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
  'scenario UI must not expose a write path');
assert.match(css, /\.avan-twin-contract-badges\{display:none!important\}/,
  'redundant precision/ledger/user-assumption badges must not be shown');
assert.match(css, /@media\(max-width:760px\)/,
  'Digital Twin workspace must remain responsive on mobile');
assert.match(css, /avan-twin-table th,\.avan-twin-table td\{text-align:center!important/);
assert.match(css, /avan-twin-evidence-human-row/,
  'readable opening evidence must use accounting-facing evidence rows');
assert.match(index, /rc17-financial-digital-twin\.css/);
assert.match(index, /src\/ui\/intelligence\/financial-digital-twin-workspace\.js/);
assert.match(sw, /rc17-financial-digital-twin\.css/);
assert.match(sw, /src\/application\/intelligence\/financial-digital-twin-service\.js/);
assert.match(sw, /src\/ui\/intelligence\/financial-digital-twin-workspace\.js/);
assert.match(sw, /avan-staging-rc1-v\d+-[a-z0-9-]+/,
  'PWA cache may advance while Digital Twin assets remain precached');

console.log('financial-digital-twin-ui.spec.mjs: PASS');
