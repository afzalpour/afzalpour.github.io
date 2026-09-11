'use strict';

const HAS_BROWSER =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined';

let installed = false;
const TEN_DAY_QUERY =
  'در ده روز آینده چه چیزهایی نیاز به توجه دارد؟';

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
    if (heading && /اولویت/.test(heading.textContent || '')) {
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

function patchAll(root) {
  if (!root) return;
  patchDashboardKpis(root);
  patchWhyNumberAmount(root);
  standardizeBusinessQuestions(root);
  standardizeCollectionTable(root);
  strengthenContinuousControls(root);
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

  document.addEventListener('click', selectQuestionOnly, true);

  const content = document.getElementById('content');
  const modal = document.getElementById('modal');

  const refresh = () => {
    patchAll(content);
    patchWhyNumberAmount(modal);
  };

  const observer = new MutationObserver(() => queueMicrotask(refresh));
  const modalObserver = new MutationObserver(() =>
    queueMicrotask(() => patchWhyNumberAmount(modal))
  );

  if (content) observer.observe(content, { childList: true, subtree: true });
  if (modal) modalObserver.observe(modal, { childList: true, subtree: true });

  window.addEventListener('avan:page-rendered', () => queueMicrotask(refresh));
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
