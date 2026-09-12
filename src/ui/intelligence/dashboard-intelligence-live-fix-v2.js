'use strict';

const HAS_BROWSER =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined';

let installed = false;
const TEN_DAY_QUERY =
  'در ده روز آینده چه چیزهایی نیاز به توجه دارد؟';

const ACCOUNT_CATEGORY_FA = Object.freeze({
  asset: 'دارایی',
  liability: 'بدهی',
  equity: 'حقوق مالکانه',
  income: 'درآمد',
  expense: 'هزینه'
});

function stripMoneyUnit(root) {
  if (!root) return;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.nodeValue || '';
    const next = text.replace(
      /[\s\u00a0]+(تومان|ریال)(?=[\s\u00a0]|$)/g,
      ''
    );
    if (next !== text) node.nodeValue = next;
  }
}

function fitSingleLineValue(element, minPx = 11) {
  if (!element || !HAS_BROWSER) return;

  requestAnimationFrame(() => {
    if (!element.isConnected) return;

    element.style.fontSize = '';
    element.style.whiteSpace = 'nowrap';
    element.style.maxWidth = '100%';

    const computed = window.getComputedStyle(element);
    let size = Number.parseFloat(computed.fontSize) || 24;
    const floor = Math.max(10, Number(minPx) || 11);

    while (
      element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1 &&
      size > floor
    ) {
      size -= 1;
      element.style.fontSize = `${size}px`;
    }
  });
}

function patchDashboardKpis(root) {
  if (!root) return;
  const title = String(
    document.getElementById('pageTitle')?.textContent || ''
  ).trim();
  if (title !== 'داشبورد') return;

  const primaryGrid =
    root.querySelector(':scope > .grid4') ||
    root.querySelector('.grid4');

  if (!primaryGrid) return;
  primaryGrid.classList.add('avan-dashboard-primary-kpis');

  primaryGrid.querySelectorAll(':scope > .card').forEach(card => {
    card.classList.add('avan-dashboard-primary-kpi-card');
    const value = card.querySelector('.kpi-value');
    if (value) {
      value.classList.add('avan-dashboard-primary-kpi-value');
      fitSingleLineValue(value, 11);
    }
  });
}

function patchWhyNumberAmount(root) {
  if (!root) return;
  root.querySelectorAll('.avan-why-amount-card').forEach(card => {
    card.classList.add('avan-why-amount-card-v2');
    const value = card.querySelector('.kpi-value');
    if (value) fitSingleLineValue(value, 12);
  });
}

function removeBusinessAnswerSource(root) {
  const answer = root?.querySelector?.('#businessAskAnswer');
  if (!answer) return;

  answer.querySelectorAll('.section-head .muted').forEach(node => {
    if (/^\s*منبع\s*:/.test(node.textContent || '')) node.remove();
  });

  answer.querySelectorAll('.info-box').forEach(box => {
    if (/منبع محاسبه/.test(box.textContent || '')) {
      box.textContent =
        'سؤال را انتخاب یا وارد کنید و سپس «تحلیل کن» را بزنید.';
    }
  });

  const query = String(
    root.querySelector('#businessAskQuery')?.value || ''
  );

  if (/ده روز|۱۰ روز|10 روز/.test(query)) {
    const card = answer.querySelector('.card');
    const heading = card?.querySelector('h3');
    if (
      heading &&
      /اولویت/.test(heading.textContent || '') &&
      String(heading.textContent || '').trim() !== 'اولویت‌های ده روز آینده'
    ) {
      heading.textContent = 'اولویت‌های ده روز آینده';
    }

    if (card && !card.querySelector('[data-avan-ten-day-note]')) {
      const note = document.createElement('div');
      note.className = 'info-box avan-ten-day-priority-note';
      note.dataset.avanTenDayNote = '1';
      note.textContent =
        'این فهرست، برنامه توجه مدیریتی برای ده روز آینده بر پایه وضعیت ثبت‌شده فعلی است و پیش‌بینی رویدادهای آینده محسوب نمی‌شود.';
      card.appendChild(note);
    }
  }
}

function standardizeBusinessQuestions(root) {
  if (!root) return;
  const form = root.querySelector('#businessAskForm');
  if (!form) return;

  root.querySelectorAll('[data-business-example]').forEach(button => {
    const text = String(button.textContent || '').trim();
    if (/اولویت‌های امروز/.test(text)) {
      button.textContent = 'اولویت‌های ده روز آینده';
      button.dataset.businessExample = TEN_DAY_QUERY;
    }
    button.dataset.avanRequiresSubmit = '1';
  });

  root.querySelectorAll('[data-avan-business-question]').forEach(button => {
    const text = String(button.textContent || '').trim();
    if (/مهم‌ترین اولویت‌ها/.test(text)) {
      button.remove();
      return;
    }
    button.dataset.avanRequiresSubmit = '1';
  });

  removeBusinessAnswerSource(root);
}

