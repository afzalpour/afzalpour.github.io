'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const BRAND_BUCKET = 'avan-branding';
let brandWorkspaceId = null;
let brandBusy = false;

const SOURCE_FA = Object.freeze({
  check_issue: 'صدور چک',
  inventory_issue: 'حواله انبار',
  inventory_receipt: 'رسید انبار',
  manual: 'دستی',
  payment: 'پرداخت',
  purchase_invoice: 'فاکتور خرید',
  receipt: 'دریافت',
  reversal: 'برگشت',
  sales_invoice: 'فاکتور فروش',
  sale_invoice: 'فاکتور فروش',
  transfer: 'انتقال',
  check_receipt: 'دریافت چک',
  check_clearance: 'وصول چک',
  check_bounce: 'برگشت چک'
});

const PARTY_KIND_FA = Object.freeze({
  customer: 'مشتری',
  vendor: 'فروشنده',
  both: 'مشتری و فروشنده',
  other: 'سایر'
});

const EXACT_FA = Object.freeze({
  ...SOURCE_FA,
  ...PARTY_KIND_FA,
  sale: 'فروش',
  purchase: 'خرید',
  posted: 'ثبت‌شده',
  draft: 'پیش‌نویس',
  reversed: 'برگشتی',
  bank: 'بانک',
  cash: 'صندوق',
  open: 'باز',
  settled: 'تسویه‌شده',
  received: 'دریافت‌شده',
  issued: 'صادرشده',
  cleared: 'وصول/پاس‌شده'
});

const TEXT_REPLACEMENTS = [
  ['Business Risk Radar', 'رادار ریسک کسب‌وکار'],
  ['Continuous Audit Lite', 'پایش پیوسته سبک'],
  ['Continuous Audit', 'پایش پیوسته'],
  ['Risk Radar', 'رادار ریسک'],
  ['Avan Intelligence', 'هوش مالی آوان'],
  ['CFO Autopilot', 'دستیار هوشمند مالی'],
  ['Explainable AI', 'تحلیل قابل توضیح'],
  ['Smart Collection Agent', 'دستیار هوشمند وصول'],
  ['Month-End Autopilot', 'دستیار پایان ماه'],
  ['Close Assistant', 'دستیار بستن دوره'],
  ['Human-Controlled', 'تحت کنترل کاربر'],
  ['Integrity Alert', 'هشدار یکپارچگی'],
  ['Integrity', 'یکپارچگی'],
  ['Duplicate', 'تکراری بودن'],
  ['Top 3', 'سه مورد اول'],
  ['Aging', 'سررسید'],
  ['Workspace', 'شرکت'],
  ['Ledger', 'دفتر کل'],
  ['Journal', 'سند حسابداری'],
  ['Posted', 'ثبت‌شده'],
  ['Supabase متصل', 'اتصال ابری برقرار'],
  ['negative_stock_forbidden', 'موجودی کالا برای این فروش کافی نیست؛ ابتدا موجودی قابل فروش را کنترل کنید.'],
  ['NEGATIVE_STOCK_FORBIDDEN', 'موجودی کالا برای این فروش کافی نیست؛ ابتدا موجودی قابل فروش را کنترل کنید.'],
  ['report_trial_balance', 'تراز آزمایشی'],
  ['report_journal', 'دفتر روزنامه'],
  ['report_account_statement', 'گردش حساب'],
  ...Object.entries(SOURCE_FA),
  ...Object.entries(PARTY_KIND_FA)
];

const REPORT_REMOVE = [
  'گزارش فارسی از داده‌های معتبر Ledger',
  'گزارش فارسی از داده‌های معتبر دفتر کل',
  'آوان SQL آزاد اجرا نمی‌کند؛',
  'درخواست فقط به گزارش‌های کنترل‌شده تبدیل می‌شود.'
];

function currentPage(){
  return String(document.getElementById('pageTitle')?.textContent || '').trim();
}

function moneyUnit(){
  return window.AVAN_MONEY_DISPLAY_UNIT === 'rial' ? 'ریال' : 'تومان';
}

function cleanHeader(value){
  return String(value || '')
    .replace(/\s*\((?:تومان|ریال)\)\s*$/u, '')
    .trim();
}

function isMoneyHeader(label){
  const t = cleanHeader(label);
  if (!t) return false;
  if (/(تعداد|شماره|روز|درصد|٪|امتیاز)/u.test(t)) return false;
  if (/^موجودی$/u.test(t)) return false;
  if (/(بدهکار|بستانکار|مبلغ|مانده|ارزش|بها|بهای|فی|درآمد|هزینه|سود|زیان|فروش|خالص|جمع\s*کل|جمع\s*بدهکار|جمع\s*بستانکار)/u.test(t)) return true;
  if (currentPage() === 'گزارش‌ها' && /^(دارایی|بدهی|حقوق مالکانه|بدهی و حقوق مالکانه)$/u.test(t)) return true;
  return false;
}

