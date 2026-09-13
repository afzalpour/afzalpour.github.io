import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVAN_CONNECT_ARCHITECTURE, AVAN_CONNECT_EXECUTION_CONTRACT } from '../src/intelligence/avan-connect-contract.js';
import { AVAN_CONNECT_CATALOG } from '../src/intelligence/avan-connect-catalog.js';
import { AVAN_AUTOMATION_RECIPES, buildAvanConnectMarketplace, buildAutomationPreview } from '../src/intelligence/avan-connect-foundation.js';
import { avanConnectPageHtml } from '../src/ui/intelligence/avan-connect-view.js';
await import('../src/application/intelligence/avan-connect-service.js');
await import('../src/ui/intelligence/avan-connect-interactions.js');
await import('../src/ui/intelligence/avan-connect-workspace.js');

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const stagingRoot=path.resolve(testsDir,'..');
const read=(...parts)=>fs.readFileSync(path.join(stagingRoot,...parts),'utf8');

assert.equal(AVAN_CONNECT_ARCHITECTURE.writeOperations,0);
assert.equal(AVAN_CONNECT_ARCHITECTURE.actualLedgerMutation,false);
assert.equal(AVAN_CONNECT_ARCHITECTURE.workflowExecution,false);
assert.equal(AVAN_CONNECT_ARCHITECTURE.humanApprovalDefault,true);
assert.equal(AVAN_CONNECT_ARCHITECTURE.idempotencyRequired,true);
assert.equal(AVAN_CONNECT_EXECUTION_CONTRACT.idempotency.generatedServerSide,true);
assert.equal(AVAN_CONNECT_EXECUTION_CONTRACT.audit.appendOnlyExecutionEvents,true);
assert.equal(AVAN_CONNECT_EXECUTION_CONTRACT.approval.payment,'required');

const states=Object.fromEntries(AVAN_CONNECT_CATALOG.map(row=>[row.key,row.state]));
assert.equal(states.bank_statement_csv,'available');
assert.equal(states.smart_document_extract,'available');
assert.equal(states.einvoice_preflight,'limited');
assert.equal(states.pos_connector,'not_connected');
assert.equal(states.store_connector,'not_connected');
assert.equal(states.generic_connector,'not_connected');

const workspace={id:'00000000-0000-0000-0000-000000000001',name:'شرکت آزمایشی'};
const marketplace=buildAvanConnectMarketplace({workspace});
assert.equal(marketplace.summary.available,2);
assert.equal(marketplace.summary.limited,1);
assert.equal(marketplace.summary.notConnected,3);
assert.equal(marketplace.summary.previewableWorkflows,3);

for(const recipe of AVAN_AUTOMATION_RECIPES){
  const preview=buildAutomationPreview({workspace,recipeKey:recipe.key});
  assert.equal(preview.willExecute,false);
  assert.equal(preview.writeOperations,0);
  assert.equal(preview.requiresHumanApproval,true);
  assert.ok(preview.safeguards.length>=3);
}

const html=avanConnectPageHtml({workspace,marketplace});
assert.ok(html.includes('مرکز اتصال‌ها و اتوماسیون'));
assert.ok(html.includes('بازارچه اتصال‌ها'));
assert.ok(html.includes('قواعد اجرای امن'));
assert.ok(html.includes('چاپ / ذخیره PDF'));
assert.ok(html.includes('data-avan-connect-layout'));
assert.ok(html.includes('avan-connect-guardrails'));
assert.ok(html.includes('avan-connect-guardrail'));
assert.ok(html.includes('overflow-wrap:anywhere'));
assert.ok(html.includes('flex-wrap:wrap'));
assert.ok(html.includes('grid-template-columns:minmax(0,1fr)'));
const visible=html.replace(/<[^>]+>/g,' ');
for(const leaked of ['Snapshot','Foundation','Source of Truth','available','limited','not_connected'])assert.ok(!visible.includes(leaked),`user-facing English leakage: ${leaked}`);

const workspaceSource=read('src','ui','intelligence','avan-connect-workspace.js');
const interactions=read('src','ui','intelligence','avan-connect-interactions.js');
assert.ok(!workspaceSource.includes('.insert('));
assert.ok(!workspaceSource.includes('.update('));
assert.ok(!workspaceSource.includes('.rpc('));
assert.ok(!interactions.includes('.insert('));
assert.ok(!interactions.includes('.update('));

const index=read('index.html');
const sw=read('sw.js');
assert.ok(index.includes('src/ui/intelligence/avan-connect-workspace.js'));
for(const asset of ['src/intelligence/avan-connect-contract.js','src/intelligence/avan-connect-catalog.js','src/intelligence/avan-connect-foundation.js','src/application/intelligence/avan-connect-service.js','src/ui/intelligence/avan-connect-view.js','src/ui/intelligence/avan-connect-interactions.js','src/ui/intelligence/avan-connect-workspace.js'])assert.ok(sw.includes(`./${asset}`),`missing Module 9 precache asset ${asset}`);
const cacheVersion=Number(sw.match(/avan-staging-rc1-v(\d+)-/)?.[1]||0);
assert.ok(cacheVersion>=121,'Module 9 Live layout correction must advance Staging cache identity to v121 or newer.');

console.log('Avan Connect / Automation Marketplace foundation PASS');