function wrapOnce(table, className) {
  if (!table || table.parentElement?.classList.contains(className)) return;
  const wrapper = document.createElement('div');
  wrapper.className = className;
  table.parentNode?.insertBefore(wrapper, table);
  wrapper.appendChild(table);
}

function standardizeCollectionTable(root) {
  if (!root) return;

  root.querySelectorAll('h2').forEach(heading => {
    if (!/دستیار هوشمند وصول/.test(heading.textContent || '')) return;

    const section = heading.closest('.section.card');
    const table = section?.querySelector('table');
    if (!table) return;

    table.classList.add('avan-collection-priority-table');
    wrapOnce(table, 'avan-collection-priority-wrap');
    stripMoneyUnit(table);
  });
}

function strengthenContinuousControls(root) {
  if (!root) return;
  root.querySelectorAll('.avan-continuous-controls-table').forEach(table => {
    table.classList.add('avan-continuous-controls-table-v2');
  });
}

function activeMoneyUnitLabel() {
  const runtimeLabel = String(window.AvanMoney?.unitLabel?.() || '').trim();
  if (runtimeLabel === 'ریال' || runtimeLabel === 'تومان') return runtimeLabel;
  const runtimeUnit = String(window.AvanMoney?.unit?.() || '').trim().toLowerCase();
  if (runtimeUnit === 'rial') return 'ریال';
  if (runtimeUnit === 'toman') return 'تومان';
  const pageText = String(document.getElementById('content')?.textContent || '');
  if (/ریال/.test(pageText)) return 'ریال';
  return 'تومان';
}

function ensureHeaderUnit(th, label, unit) {
  if (!th) return;
  const text = String(th.textContent || '').trim();
  const plain = text.replace(/\s*\((?:تومان|ریال)\)\s*$/, '').trim();
  if (plain !== label) return;
  const next = `${label} (${unit})`;
  if (text !== next) th.textContent = next;
}

function patchAgingMoneyUnitHeaders(root) {
  if (!root) return;
  const unit = activeMoneyUnitLabel();

  [...root.querySelectorAll('.section.card')]
    .filter(section => /مطالبات و بدهی تجاری/.test(section.textContent || ''))
    .forEach(section => {
      section.querySelectorAll('table').forEach(table => {
        table.querySelectorAll('th').forEach(th => {
          ensureHeaderUnit(th, 'مبلغ', unit);
          ensureHeaderUnit(th, 'مانده باز', unit);
        });
      });
    });

  if (/ریز مانده باز/.test(root.textContent || '')) {
    root.querySelectorAll('table th').forEach(th =>
      ensureHeaderUnit(th, 'مانده', unit)
    );
  }
}

function replaceModalEnglish(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) continue;
    let text = node.nodeValue || '';
    text = text
      .replace(/\bEvidence\b/g, 'شواهد حسابداری')
      .replace(/\bLedger\b/g, 'دفتر کل');
    if (node.nodeValue !== text) node.nodeValue = text;
  }
}

function translateAccountGroups(modal) {
  if (!modal) return;
  modal.querySelectorAll('table').forEach(table => {
    const headers = [...table.querySelectorAll('thead th')].map(th =>
      String(th.textContent || '').trim()
    );
    const groupIndex = headers.indexOf('گروه');
    if (groupIndex < 0) return;
    table.querySelectorAll('tbody tr').forEach(row => {
      const cell = row.children[groupIndex];
      if (!cell) return;
      const raw = String(cell.textContent || '').trim().toLowerCase();
      const translated = ACCOUNT_CATEGORY_FA[raw];
      if (translated && cell.textContent.trim() !== translated) {
        cell.textContent = translated;
      }
    });
  });
}

