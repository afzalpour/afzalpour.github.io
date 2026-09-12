'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createWorkingCapitalService } from '../../application/intelligence/working-capital-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const Service = HAS_BROWSER ? createWorkingCapitalService({ cloud: C }) : null;
let state = null;
let installed = false;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function money(value) {
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0'), { withUnit: true }) || '—';
}

const evidenceTypeFa = Object.freeze({
  party: 'طرف‌حساب',
  journal_entry: 'سند حسابداری',
  journal_line: 'ردیف سند',
  invoice: 'فاکتور'
});

function priorityClass(tier) {
  if (['critical', 'overdue'].includes(tier)) return 'danger';
  if (['high', 'due_7'].includes(tier)) return 'attention';
  if (['medium', 'watch', 'due_30'].includes(tier)) return 'watch';
  return 'normal';
}

function metric(label, value, note = '') {
  return `
    <article class="card avan-working-capital-metric">
      <span class="kpi-label">${esc(label)}</span>
      <div class="kpi-value" data-avan-number-output="1">${money(value)}</div>
      ${note ? `<span class="muted">${esc(note)}</span>` : ''}
    </article>`;
}

function collectionHtml(items) {
  return `
    <section class="card">
      <div class="section-head">
        <div><h2>اولویت‌های وصول</h2><span class="muted">اولویت قاعده‌محور؛ بدون امتیاز ساختگی و بدون ارسال خودکار پیام.</span></div>
        <span class="summary-pill">${Number(items.length).toLocaleString('fa-IR')} طرف‌حساب</span>
      </div>
      ${items.length ? `<div class="avan-working-capital-list">${items.map(item => `
        <div class="avan-working-capital-row ${priorityClass(item.priority?.tier)}">
          <div class="avan-working-capital-row-main">
            <b>${esc(item.partyName)}</b>
            <span class="muted">${esc(item.priority?.label || 'در سررسید')} · بیشترین تأخیر ${Number(item.maxDaysPastDue || 0).toLocaleString('fa-IR')} روز</span>
          </div>
          <div class="avan-working-capital-money"><span>مانده</span><b data-avan-number-output="1">${money(item.total)}</b></div>
          <div class="avan-working-capital-money"><span>سررسیدگذشته</span><b data-avan-number-output="1">${money(item.overdue)}</b></div>
          <button type="button" class="ghost small" data-working-capital-evidence="collection:${esc(item.partyId)}">شواهد</button>
        </div>`).join('')}</div>` : '<div class="success-box">مطالبه بازی برای اولویت‌بندی وصول دیده نشد.</div>'}
    </section>`;
}

function paymentHtml(items) {
  return `
    <section class="card">
      <div class="section-head">
        <div><h2>تقویم پرداختنی ۳۰ روزه</h2><span class="muted">نمای تعهدات؛ پرداخت خودکار یا پیشنهاد انتقال وجه انجام نمی‌شود.</span></div>
        <span class="summary-pill">${Number(items.length).toLocaleString('fa-IR')} تعهد</span>
      </div>
      ${items.length ? `<div class="avan-working-capital-list">${items.map(item => `
        <div class="avan-working-capital-row ${priorityClass(item.paymentPriority?.tier)}">
          <div class="avan-working-capital-row-main">
            <b>${item.invoiceNo ? `فاکتور ${esc(item.invoiceNo)}` : `سند ${esc(item.journalNo || '—')}`}</b>
            <span class="muted">سررسید ${esc(dateFa(item.dueDate))} · ${esc(item.paymentPriority?.label || '')}</span>
          </div>
          <div class="avan-working-capital-money"><span>مبلغ باز</span><b data-avan-number-output="1">${money(item.remaining)}</b></div>
          <button type="button" class="ghost small" data-working-capital-evidence="payment:${esc(item.id)}">شواهد</button>
        </div>`).join('')}</div>` : '<div class="success-box">تعهد پرداختنی سررسیدشده یا ۳۰ روز آینده دیده نشد.</div>'}
    </section>`;
}

export function workingCapitalPageHtml({ workspace, snapshot }) {
  const m = snapshot.metrics;
  return `
    <div class="avan-working-capital" data-working-capital-page>
      <section class="card avan-working-capital-hero">
        <div>
          <div class="eyebrow">تصمیم‌یار قاعده‌محور · مبتنی بر شواهد</div>
          <h2>مرکز سرمایه در گردش</h2>
          <p class="muted">مطالبات، بدهی‌ها و فشار نقدی کوتاه‌مدت «${esc(workspace.name)}» با اتصال مستقیم به سند، ردیف و فاکتور.</p>
        </div>
        <form data-working-capital-date-form class="avan-working-capital-date-form">
          <div class="field"><label>تا تاریخ</label><input type="date" name="asOf" value="${esc(snapshot.asOf)}" required></div>
          <button type="submit" class="primary">به‌روزرسانی</button>
        </form>
      </section>

      <div class="grid3 avan-working-capital-grid">
        ${metric('نقد و بانک', snapshot.cash.value)}
        ${metric('مطالبات باز', m.grossReceivables)}
        ${metric('مطالبات سررسیدگذشته', m.overdueReceivables)}
        ${metric('بدهی‌های باز', m.grossPayables)}
        ${metric('بدهی سررسیدگذشته', m.overduePayables)}
        ${metric('پرداختنی تا ۳۰ روز آینده', m.payablesDueWithin30Days)}
        ${metric('نقد پس از پوشش بدهی معوق و ۳۰ روزه', m.cashLessOverdueAnd30DayPayables, 'شاخص سناریویی نیست؛ فقط تفاضل نقد فعلی با تعهدات شناسایی‌شده است.')}
      </div>

      ${collectionHtml(snapshot.collectionPriorities)}
      ${paymentHtml(snapshot.paymentCalendar)}

      <section class="card avan-working-capital-evidence-summary">
        <div class="section-head"><div><h2>گراف شواهد</h2><span class="muted">هر مانده باز به شواهد حسابداری قابل ردیابی متصل است.</span></div><span class="cloud-badge">قابل ردیابی</span></div>
        <div class="avan-working-capital-evidence-kpis">
          <span class="summary-pill">${Number(snapshot.evidenceGraph.nodes.length).toLocaleString('fa-IR')} گره</span>
          <span class="summary-pill">${Number(snapshot.evidenceGraph.edges.length).toLocaleString('fa-IR')} ارتباط</span>
        </div>
      </section>

      <div class="info-box">دقت پولی: یک ریال · تهاتر بین طرف‌حساب‌ها: غیرفعال · عملیات وصول خودکار: صفر · عملیات پرداخت خودکار: صفر · تغییر دفترکل: صفر</div>
    </div>`;
}

