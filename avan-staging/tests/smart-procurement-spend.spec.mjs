import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildSmartProcurementSpendControl, SMART_PROCUREMENT_SPEND_ARCHITECTURE } from '../src/intelligence/smart-procurement-spend-foundation.js';

const root=resolve(process.cwd());
const read=p=>readFileSync(join(root,p),'utf8');
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.methodology,'deterministic-controls-no-arbitrary-score');
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.writeOperations,0);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.actualLedgerMutation,false);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage.twoWayMatch,true);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage.threeWayMatch,false);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage.purchaseOrder,false);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage.budget,false);
assert.equal(SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage.approval,false);

const base={
  asOf:'2026-09-13',periodFrom:'2026-03-21',
  parties:[{id:'p1',name:'تأمین‌کننده یک',kind:'vendor'},{id:'p2',name:'تأمین‌کننده دو',kind:'both'}],
  inventoryItems:[{id:'i1',sku:'A1',name:'کالای یک',min_stock:'5',is_active:true},{id:'i2',sku:'A2',name:'کالای دو',min_stock:'0',is_active:true}],
  inventoryOnHand:[{item_id:'i1',warehouse_id:'w1',quantity_on_hand:'2'}],
  inventoryDocuments:[{id:'r1',document_no:10,document_type:'receipt',document_date:'2026-09-10',status:'posted'}],
  inventoryDocumentLines:[{id:'rl1',inventory_document_id:'r1',line_no:1,item_id:'i1',quantity:'10',unit_cost:'151.5'},{id:'rl2',inventory_document_id:'r1',line_no:2,item_id:'i2',quantity:'5',unit_cost:'20.0'}],
  invoices:[
    {id:'v1',invoice_no:1,invoice_type:'purchase',invoice_date:'2026-09-10',party_id:'p1',total_amount:'151.5',status:'posted'},
    {id:'v2',invoice_no:null,invoice_type:'purchase',invoice_date:'2026-09-11',party_id:'p1',total_amount:'0.1',status:'draft'},
    {id:'v3',invoice_no:2,invoice_type:'purchase',invoice_date:'2026-09-12',party_id:'p2',total_amount:'0.1',status:'posted'}
  ],
  invoiceLines:[
    {id:'l1',invoice_id:'v1',line_no:1,item_id:'i1',quantity:'10',unit_price:'151.5',receipt_line_id:'rl1'},
    {id:'l2',invoice_id:'v2',line_no:1,item_id:'i1',quantity:'1',unit_price:'151.5',receipt_line_id:'rl1'},
    {id:'l3',invoice_id:'v3',line_no:1,item_id:'i2',quantity:'1',unit_price:'0.1',receipt_line_id:null}
  ]
};
const result=buildSmartProcurementSpendControl(base);
assert.equal(result.summary.postedSpendCanonical,'151.6','Purchase totals must preserve one-Rial precision.');
assert.equal(result.summary.draftSpendCanonical,'0.1');
assert.equal(result.readiness,'attention');
assert.ok(result.findings.some(x=>x.id==='receipt-reused'&&x.severity==='high'));
assert.ok(result.findings.some(x=>x.id==='receipt-quantity-mismatch'));
assert.ok(result.findings.some(x=>x.id==='posted-item-without-receipt'));
assert.ok(result.findings.some(x=>x.id==='receipt-awaiting-invoice'));
assert.equal(result.reorderCandidates[0].itemName,'کالای یک');
assert.equal(result.reorderCandidates[0].shortage,3);
assert.ok(result.notices.every(x=>!x.includes('Source of Truth')));

const price=buildSmartProcurementSpendControl({...base,inventoryDocuments:[...base.inventoryDocuments,{id:'r2',document_no:11,document_type:'receipt',document_date:'2026-09-12',status:'posted'}],inventoryDocumentLines:[...base.inventoryDocumentLines,{id:'rl3',inventory_document_id:'r2',line_no:1,item_id:'i1',quantity:'1',unit_cost:'151.6'}],invoices:[...base.invoices,{id:'v4',invoice_no:3,invoice_type:'purchase',invoice_date:'2026-09-12',party_id:'p1',total_amount:'151.6',status:'posted'}],invoiceLines:[...base.invoiceLines,{id:'l4',invoice_id:'v4',line_no:1,item_id:'i1',quantity:'1',unit_price:'151.6',receipt_line_id:'rl3'}]});
assert.ok(price.priceChanges.some(x=>x.itemId==='i1'&&x.deltaCanonical==='0.1'));

const service=read('src/application/intelligence/smart-procurement-spend-service.js');
for(const table of ['fiscal_years','inventory_items','inventory_on_hand','invoices','invoice_lines','parties','inventory_documents','inventory_document_lines'])assert.ok(service.includes(`'${table}'`),`Service must read ${table}.`);
assert.ok(service.includes('&workspace_id=eq.${wid}'));
assert.ok(!service.includes('.insert('));assert.ok(!service.includes('.update('));assert.ok(!service.includes('.delete('));assert.ok(!service.includes('cloud.rpc('));

const view=read('src/ui/intelligence/smart-procurement-spend-view.js');
for(const text of ['کنترل هوشمند خرید و مخارج','کنترل‌های خرید و تطبیق','تمرکز خرید نزد تأمین‌کنندگان','تغییر قیمت خرید','اقلام زیر حداقل موجودی','دامنه پوشش فرآیند خرید'])assert.ok(view.includes(text));
for(const forbidden of ['Smart Procurement','Source of Truth','2-way','3-way'])assert.ok(!view.includes(forbidden),`User-facing English must not leak: ${forbidden}`);
assert.ok(view.includes('در نسخه فعلی پوشش داده نمی‌شود'));
assert.ok(!view.includes('${r.id}'),'Raw evidence IDs must not render as labels.');
const workspace=read('src/ui/intelligence/smart-procurement-spend-workspace.js');
assert.ok(workspace.includes("import './intelligence-print-export.js';"));
assert.ok(workspace.includes('avan:smart-procurement-rendered'));
assert.ok(workspace.includes('data-smart-procurement-nav'));

const print=read('src/ui/intelligence/intelligence-print-export.js');
assert.ok(print.includes("'کنترل هوشمند خرید و مخارج'"));
assert.ok(print.includes('.avan-procurement-date-form'));
const index=read('index.html');assert.ok(index.includes('module7-procurement-spend-control.css'));assert.ok(index.includes('src/ui/intelligence/smart-procurement-spend-workspace.js'));
const sw=read('sw.js');assert.ok(sw.includes('avan-staging-rc1-v119-smart-procurement-spend-control'));assert.ok(sw.includes('./src/intelligence/smart-procurement-spend-foundation.js'));assert.ok(sw.includes('./src/ui/intelligence/smart-procurement-spend-view.js'));
console.log('Smart Procurement & Spend Control foundation PASS');
