'use strict';

import { canonicalDecimalToTenths, canonicalTenthsToDecimal } from '../core/money/canonical-money.js';

export const SMART_PROCUREMENT_SPEND_ARCHITECTURE = Object.freeze({
  id: 'avan-smart-procurement-spend-control-v1',
  methodology: 'deterministic-controls-no-arbitrary-score',
  writeOperations: 0,
  actualLedgerMutation: false,
  approvalMutation: false,
  paymentMutation: false,
  coverage: Object.freeze({ purchaseInvoice: true, inventoryReceipt: true, twoWayMatch: true, purchaseRequest: false, purchaseOrder: false, threeWayMatch: false, budget: false, approval: false, paymentExecution: false })
});

const rank = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });
const txt = value => String(value ?? '').trim();
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(txt(value).slice(0, 10)) ? txt(value).slice(0, 10) : null;
const idOf = value => txt(value);
function ref(type,id,label,meta=''){return Object.freeze({type,id:id||null,label:txt(label)||'مرجع خرید',meta:txt(meta)});}
function finding(id,severity,category,title,description,evidence=[]){return Object.freeze({id,severity,category,title,description,evidence:Object.freeze(evidence.filter(Boolean))});}
function sumExact(values){let total=0n;for(const value of values){const parsed=canonicalDecimalToTenths(value??'0');if(parsed===null)return null;total+=parsed;}return canonicalTenthsToDecimal(total);}
function exactDiff(current,previous){const a=canonicalDecimalToTenths(current??'0'),b=canonicalDecimalToTenths(previous??'0');return a===null||b===null?null:canonicalTenthsToDecimal(a-b);}
function exactEqual(a,b){const left=canonicalDecimalToTenths(a??'0'),right=canonicalDecimalToTenths(b??'0');return left!==null&&right!==null&&left===right;}
function percentChange(current,previous){const a=canonicalDecimalToTenths(current??'0'),b=canonicalDecimalToTenths(previous??'0');if(a===null||b===null||b===0n)return null;return Number(((a-b)*10000n)/(b<0n?-b:b))/100;}
function sharePercent(part,total){const p=canonicalDecimalToTenths(part??'0'),t=canonicalDecimalToTenths(total??'0');if(p===null||t===null||t<=0n)return 0;return Number((p*10000n)/t)/100;}
function quantity(value){const n=Number(value??0);return Number.isFinite(n)?n:0;}