function evidenceModal(title, refs = []) {
  const grouped = new Map();
  refs.forEach(item => {
    if (!item?.type || !item?.id) return;
    if (!grouped.has(item.type)) grouped.set(item.type, []);
    grouped.get(item.type).push(item.id);
  });
  openModal(`
    <div data-working-capital-evidence-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">مسیر شواهد مالی</span></div><span class="cloud-badge">فقط خواندنی</span></div>
      <div class="avan-working-capital-evidence-list">${grouped.size ? [...grouped.entries()].map(([type, ids]) => `
        <div class="card"><b>${esc(evidenceTypeFa[type] || type)}</b><span class="muted">${Number(ids.length).toLocaleString('fa-IR')} مرجع</span><div>${ids.slice(0, 12).map(id => `<code>${esc(id)}</code>`).join(' ')}</div></div>`).join('') : '<div class="empty">مرجع جزئی برای این ردیف موجود نیست.</div>'}</div>
      <div class="form-actions"><button type="button" class="ghost" data-working-capital-close>بستن</button></div>
    </div>`);
  document.querySelector('[data-working-capital-close]')?.addEventListener('click', closeModal, { once: true });
}

function bindActions() {
  const root = document.querySelector('[data-working-capital-page]');
  if (!root || !state) return;
  root.querySelector('[data-working-capital-date-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const asOf = String(new FormData(event.currentTarget).get('asOf') || '');
    if (!asOf) return toast('تاریخ مبنا را انتخاب کنید.');
    void openWorkingCapital(asOf);
  });
  root.querySelectorAll('[data-working-capital-evidence]').forEach(button => button.addEventListener('click', () => {
    const [kind, id] = String(button.dataset.workingCapitalEvidence || '').split(':');
    if (kind === 'collection') {
      const item = state.snapshot.collectionPriorities.find(row => row.partyId === id);
      if (item) evidenceModal(`شواهد وصول — ${item.partyName}`, item.evidence);
      return;
    }
    const item = state.snapshot.paymentCalendar.find(row => row.id === id);
    if (item) evidenceModal('شواهد تعهد پرداختنی', item.evidence);
  }));
}

function setNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-working-capital-nav]')?.classList.toggle('active', Boolean(active));
}

export async function openWorkingCapital(asOf = today()) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    await MoneyRuntime?.ready?.();
    setTitle('مرکز سرمایه در گردش');
    setNavActive(true);
    page('<div class="loading">در حال تحلیل مطالبات، بدهی‌ها و فشار نقدی…</div>');
    state = await Service.load({ asOf });
    page(workingCapitalPageHtml(state));
    setNavActive(true);
    bindActions();
    return state;
  } catch (error) {
    console.error('[Avan Working Capital]', error);
    page(`<div class="error-box">مرکز سرمایه در گردش در این لحظه قابل بارگذاری نیست: ${esc(error?.userMessage || error?.message || error)}</div>`);
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-working-capital-nav]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.workingCapitalNav = '1';
  button.innerHTML = '<span>◫</span>سرمایه در گردش';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    void openWorkingCapital();
  });
  const twin = nav.querySelector('[data-digital-twin-nav]');
  if (twin) twin.insertAdjacentElement('afterend', button);
  else nav.append(button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-working-capital-report-launcher]')) return;
  const card = document.createElement('section');
  card.className = 'card avan-control-tower-report-launcher avan-working-capital-report-launcher';
  card.dataset.workingCapitalReportLauncher = '1';
  card.innerHTML = '<div><b>◫ مرکز سرمایه در گردش</b><span class="muted">اولویت وصول، تقویم پرداختنی و فشار نقدی کوتاه‌مدت با شواهد</span></div><button type="button" class="primary">مشاهده</button>';
  card.querySelector('button')?.addEventListener('click', () => void openWorkingCapital());
  content.prepend(card);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title !== 'مرکز سرمایه در گردش') document.querySelector('[data-working-capital-nav]')?.classList.remove('active');
}

export function installWorkingCapitalWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => {
    if (document.querySelector('[data-working-capital-page]')) void openWorkingCapital(state?.snapshot?.asOf || today());
  });
  if (document.getElementById('pageTitle')?.textContent === 'گزارش‌ها') installReportsLauncher();
  window.AvanWorkingCapital = Object.freeze({ open: openWorkingCapital });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWorkingCapitalWorkspace, { once: true });
  else installWorkingCapitalWorkspace();
}