function patchBusinessEvidenceModal(modal) {
  if (!modal || !modal.querySelector('#businessEvidenceClose')) return;
  if (!/چرا این عدد؟/.test(modal.textContent || '')) return;

  modal.classList.add('avan-business-evidence-fa');
  replaceModalEnglish(modal);

  const badge = modal.querySelector('.section-head .cloud-badge');
  if (badge && badge.textContent.trim() !== 'شواهد حسابداری') {
    badge.textContent = 'شواهد حسابداری';
  }

  const summaryGrid = [...modal.querySelectorAll('.grid4')].find(grid =>
    /عدد پاسخ/.test(grid.textContent || '')
  );
  if (summaryGrid) {
    const cards = [...summaryGrid.children].filter(node =>
      node.classList?.contains('card')
    );
    const answerCard = cards.find(card => /عدد پاسخ/.test(card.textContent || ''));
    cards.forEach(card => {
      if (card !== answerCard && /منبع محاسبه|حساب‌های مرتبط|شواهد دفتر کل/.test(card.textContent || '')) {
        card.remove();
      }
    });
    summaryGrid.classList.add('avan-business-evidence-answer-grid');
    if (answerCard) {
      answerCard.classList.add('avan-business-evidence-answer-card');
      const value = answerCard.querySelector('.kpi-value');
      if (value) {
        value.classList.add('avan-business-evidence-answer-value');
        fitSingleLineValue(value, 16);
      }
    }
  }

  modal.querySelectorAll('.info-box.section').forEach(box => {
    if (/منطق\s*:|بازه\s*:/.test(box.textContent || '')) box.remove();
  });

  modal.querySelectorAll('.success-box.section,.error-box.section').forEach(box => {
    if (/Evidence/.test(box.textContent || '')) {
      box.textContent = String(box.textContent || '').replace(/Evidence/g, 'شواهد حسابداری');
    }
  });

  translateAccountGroups(modal);
  replaceModalEnglish(modal);
  window.AvanAccountingNegative?.project?.();
}

function installEvidencePolishStyle() {
  if (document.getElementById('avanBusinessEvidenceFaPolishStyle')) return;
  const style = document.createElement('style');
  style.id = 'avanBusinessEvidenceFaPolishStyle';
  style.textContent = `
    .avan-business-evidence-fa .avan-business-evidence-answer-grid{
      display:block!important;
      width:100%;
      margin-block:14px 18px;
    }
    .avan-business-evidence-fa .avan-business-evidence-answer-card{
      width:min(100%,760px);
      max-width:760px;
      margin-inline:auto;
      padding:24px 20px;
      text-align:center;
      border:1px solid var(--primary,#5754d8);
      background:var(--surface-soft,#f7f7fb);
    }
    .avan-business-evidence-fa .avan-business-evidence-answer-value{
      font-size:clamp(1.65rem,5vw,2.6rem)!important;
      line-height:1.45;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      font-variant-numeric:tabular-nums;
    }
    .avan-business-evidence-fa .avan-accounting-negative{
      color:var(--bad,#b23b3b)!important;
      font-weight:800!important;
    }
  `;
  document.head.append(style);
}

function patchAll(root) {
  if (!root) return;
  patchDashboardKpis(root);
  patchWhyNumberAmount(root);
  standardizeBusinessQuestions(root);
  standardizeCollectionTable(root);
  strengthenContinuousControls(root);
  patchAgingMoneyUnitHeaders(root);
}

function selectQuestionOnly(event) {
  const button = event.target?.closest?.(
    '[data-business-example],[data-avan-business-question]'
  );
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const query =
    String(button.dataset.avanBusinessQuestion || '') ||
    String(button.dataset.businessExample || '');

  const input = document.getElementById('businessAskQuery');
  if (input) {
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  const answer = document.getElementById('businessAskAnswer');
  if (answer) {
    answer.innerHTML =
      '<div class="info-box">سؤال انتخاب شد. برای اجرا، دکمه «تحلیل کن» را بزنید.</div>';
  }
}

export function installDashboardIntelligenceLiveFixV2() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;

  installEvidencePolishStyle();
  document.addEventListener('click', selectQuestionOnly, true);

  const content = document.getElementById('content');
  const modal = document.getElementById('modal');

  const refresh = () => {
    patchAll(content);
    patchWhyNumberAmount(modal);
    patchAgingMoneyUnitHeaders(modal);
    patchBusinessEvidenceModal(modal);
  };

  const observer = new MutationObserver(() => queueMicrotask(refresh));
  const modalObserver = new MutationObserver(() =>
    queueMicrotask(() => {
      patchWhyNumberAmount(modal);
      patchAgingMoneyUnitHeaders(modal);
      patchBusinessEvidenceModal(modal);
    })
  );

  if (content) observer.observe(content, { childList: true, subtree: true });
  if (modal) modalObserver.observe(modal, { childList: true, subtree: true });

  window.addEventListener('avan:page-rendered', () => queueMicrotask(refresh));
  window.addEventListener('avan:money-unit-changed', () => queueMicrotask(refresh));
  window.addEventListener('resize', () => queueMicrotask(refresh));

  refresh();

  window.AvanDashboardIntelligenceLiveFixV2 = Object.freeze({ refresh });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      installDashboardIntelligenceLiveFixV2,
      { once: true }
    );
  } else {
    installDashboardIntelligenceLiveFixV2();
  }
}