function annotateMoneyHeaders(root = document){
  const unit = moneyUnit();
  root.querySelectorAll?.('th').forEach(th => {
    const base = cleanHeader(th.textContent);
    if (!isMoneyHeader(base)) return;
    th.textContent = `${base} (${unit})`;
  });
}

function replaceTextNode(node, dashboardOnly = false){
  if (!(node instanceof Text)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest('script,style')) return;
  let value = node.nodeValue || '';
  const trimmed = value.trim();
  if (EXACT_FA[trimmed]) {
    value = value.replace(trimmed, EXACT_FA[trimmed]);
  }
  for (const [from, to] of TEXT_REPLACEMENTS) {
    if (value.includes(from)) value = value.split(from).join(to);
  }
  if (dashboardOnly) {
    value = value
      .replace(/\bAI\b/g, 'هوش مصنوعی')
      .replace(/\bLite\b/g, 'سبک')
      .replace(/\bCFO\b/g, 'مدیر مالی')
      .replace(/\bSQL\b/g, 'پرس‌وجوی مستقیم');
  }
  if (value !== node.nodeValue) node.nodeValue = value;
}

function walkText(root, dashboardOnly = false){
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => replaceTextNode(node, dashboardOnly));
}

function removeReportHelp(){
  if (currentPage() !== 'گزارش‌ها') return;
  const root = document.getElementById('content');
  if (!root) return;
  root.querySelectorAll('small,.muted,.info-box').forEach(el => {
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (REPORT_REMOVE.some(fragment => text.includes(fragment))) el.remove();
  });
}

function polishNow(){
  const root = document.getElementById('content') || document.body;
  walkText(root, currentPage() === 'داشبورد');
  walkText(document.querySelector('.sidebar'), false);
  walkText(document.getElementById('modal'), false);
  annotateMoneyHeaders(document);
  removeReportHelp();
}

function installBrandStyle(){
  if (document.getElementById('rc14v62BrandStyle')) return;
  const style = document.createElement('style');
  style.id = 'rc14v62BrandStyle';
  style.textContent = `
    .brand-mark[data-company-logo]{overflow:hidden;background:#fff!important;border:1px solid var(--line,#e5e7eb)}
    .brand-mark[data-company-logo] img{width:100%;height:100%;display:block;object-fit:contain;padding:2px;border-radius:inherit}
    .brand>div:last-child{min-width:0}.brand>div:last-child strong{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;
  document.head.append(style);
}

async function refreshBrand(force = false){
  if (brandBusy) return;
  const brand = document.querySelector('.brand');
  if (!brand) return;
  brandBusy = true;
  try {
    const state = await C.companyContext.ensure();
    const company = state?.active_company;
    if (!company?.id) return;
    if (!force && brandWorkspaceId === company.id && brand.dataset.v62Ready === '1') return;

    let profile = null;
    try { profile = await C.rpc('get_workspace_print_profile', { wid: company.id }); } catch {}
    let logoUrl = '';
    if (profile?.logo_path) {
      try { logoUrl = await C.signedFileUrl(BRAND_BUCKET, profile.logo_path, 3600); } catch {}
    }

    const title = brand.querySelector('strong');
    const sub = brand.querySelector('span');
    const mark = brand.querySelector('.brand-mark');
    if (title) title.textContent = profile?.display_name || company.name || 'آوان';
    if (sub) sub.textContent = 'حسابداری آوان';
    if (mark) {
      mark.textContent = '';
      if (logoUrl) {
        const img = document.createElement('img');
        img.src = logoUrl;
        img.alt = 'لوگوی شرکت';
        mark.append(img);
        mark.dataset.companyLogo = '1';
      } else {
        delete mark.dataset.companyLogo;
        mark.textContent = 'آ';
      }
    }
    brandWorkspaceId = company.id;
    brand.dataset.v62Ready = '1';
  } catch (err) {
    console.warn('[RC1.4 v62 brand] fallback to Avan brand', err);
    const sub = brand.querySelector('span');
    if (sub) sub.textContent = 'حسابداری آوان';
  } finally {
    brandBusy = false;
  }
}

let timerIds = [];
function schedulePolish(){
  timerIds.forEach(clearTimeout);
  timerIds = [0, 60, 180, 500, 1200, 2600].map(delay => setTimeout(() => {
    polishNow();
    if (delay === 180 || delay === 1200) refreshBrand();
  }, delay));
}

function install(){
  installBrandStyle();
  schedulePolish();
  refreshBrand(true);

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (button && /(چاپ|PDF)/u.test(button.textContent || '')) polishNow();
    schedulePolish();
  }, true);

  document.addEventListener('submit', () => schedulePolish(), true);
  document.addEventListener('avan:money-unit-changed', () => schedulePolish());
  window.addEventListener('avan:company-context-changed', () => {
    brandWorkspaceId = null;
    schedulePolish();
    refreshBrand(true);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