export function buildSmartProcurementSpendControl(input={}){
  const asOf=iso(input.asOf);if(!asOf)throw new Error('PROCUREMENT_AS_OF_REQUIRED');
  const periodFrom=iso(input.periodFrom)||null;
  const purchaseInvoices=(input.invoices||[]).filter(r=>r?.invoice_type==='purchase').filter(r=>(!periodFrom||r.invoice_date>=periodFrom)&&r.invoice_date<=asOf);
  const purchaseInvoiceIds=new Set(purchaseInvoices.map(r=>idOf(r.id)).filter(Boolean));
  const purchaseLines=(input.invoiceLines||[]).filter(r=>purchaseInvoiceIds.has(idOf(r.invoice_id)));
  const parties=new Map((input.parties||[]).map(r=>[idOf(r.id),r]));
  const items=new Map((input.inventoryItems||[]).map(r=>[idOf(r.id),r]));
  const receiptDocs=(input.inventoryDocuments||[]).filter(r=>r?.document_type==='receipt'&&r?.status==='posted'&&(!periodFrom||r.document_date>=periodFrom)&&r.document_date<=asOf);
  const receiptDocIds=new Set(receiptDocs.map(r=>idOf(r.id)).filter(Boolean));
  const receiptLines=(input.inventoryDocumentLines||[]).filter(r=>receiptDocIds.has(idOf(r.inventory_document_id)));
  const receiptLineMap=new Map(receiptLines.map(r=>[idOf(r.id),r]));
  const receiptDocMap=new Map(receiptDocs.map(r=>[idOf(r.id),r]));
  const findings=[];
  const invoiceById=new Map(purchaseInvoices.map(r=>[idOf(r.id),r]));
  const postedInvoices=purchaseInvoices.filter(r=>r?.status==='posted'),draftInvoices=purchaseInvoices.filter(r=>r?.status==='draft');
  const postedInvoiceIds=new Set(postedInvoices.map(r=>idOf(r.id)));
  const postedSpendCanonical=sumExact(postedInvoices.map(r=>r.total_amount??'0')),draftSpendCanonical=sumExact(draftInvoices.map(r=>r.total_amount??'0'));
  if(postedSpendCanonical===null||draftSpendCanonical===null)findings.push(finding('money-precision','critical','money_integrity','جمع خرید با دقت یک ریال قابل محاسبه نیست','حداقل یک مبلغ خرید از قرارداد پولی دقیق آوان خارج است.'));

  const supplierKindsAllowed=new Set(['vendor','both']);
  const invalidSuppliers=purchaseInvoices.filter(r=>{const p=parties.get(idOf(r.party_id));return p&&!supplierKindsAllowed.has(txt(p.kind));});
  if(invalidSuppliers.length)findings.push(finding('supplier-kind-mismatch','high','supplier','نوع طرف‌حساب برخی خریدها با نقش تأمین‌کننده سازگار نیست',`${invalidSuppliers.length} فاکتور خرید به طرف‌حسابی متصل است که در اطلاعات پایه به‌عنوان تأمین‌کننده یا مشتری/تأمین‌کننده ثبت نشده است.`,invalidSuppliers.slice(0,12).map(r=>{const p=parties.get(idOf(r.party_id));return ref('invoice',r.id,`فاکتور خرید ${r.invoice_no||'پیش‌نویس'}`,`${p?.name||'طرف‌حساب'} · ${r.invoice_date||'—'}`);})));

  const postedItemWithoutReceipt=purchaseLines.filter(l=>postedInvoiceIds.has(idOf(l.invoice_id))&&l.item_id&&!l.receipt_line_id);
  if(postedItemWithoutReceipt.length)findings.push(finding('posted-item-without-receipt','high','receipt_match','خرید کالایی قطعی بدون رسید انبار مرتبط وجود دارد',`${postedItemWithoutReceipt.length} ردیف کالایی در فاکتور خرید قطعی به رسید انبار متصل نیست. این کنترل برای خدمات یا ردیف‌های غیرکالایی اعمال نمی‌شود.`,postedItemWithoutReceipt.slice(0,16).map(l=>{const inv=invoiceById.get(idOf(l.invoice_id)),item=items.get(idOf(l.item_id)),p=parties.get(idOf(inv?.party_id));return ref('invoice_line',l.id,`${item?.name||l.description||'قلم خرید'} · فاکتور ${inv?.invoice_no||'—'}`,`${p?.name||'تأمین‌کننده'} · ${inv?.invoice_date||'—'}`);})));

  const linksByReceipt=new Map();for(const l of purchaseLines){const rid=idOf(l.receipt_line_id);if(!rid)continue;const links=linksByReceipt.get(rid)||[];links.push(l);linksByReceipt.set(rid,links);}
  const multiReceiptLinks=[...linksByReceipt.entries()].filter(([,links])=>links.length>1);
  if(multiReceiptLinks.length){const multiplePosted=multiReceiptLinks.some(([,links])=>links.filter(l=>postedInvoiceIds.has(idOf(l.invoice_id))).length>1);findings.push(finding('receipt-reused',multiplePosted?'critical':'high','receipt_match','یک ردیف رسید انبار به بیش از یک ردیف فاکتور خرید متصل شده است',`${multiReceiptLinks.length} ردیف رسید بیش از یک بار در فاکتورهای خرید استفاده شده است. این وضعیت الزاماً به معنی ثبت تکراری نیست، اما پیش از قطعی‌کردن پیش‌نویس‌های مرتبط باید بررسی شود.`,multiReceiptLinks.slice(0,12).flatMap(([rid,links])=>{const rl=receiptLineMap.get(rid),rd=receiptDocMap.get(idOf(rl?.inventory_document_id)),item=items.get(idOf(rl?.item_id));return [ref('inventory_receipt_line',rid,`رسید انبار ${rd?.document_no||'—'} · ${item?.name||'قلم انبار'}`,`${rd?.document_date||'—'} · ${links.length} اتصال به فاکتور خرید`),...links.slice(0,4).map(l=>{const inv=invoiceById.get(idOf(l.invoice_id));return ref('invoice_line',l.id,`فاکتور خرید ${inv?.invoice_no||'پیش‌نویس'} · ردیف ${l.line_no||'—'}`,`${inv?.status==='posted'?'قطعی':'پیش‌نویس'} · ${inv?.invoice_date||'—'}`);})];}))));}

  const qtyMismatches=[],priceMismatches=[];for(const l of purchaseLines){const rl=receiptLineMap.get(idOf(l.receipt_line_id));if(!rl)continue;if(quantity(l.quantity)!==quantity(rl.quantity))qtyMismatches.push({line:l,receiptLine:rl});if(!exactEqual(l.unit_price,rl.unit_cost))priceMismatches.push({line:l,receiptLine:rl});}
  if(qtyMismatches.length)findings.push(finding('receipt-quantity-mismatch','medium','receipt_match','مقدار فاکتور خرید با رسید انبار یکسان نیست',`${qtyMismatches.length} ردیف دارای اختلاف مقدار بین فاکتور و رسید است. خرید مرحله‌ای یا صورتحساب جزئی ممکن است مجاز باشد؛ تصمیم نهایی با کاربر است.`,qtyMismatches.slice(0,12).map(({line:l,receiptLine:rl})=>{const inv=invoiceById.get(idOf(l.invoice_id)),rd=receiptDocMap.get(idOf(rl.inventory_document_id)),item=items.get(idOf(l.item_id||rl.item_id));return ref('two_way_match',l.id,`${item?.name||'قلم خرید'} · فاکتور ${inv?.invoice_no||'پیش‌نویس'}`,`فاکتور: ${l.quantity} · رسید ${rd?.document_no||'—'}: ${rl.quantity}`);})));
  if(priceMismatches.length)findings.push(finding('receipt-price-mismatch','medium','receipt_match','قیمت واحد فاکتور خرید با بهای واحد رسید انبار یکسان نیست',`${priceMismatches.length} ردیف دارای اختلاف قیمت واحد است. تخفیف، هزینه جانبی یا اصلاح بهای رسید می‌تواند علت معتبر داشته باشد و باید با شواهد بررسی شود.`,priceMismatches.slice(0,12).map(({line:l,receiptLine:rl})=>{const inv=invoiceById.get(idOf(l.invoice_id)),rd=receiptDocMap.get(idOf(rl.inventory_document_id)),item=items.get(idOf(l.item_id||rl.item_id));return ref('two_way_match',l.id,`${item?.name||'قلم خرید'} · فاکتور ${inv?.invoice_no||'پیش‌نویس'}`,`قیمت فاکتور: ${l.unit_price} · بهای رسید ${rd?.document_no||'—'}: ${rl.unit_cost}`);})));

  const receiptUsed=new Set([...linksByReceipt.keys()]),unlinkedReceipts=receiptLines.filter(l=>!receiptUsed.has(idOf(l.id)));
  if(unlinkedReceipts.length)findings.push(finding('receipt-awaiting-invoice','medium','receipt_match','رسید انبار بدون فاکتور خرید مرتبط وجود دارد',`${unlinkedReceipts.length} ردیف رسید انبار قطعی هنوز به ردیف فاکتور خرید متصل نشده است.`,unlinkedReceipts.slice(0,16).map(l=>{const rd=receiptDocMap.get(idOf(l.inventory_document_id)),item=items.get(idOf(l.item_id));return ref('inventory_receipt_line',l.id,`رسید انبار ${rd?.document_no||'—'} · ${item?.name||'قلم انبار'}`,`${rd?.document_date||'—'} · مقدار ${l.quantity}`);})));

  const supplierBuckets=new Map();for(const inv of postedInvoices){const key=idOf(inv.party_id)||'unknown',b=supplierBuckets.get(key)||{partyId:key,invoiceCount:0,values:[]};b.invoiceCount++;b.values.push(inv.total_amount??'0');supplierBuckets.set(key,b);}
  const supplierSpend=[...supplierBuckets.values()].map(b=>{const spendCanonical=sumExact(b.values),p=parties.get(b.partyId);return Object.freeze({partyId:b.partyId,partyName:p?.name||'تأمین‌کننده بدون نام',invoiceCount:b.invoiceCount,spendCanonical,sharePercent:spendCanonical===null||postedSpendCanonical===null?null:sharePercent(spendCanonical,postedSpendCanonical)});}).sort((a,b)=>{const l=canonicalDecimalToTenths(a.spendCanonical??'0')??0n,r=canonicalDecimalToTenths(b.spendCanonical??'0')??0n;return l===r?0:l>r?-1:1;});

  const postedItemLines=purchaseLines.filter(l=>postedInvoiceIds.has(idOf(l.invoice_id))&&l.item_id).map(l=>({line:l,invoice:invoiceById.get(idOf(l.invoice_id))})).filter(r=>r.invoice).sort((a,b)=>`${a.invoice.invoice_date||''}:${String(a.invoice.invoice_no||'').padStart(12,'0')}:${a.line.line_no||0}`.localeCompare(`${b.invoice.invoice_date||''}:${String(b.invoice.invoice_no||'').padStart(12,'0')}:${b.line.line_no||0}`));
  const previousByItem=new Map(),priceChanges=[];for(const row of postedItemLines){const itemId=idOf(row.line.item_id),prev=previousByItem.get(itemId);if(prev&&!exactEqual(row.line.unit_price,prev.line.unit_price)){const item=items.get(itemId),p=parties.get(idOf(row.invoice.party_id));priceChanges.push(Object.freeze({itemId,itemName:item?.name||row.line.description||'قلم خرید',supplierName:p?.name||'تأمین‌کننده',invoiceNo:row.invoice.invoice_no||null,invoiceDate:row.invoice.invoice_date,currentUnitPrice:row.line.unit_price,previousUnitPrice:prev.line.unit_price,deltaCanonical:exactDiff(row.line.unit_price,prev.line.unit_price),percentChange:percentChange(row.line.unit_price,prev.line.unit_price),previousInvoiceNo:prev.invoice.invoice_no||null,previousInvoiceDate:prev.invoice.invoice_date}));}previousByItem.set(itemId,row);}

  const onHandByItem=new Map();for(const row of input.inventoryOnHand||[]){const key=idOf(row.item_id);if(!key)continue;onHandByItem.set(key,(onHandByItem.get(key)||0)+quantity(row.quantity_on_hand));}
  const reorderCandidates=[...items.values()].filter(row=>row?.is_active!==false&&quantity(row.min_stock)>(onHandByItem.get(idOf(row.id))??0)).map(row=>{const onHand=onHandByItem.get(idOf(row.id))??0,minStock=quantity(row.min_stock);return Object.freeze({itemId:row.id,itemName:row.name||row.sku||'قلم موجودی',sku:row.sku||'',onHand,minStock,shortage:minStock-onHand});}).sort((a,b)=>b.shortage-a.shortage);
  const critical=findings.filter(r=>r.severity==='critical').length,high=findings.filter(r=>r.severity==='high').length,medium=findings.filter(r=>r.severity==='medium').length;
  return Object.freeze({architecture:SMART_PROCUREMENT_SPEND_ARCHITECTURE,asOf,periodFrom,readiness:critical?'blocked':(high||medium)?'attention':'ready',summary:Object.freeze({postedPurchaseInvoices:postedInvoices.length,draftPurchaseInvoices:draftInvoices.length,postedSpendCanonical,draftSpendCanonical,findings:findings.length,critical,high,medium,postedReceiptLines:receiptLines.length,unlinkedReceiptLines:unlinkedReceipts.length,reusedReceiptLines:multiReceiptLinks.length,reorderCandidates:reorderCandidates.length}),findings:Object.freeze(findings.sort((a,b)=>rank[b.severity]-rank[a.severity])),supplierSpend:Object.freeze(supplierSpend.slice(0,12)),priceChanges:Object.freeze(priceChanges.slice(-12).reverse()),reorderCandidates:Object.freeze(reorderCandidates.slice(0,20)),coverage:SMART_PROCUREMENT_SPEND_ARCHITECTURE.coverage,notices:Object.freeze(['این ماژول کنترل و تصمیم‌یار خرید است و هیچ درخواست خرید، سفارش خرید، فاکتور، پرداخت یا سند حسابداری را خودکار ایجاد نمی‌کند.','تطبیق فعلی بر فاکتور خرید و رسید انبار موجود در آوان استوار است؛ تا ایجاد مرجع معتبر سفارش خرید، تطبیق سه‌مرحله‌ای صادر نمی‌شود.','نبود منبع حقیقت بودجه و گردش تأیید به معنی نبود کنترل بودجه یا تأیید در نسخه فعلی است؛ سامانه این داده‌ها را حدس نمی‌زند.'])});
}
