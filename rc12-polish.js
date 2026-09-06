'use strict';

const ACCOUNT_COLOR_KEY = 'avan.account_tree_colors';
const BRANCH_HUES = [
  258, 32, 154, 326, 206, 82, 286, 18, 176, 236
];

let scheduled = null;

const normalize = value => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim();

function currentPage() {
  return normalize(document.getElementById('pageTitle')?.textContent);
}

function colorEnabled() {
  try {
    return window.sessionStorage?.getItem(ACCOUNT_COLOR_KEY) !== 'off';
  } catch {
    return true;
  }
}

function setColorEnabled(enabled) {
  try {
    window.sessionStorage?.setItem(ACCOUNT_COLOR_KEY, enabled ? 'on' : 'off');
  } catch {
    // UI preference is optional and must never block accounting work.
  }
  document.body.classList.toggle('avan-account-colors-on', enabled);
}

function removeExactCopy(text) {
  document.querySelectorAll('#content p,#content span,#content small,#content div').forEach(node => {
    if (!(node instanceof Element) || node.childElementCount) return;
    if (normalize(node.textContent) === text) node.remove();
  });
}

function polishReports() {
  if (currentPage() !== 'گزارش‌ها') return;

  removeExactCopy('گزارش فارسی از داده‌های معتبر Ledger');
  removeExactCopy('آوان SQL آزاد اجرا نمی‌کند؛ درخواست فقط به گزارش‌های کنترل‌شده تبدیل می‌شود.');
}

function renameSettingsPills() {
  document.querySelectorAll('#content .summary-pill').forEach(pill => {
    const text = normalize(pill.textContent);
    const replacements = [
      ['اسناد Posted/Reversed', 'اسناد ثبت‌شده/برگشتی'],
      ['Workspace قابل مشاهده', 'فضاهای مالی قابل مشاهده'],
      ['دوره بسته', 'دوره‌های بسته']
    ];

    for (const [from, to] of replacements) {
      if (text.startsWith(from)) {
        pill.textContent = text.replace(from, to);
        break;
      }
    }
  });
}

function polishSettings() {
  if (currentPage() !== 'تنظیمات') return;

  document.querySelectorAll('#content .kpi-label').forEach(label => {
    if (normalize(label.textContent) !== 'محل ذخیره') return;
    const card = label.closest('.card');
    const grid = card?.parentElement;
    card?.remove();
    if (grid?.classList.contains('grid4')) {
      grid.classList.add('avan-settings-summary-grid');
    }
  });

  document.querySelectorAll('#content h2,#content h3').forEach(heading => {
    if (normalize(heading.textContent) === 'سلامت Core') {
      heading.textContent = 'سلامت سیستم';
    }
  });

  renameSettingsPills();
}

function accountLevel(row) {
  const first = row.cells?.[0];
  if (!first) return 0;
  if (first.classList.contains('tree-indent-2')) return 2;
  if (first.classList.contains('tree-indent-1')) return 1;
  return 0;
}

function installAccountToggle(sectionHead) {
  if (document.getElementById('avanAccountColorToggle')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'avanAccountColorToggle';
  button.className = 'ghost';

  const refreshLabel = () => {
    button.textContent = colorEnabled()
      ? 'رنگ‌بندی شاخه‌ها: روشن'
      : 'رنگ‌بندی شاخه‌ها: خاموش';
  };

  refreshLabel();
  button.addEventListener('click', () => {
    setColorEnabled(!colorEnabled());
    refreshLabel();
  });

  const addButton = sectionHead.querySelector('#addAccount');
  if (addButton) {
    addButton.insertAdjacentElement('beforebegin', button);
  } else {
    sectionHead.append(button);
  }
}

function polishAccountTree() {
  if (currentPage() !== 'حساب‌ها') return;

  const content = document.getElementById('content');
  const table = content?.querySelector('table');
  const sectionHead = content?.querySelector('.section-head');
  if (!table || !sectionHead) return;

  installAccountToggle(sectionHead);
  setColorEnabled(colorEnabled());

  let branch = -1;
  [...table.tBodies].flatMap(body => [...body.rows]).forEach(row => {
    const level = accountLevel(row);
    if (level === 0) branch += 1;
    if (branch < 0) branch = 0;

    row.classList.add('avan-account-branch');
    row.dataset.accountLevel = String(level);
    row.style.setProperty(
      '--branch-h',
      String(BRANCH_HUES[branch % BRANCH_HUES.length])
    );
  });
}

function apply() {
  polishReports();
  polishSettings();
  polishAccountTree();
}

function schedule() {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = null;
    apply();
  }, 80);
}

function install() {
  setColorEnabled(colorEnabled());
  apply();

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true
  });

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-page]')) {
      window.setTimeout(schedule, 100);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
