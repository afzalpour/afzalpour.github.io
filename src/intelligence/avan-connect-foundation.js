'use strict';

import { AVAN_CONNECT_ARCHITECTURE, AVAN_CONNECT_EXECUTION_CONTRACT } from './avan-connect-contract.js';
import { AVAN_CONNECT_CATALOG } from './avan-connect-catalog.js';

const recipe=(key,title,connectorKey,state,steps,note)=>Object.freeze({
  key,title,connectorKey,state,note,
  steps:Object.freeze(steps.map((label,index)=>Object.freeze({order:index+1,label}))),
  contract:Object.freeze({previewOnly:true,willExecute:false,writeOperations:0,requiresHumanApproval:true,idempotencyRequired:true,auditTrailRequired:true})
});

export const AVAN_AUTOMATION_RECIPES=Object.freeze([
  recipe('bank_statement_review','صورت‌حساب بانکی تا تطبیق کنترل‌شده','bank_statement_csv','available',['انتخاب فایل توسط کاربر','پیش‌نمایش و کنترل ساختار','تطبیق پیشنهادی','بازبینی کاربر','تأیید نهایی کاربر'],'هیچ سند حسابداری یا پرداختی بدون اقدام صریح کاربر ایجاد نمی‌شود.'),
  recipe('document_review','سند هوشمند تا بازبینی مالی','smart_document_extract','available',['انتخاب سند توسط کاربر','استخراج اطلاعات','نمایش پیشنهاد','بازبینی و اصلاح کاربر','ادامه به ثبت فقط با اقدام صریح کاربر'],'نتیجه استخراج به‌تنهایی سند حسابداری نیست.'),
  recipe('einvoice_preflight','فاکتور فروش تا کنترل صورتحساب الکترونیکی','einvoice_preflight','limited',['انتخاب فاکتور','ساخت مدل صورتحساب','کنترل قواعد و داده‌ها','نمایش خطاها و هشدارها','توقف پیش از ارسال واقعی'],'ارسال به سرویس بیرونی در نسخه فعلی فعال نیست.'),
  recipe('pos_sales_ingest','دریافت فروش از پایانه فروش','pos_connector','not_connected',['ایجاد اتصال معتبر','دریافت رویداد فروش','کنترل تکراری‌نبودن','پیش‌نمایش اثر مالی','تأیید کاربر'],'تا اتصال معتبر ایجاد نشود این فرایند اجرا نمی‌شود.'),
  recipe('store_sales_ingest','دریافت فروش از فروشگاه اینترنتی','store_connector','not_connected',['ایجاد اتصال معتبر','دریافت سفارش یا فروش','کنترل تکراری‌نبودن','نگاشت به داده آوان','تأیید کاربر'],'تا منبع معتبر و نگاشت صریح وجود نداشته باشد داده مالی ساخته نمی‌شود.')
]);

const byConnector=key=>AVAN_CONNECT_CATALOG.find(row=>row.key===key)||null;
const byRecipe=key=>AVAN_AUTOMATION_RECIPES.find(row=>row.key===key)||null;

export function buildAvanConnectMarketplace({workspace}={}){
  if(!workspace?.id)throw new Error('CONNECT_WORKSPACE_REQUIRED');
  const count=state=>AVAN_CONNECT_CATALOG.filter(row=>row.state===state).length;
  return Object.freeze({
    architecture:AVAN_CONNECT_ARCHITECTURE,
    workspace:Object.freeze({id:workspace.id,name:String(workspace.name||'شرکت')}),
    connectors:AVAN_CONNECT_CATALOG,
    recipes:AVAN_AUTOMATION_RECIPES,
    executionContract:AVAN_CONNECT_EXECUTION_CONTRACT,
    summary:Object.freeze({available:count('available'),limited:count('limited'),notConnected:count('not_connected'),previewableWorkflows:AVAN_AUTOMATION_RECIPES.filter(row=>row.state!=='not_connected').length})
  });
}

export function buildAutomationPreview({workspace,recipeKey}={}){
  if(!workspace?.id)throw new Error('CONNECT_WORKSPACE_REQUIRED');
  const selected=byRecipe(recipeKey);
  if(!selected)throw new Error('CONNECT_RECIPE_NOT_FOUND');
  return Object.freeze({
    workspace:Object.freeze({id:workspace.id,name:String(workspace.name||'شرکت')}),
    recipe:selected,
    connector:byConnector(selected.connectorKey),
    executableNow:false,
    willExecute:false,
    writeOperations:0,
    requiresHumanApproval:true,
    explanation:selected.state==='not_connected'?'این فرایند فقط برای نمایش معماری آماده است و تا ایجاد اتصال معتبر اجرا نمی‌شود.':'این پیش‌نمایش فقط مراحل را نشان می‌دهد و هیچ داده مالی یا درخواست بیرونی ایجاد نمی‌کند.',
    safeguards:Object.freeze(['جلوگیری از اجرای تکراری در مرز اجرای واقعی الزامی است.','هر اجرای واقعی باید سابقه حسابرسی قابل ردیابی داشته باشد.','ثبت سند، پرداخت و ارسال بیرونی بدون تأیید صریح کاربر مجاز نیست.'])
  });
}
