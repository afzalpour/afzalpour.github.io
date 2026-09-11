'use strict';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
let installed = false;
let modalReturnState = null;

const TEXT_REPLACEMENTS = Object.freeze([
  ['Ledger Evidence', 'شواهد حسابداری'],
  ['Avan Intelligence', 'هوشمندی مالی آوان'],
  ['CFO Autopilot', 'دستیار مالی مدیریتی'],
  ['Explainable AI', 'تحلیل توضیح‌پذیر'],
  ['Business Risk Radar', 'رادار ریسک کسب‌وکار'],
  ['Continuous Audit Lite', 'پایش و حسابرسی مستمر'],
  ['Continuous Audit', 'کنترل‌های مستمر'],
  ['Smart Collection Agent', 'دستیار هوشمند وصول'],
  ['Month-End Autopilot', 'آمادگی پایان دوره'],
  ['Human-Controlled', 'تحت کنترل کاربر'],
  ['Ledger Aging', 'سررسید مبتنی بر دفتر کل'],
  ['AR / AP', 'مطالبات / بدهی‌ها'],
  ['Drill-down', 'مشاهده جزئیات'],
  ['report_balance_sheet', 'ترازنامه'],
  ['report_cash_bank_balances', 'مانده بانک و صندوق'],
  ['report_profit_loss', 'سود و زیان'],
  ['خطاهای Ledger/Invoice Integrity', 'خطاهای یکپارچگی دفتر کل و فاکتورها'],
  ['سندهای حسابداری Draft', 'سندهای حسابداری پیش‌نویس'],
  ['فاکتورهای Draft', 'فاکتورهای پیش‌نویس'],
  ['اسناد Uploaded/Extracted/Reviewed', 'اسناد بارگذاری‌شده/استخراج‌شده/بازبینی‌شده'],
  ['اسناد Reviewed', 'اسناد بازبینی‌شده'],
  ['Workspace', 'فضای کاری'],
  ['Ledger', 'دفتر کل'],
  ['Duplicate', 'تکراری'],
  ['Integrity Alert', 'هشدار یکپارچگی'],
  ['Integrity', 'یکپارچگی']
]);

const QUESTION_BANK = Object.freeze([
  ['وضعیت مطالبات', 'مطالبات من چقدر است و چه مقدار آن سررسیدگذشته است؟'],
  ['بیشترین بدهی تجاری', 'بیشترین بدهی تجاری به کدام طرف‌حساب است؟'],
  ['وضعیت بدهی‌ها', 'بدهی تجاری و مبلغ سررسیدگذشته من چقدر است؟'],
  ['نقدینگی فعلی', 'نقدینگی فعلی من چقدر است؟'],
  ['سود یا زیان دوره', 'سود یا زیان این دوره چقدر است؟'],
  ['مهم‌ترین اولویت‌ها', 'چه چیزهایی نیاز به توجه دارد؟']
]);

const RISK_EXPLANATIONS = Object.freeze({
  'پوشش ناکافی بدهی سررسیدگذشته': 'این مقدار از «بدهی تجاری سررسیدگذشته منهای نقد و بانک فعلی» به‌دست می‌آید. منبع آن سررسید بدهی‌های باز و مانده واقعی حساب‌های مالی است.',
  'مطالبات بیش از ۹۰ روز': 'این مقدار جمع مانده باز مطالباتی است که بیش از ۹۰ روز از سررسیدشان گذشته است. منبع آن ردیف‌های باز طرف‌حساب و تاریخ سررسید مطالبات در دفتر کل است.',
  'تمرکز بالای مطالبات': 'درصد از تقسیم مانده بزرگ‌ترین بدهکار بر کل مطالبات باز و ضرب در ۱۰۰ محاسبه می‌شود. این هشدار وقتی فعال می‌شود که سهم یک طرف‌حساب حداقل ۵۰٪ باشد.',
  'تمرکز بدهی تجاری': 'درصد از تقسیم مانده بزرگ‌ترین بستانکار تجاری بر کل بدهی تجاری باز و ضرب در ۱۰۰ محاسبه می‌شود. این هشدار وقتی فعال می‌شود که سهم یک طرف‌حساب حداقل ۶۰٪ باشد.',
  'وابستگی نقدینگی به وصول مطالبات': 'عدد نمایش‌داده‌شده کل مطالبات سررسیدگذشته است. این هشدار وقتی فعال می‌شود که مطالبات سررسیدگذشته بیش از دو برابر نقد و بانک فعلی باشد.'
});

function replaceVisibleText(root) {
  if (!root || !HAS_BROWSER) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'OPTION'].includes(parent.tagName)) continue;
    let text = node.nodeValue || '';
    let next = text;
    for (const [from, to] of TEXT_REPLACEMENTS) next = next.split(from).join(to);
    if (next !== text) node.nodeValue = next;
  }
}

function stripMoneyUnit(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue || '';
    const next = text.replace(/\s+(تومان|ریال)(?=\s|$)/g, '');
    if (next !== text) node.nodeValue = next;
  }
}

function wrapDashboardTable(table) {
  if (!table || table.closest('.avan-dashboard-polish-table-wrap')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'avan-dashboard-polish-table-wrap';
  table.parentNode?.insertBefore(wrapper, table);
  wrapper.appendChild(table);
  table.classList.add('avan-dashboard-polish-table');
}

function patchDashboardTables() {
  const content = document.getElementById('content');
  const title = String(document.getElementById('pageTitle')?.textContent || '').trim();
  if (!content || title !== 'داشبورد') return;
  content.querySelectorAll('table').forEach(wrapDashboardTable);
}

function patchWhyNumberModal(modal) {
  if (!modal || !/مسیر ردیابی عدد|شواهد حسابداری|Ledger Evidence/.test(modal.textContent || '')) return false;
  modal.classList.add('avan-why-number-polished');
  replaceVisibleText(modal);

  modal.querySelectorAll('.info-box').forEach(box => {
    if (/عدد اصلی مستقیماً از RPC گزارش محاسبه می‌شود|مسیر داده:/.test(box.textContent || '')) box.remove();
  });

  const summaryGrid = [...modal.querySelectorAll('.grid4')].find(grid => /عدد گزارش/.test(grid.textContent || ''));
  if (summaryGrid && !modal.querySelector('.avan-why-details')) {
    const cards = [...summaryGrid.children].filter(item => item.classList?.contains('card'));
    const amountCard = cards.find(card => /عدد گزارش/.test(card.textContent || ''));
    if (amountCard) amountCard.classList.add('avan-why-amount-card');
    const detailsCards = cards.filter(card => card !== amountCard && /منبع محاسبه|حساب‌های مرتبط|شواهد دفتر کل/.test(card.textContent || ''));
    if (detailsCards.length) {
      const details = document.createElement('details');
      details.className = 'avan-why-details';
      details.innerHTML = '<summary>جزئیات محاسبه و شواهد</summary><div class="avan-why-details-grid"></div>';
      const grid = details.querySelector('.avan-why-details-grid');
      detailsCards.forEach(card => grid.appendChild(card));
      summaryGrid.insertAdjacentElement('afterend', details);
    }
  }

  modal.querySelectorAll('th').forEach(th => {
    if ((th.textContent || '').trim() === 'Drill-down') th.textContent = 'مشاهده جزئیات';
  });
  return true;
}

function riskExplanation(title) {
  return RISK_EXPLANATIONS[String(title || '').trim()] || 'این هشدار با قواعد ثابت آوان از مانده‌ها، سررسیدها و کنترل‌های ثبت‌شده محاسبه شده است. برای بررسی جزئی‌تر، داده‌های مرتبط همان بخش را مشاهده کنید.';
}

function patchRiskCards(root) {
  if (!root) return;
  root.querySelectorAll('.avan-risk-factor-card').forEach(card => {
    if (card.querySelector('[data-avan-risk-why]')) return;
    const title = String(card.querySelector('.avan-risk-factor-title')?.textContent || '').trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost small avan-risk-why-action';
    button.dataset.avanRiskWhy = '1';
    button.textContent = 'چرا این عدد؟';
    const box = document.createElement('div');
    box.className = 'avan-risk-why-box';
    box.hidden = true;
    box.textContent = riskExplanation(title);
    card.append(button, box);
  });
}

function patchBusinessQuestions(root) {
  if (!root || root.querySelector('[data-avan-expanded-business-questions]')) return;
  const form = root.querySelector('#businessAskForm');
  if (!form) return;
  const currentActions = form.parentElement?.querySelector('.row-actions');
  if (!currentActions) return;
  const bank = document.createElement('div');
  bank.className = 'avan-business-question-bank';
  bank.dataset.avanExpandedBusinessQuestions = '1';
  QUESTION_BANK.forEach(([label, query]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost small';
    button.dataset.avanBusinessQuestion = query;
    button.textContent = label;
    bank.appendChild(button);
  });
  currentActions.insertAdjacentElement('afterend', bank);
}

function applySeverityClasses(root) {
  if (!root) return;
  const map = new Map([
    ['فوری', 'critical'], ['بحرانی', 'critical'], ['هشدار', 'warning'],
    ['نیازمند توجه', 'attention'], ['نیازمند تکمیل', 'attention'],
    ['اطلاع', 'info'], ['عادی', 'healthy'], ['آماده', 'healthy']
  ]);
  root.querySelectorAll('.kpi-label,.badge,.summary-pill').forEach(el => {
    const key = String(el.textContent || '').trim();
    const severity = map.get(key);
    if (severity) el.classList.add(`avan-severity-${severity}`);
  });
}

function patchAgingTables(root) {
  if (!root) return;
  const sections = [...root.querySelectorAll('.section.card')].filter(section => /مطالبات و بدهی تجاری/.test(section.textContent || ''));
  sections.forEach(section => section.querySelectorAll('table').forEach(table => {
    table.classList.add('avan-aging-centered-table');
    stripMoneyUnit(table);
  }));

  if (/ریز مانده باز/.test(root.textContent || '')) {
    root.querySelectorAll('table').forEach(table => {
      table.classList.add('avan-aging-centered-table');
      stripMoneyUnit(table);
    });
  }
}

function patchContinuousControls(root) {
  if (!root) return;
  root.querySelectorAll('h3').forEach(heading => {
    if (!/کنترل‌های مستمر/.test(heading.textContent || '')) return;
    const section = heading.closest('.section') || heading.parentElement?.parentElement?.parentElement;
    section?.querySelector('table')?.classList.add('avan-continuous-controls-table');
  });
}

function patchMonthEnd(root) {
  if (!root) return;
  root.querySelectorAll('h2').forEach(heading => {
    if (!/آمادگی پایان دوره/.test(heading.textContent || '')) return;
    const section = heading.parentElement?.parentElement?.parentElement;
    const table = section?.querySelector('table') || root.querySelector('table');
    if (table) table.classList.add('avan-month-end-polished');
  });
}

function patchRoot(root) {
  if (!root) return;
  replaceVisibleText(root);
  patchRiskCards(root);
  patchBusinessQuestions(root);
  applySeverityClasses(root);
  patchAgingTables(root);
  patchContinuousControls(root);
  patchMonthEnd(root);
  patchDashboardTables();
}

function captureModalReturn(event) {
  const button = event.target?.closest?.('[data-aging-journal],[data-why-journal]');
  if (!button) return;
  const modal = document.getElementById('modal');
  if (!modal || !modal.contains(button)) return;
  const fragment = document.createDocumentFragment();
  while (modal.firstChild) fragment.appendChild(modal.firstChild);
  modalReturnState = { fragment, scrollTop: modal.scrollTop };
}

function restoreModal() {
  if (!modalReturnState) return false;
  const modal = document.getElementById('modal');
  if (!modal) return false;
  const { fragment, scrollTop } = modalReturnState;
  modalReturnState = null;
  modal.replaceChildren(fragment);
  modal.scrollTop = scrollTop || 0;
  patchRoot(modal);
  return true;
}

function patchJournalBack(modal) {
  if (!modalReturnState || !modal) return;
  const close = modal.querySelector('#cancelModal');
  const heading = String(modal.querySelector('h2')?.textContent || '').trim();
  if (!close || !heading.startsWith('سند ')) return;
  close.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    restoreModal();
  };
}

function patchModal(modal) {
  if (!modal) return;
  patchWhyNumberModal(modal);
  patchRoot(modal);
  patchJournalBack(modal);
}

function onDocumentClick(event) {
  captureModalReturn(event);
  const question = event.target?.closest?.('[data-avan-business-question]');
  if (question) {
    const input = document.getElementById('businessAskQuery');
    if (input) {
      input.value = question.dataset.avanBusinessQuestion || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    return;
  }
  const why = event.target?.closest?.('[data-avan-risk-why]');
  if (why) {
    const box = why.parentElement?.querySelector('.avan-risk-why-box');
    if (!box) return;
    box.hidden = !box.hidden;
    why.textContent = box.hidden ? 'چرا این عدد؟' : 'بستن توضیح';
  }
}

export function installDashboardIntelligenceLivePolish() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  document.addEventListener('click', onDocumentClick, true);
  window.addEventListener('avan:page-rendered', () => queueMicrotask(() => patchRoot(document.getElementById('content'))));
  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  const observer = new MutationObserver(() => queueMicrotask(() => patchRoot(content)));
  const modalObserver = new MutationObserver(() => queueMicrotask(() => patchModal(modal)));
  if (content) observer.observe(content, { childList: true, subtree: true });
  if (modal) modalObserver.observe(modal, { childList: true, subtree: true });
  patchRoot(content);
  patchModal(modal);
  window.AvanDashboardIntelligencePolish = Object.freeze({ patch: () => patchRoot(document.getElementById('content')) });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installDashboardIntelligenceLivePolish, { once: true });
  else installDashboardIntelligenceLivePolish();
}
