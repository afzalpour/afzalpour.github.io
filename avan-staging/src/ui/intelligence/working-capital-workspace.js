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
  invoice: 'فاکتور',
  open_item: 'مانده باز'
});

const sourceTypeFa = Object.freeze({
  invoice: 'فاکتور',
  receipt: 'دریافت',
  payment: 'پرداخت',
  transfer: 'انتقال',
  manual: 'سند دستی',
  opening: 'افتتاحیه',
  reversal: 'برگشت سند'
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
        <div><h2>اولویت‌های وصول</h2><span class="muted">اولویت بر اساس مانده واقعی و مدت تأخیر تعیین می‌شود؛ هیچ پیام یا وصولی خودکار انجام نمی‌شود.</span></div>
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
          <button type="button" class="ghost small" data-working-capital-evidence="1" data-working-capital-evidence-kind="collection" data-working-capital-evidence-id="${esc(item.partyId)}">شواهد</button>
        </div>`).join('')}</div>` : '<div class="success-box">مطالبه بازی برای اولویت‌بندی وصول دیده نشد.</div>'}
    </section>`;
}

function paymentHtml(items) {
  return `
    <section class="card">
      <div class="section-head">
        <div><h2>تقویم پرداختنی ۳۰ روزه</h2><span class="muted">تعهدات سررسیدشده و ۳۰ روز آینده را نشان می‌دهد؛ پرداخت فقط با اقدام کاربر انجام می‌شود.</span></div>
        <span class="summary-pill">${Number(items.length).toLocaleString('fa-IR')} تعهد</span>
      </div>
      ${items.length ? `<div class="avan-working-capital-list">${items.map(item => `
        <div class="avan-working-capital-row ${priorityClass(item.paymentPriority?.tier)}">
          <div class="avan-working-capital-row-main">
            <b>${item.invoiceNo ? `فاکتور ${esc(item.invoiceNo)}` : `سند ${esc(item.journalNo || '—')}`}</b>
            <span class="muted">سررسید ${esc(dateFa(item.dueDate))} · ${esc(item.paymentPriority?.label || '')}</span>
          </div>
          <div class="avan-working-capital-money"><span>مبلغ باز</span><b data-avan-number-output="1">${money(item.remaining)}</b></div>
          <button type="button" class="ghost small" data-working-capital-evidence="1" data-working-capital-evidence-kind="payment" data-working-capital-evidence-id="${esc(item.id)}">شواهد</button>
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
        ${metric('نقد پس از پوشش بدهی معوق و ۳۰ روزه', m.cashLessOverdueAnd30DayPayables, 'این عدد فقط تفاضل نقد فعلی با تعهدات شناسایی‌شده است.')}
      </div>

      ${collectionHtml(snapshot.collectionPriorities)}
      ${paymentHtml(snapshot.paymentCalendar)}

      <section class="card avan-working-capital-evidence-summary">
        <div class="section-head"><div><h2>گراف شواهد</h2><span class="muted">هر مانده باز به طرف‌حساب، سند، ردیف و فاکتور مربوط متصل است.</span></div><span class="cloud-badge">قابل ردیابی</span></div>
        <div class="avan-working-capital-evidence-kpis">
          <button type="button" class="summary-pill" data-working-capital-graph="nodes">${Number(snapshot.evidenceGraph.nodes.length).toLocaleString('fa-IR')} گره</button>
          <button type="button" class="summary-pill" data-working-capital-graph="edges">${Number(snapshot.evidenceGraph.edges.length).toLocaleString('fa-IR')} ارتباط</button>
        </div>
      </section>

      <div class="info-box">دقت پولی: یک ریال · تهاتر بین طرف‌حساب‌ها: غیرفعال · عملیات وصول خودکار: صفر · عملیات پرداخت خودکار: صفر · تغییر دفترکل: صفر</div>
    </div>`;
}

function allOpenItems() {
  return [
    ...(state?.snapshot?.receivables?.openItems || []),
    ...(state?.snapshot?.payables?.openItems || [])
  ];
}

function refMatches(candidate, ref) {
  return String(candidate?.type || '') === String(ref?.type || '') && String(candidate?.id || '') === String(ref?.id || '');
}

function relatedOpenItems(ref) {
  return allOpenItems().filter(item => (item.evidence || []).some(candidate => refMatches(candidate, ref)));
}

function partyNameForId(id, fallback = 'طرف‌حساب') {
  const rows = [
    ...(state?.snapshot?.receivables?.parties || []),
    ...(state?.snapshot?.payables?.parties || []),
    ...(state?.snapshot?.collectionPriorities || [])
  ];
  return rows.find(row => String(row.partyId || '') === String(id || ''))?.partyName || fallback;
}

function tenthsToCanonicalDecimal(tenths) {
  const sign = tenths < 0n ? '-' : '';
  const abs = tenths < 0n ? -tenths : tenths;
  return `${sign}${abs / 10n}${abs % 10n ? `.${abs % 10n}` : ''}`;
}

function sumRelatedAmount(items) {
  let total = 0n;
  for (const item of items) {
    const parsed = String(item.remaining ?? '0').match(/^(-?)(\d+)(?:\.(\d))?$/);
    if (!parsed) continue;
    const tenths = BigInt(parsed[2]) * 10n + BigInt(parsed[3] || '0');
    total += parsed[1] ? -tenths : tenths;
  }
  return total;
}

function humanEvidenceRef(ref, contextItem = null) {
  const related = relatedOpenItems(ref);
  const row = related[0] || (contextItem?.remaining !== undefined ? contextItem : null);
  const amountText = related.length ? money(tenthsToCanonicalDecimal(sumRelatedAmount(related))) : (row?.remaining !== undefined ? money(row.remaining) : null);

  if (ref?.type === 'party') {
    return {
      title: partyNameForId(ref.id, contextItem?.partyName || 'طرف‌حساب'),
      meta: 'طرف‌حساب مرتبط با این مانده'
    };
  }

  if (ref?.type === 'journal_entry') {
    const journal = row?.journalNo ?? '—';
    const parts = [
      row?.entryDate ? `تاریخ ${dateFa(row.entryDate)}` : null,
      row?.sourceType ? (sourceTypeFa[row.sourceType] || 'ثبت حسابداری') : null,
      amountText ? `مانده مرتبط ${amountText}` : null
    ].filter(Boolean);
    return { title: `سند حسابداری شماره ${journal}`, meta: parts.join(' · ') || 'سند مؤثر در مانده باز' };
  }

  if (ref?.type === 'journal_line') {
    const journal = row?.journalNo ?? '—';
    const parts = [
      row?.entryDate ? `تاریخ ${dateFa(row.entryDate)}` : null,
      row?.invoiceNo ? `فاکتور ${row.invoiceNo}` : null,
      amountText ? `مانده مرتبط ${amountText}` : null
    ].filter(Boolean);
    return { title: `ردیف مرتبط با سند شماره ${journal}`, meta: parts.join(' · ') || 'ردیف مؤثر در مانده باز' };
  }

  if (ref?.type === 'invoice') {
    const invoice = row?.invoiceNo ?? '—';
    const parts = [row?.dueDate ? `سررسید ${dateFa(row.dueDate)}` : null, amountText ? `مانده باز ${amountText}` : null].filter(Boolean);
    return { title: `فاکتور شماره ${invoice}`, meta: parts.join(' · ') || 'فاکتور مرتبط با این مانده' };
  }

  return { title: evidenceTypeFa[ref?.type] || 'مرجع حسابداری', meta: 'مرجع مؤثر در مانده باز' };
}

function evidenceListHtml(refs = [], contextItem = null) {
  const grouped = new Map();
  refs.forEach(ref => {
    if (!ref?.type || !ref?.id) return;
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref);
  });
  if (!grouped.size) return '<div class="empty">مرجع جزئی برای این ردیف موجود نیست.</div>';

  return [...grouped.entries()].map(([type, items]) => `
    <div class="card">
      <div class="section-head"><b>${esc(evidenceTypeFa[type] || 'مرجع حسابداری')}</b><span class="muted">${Number(items.length).toLocaleString('fa-IR')} مرجع</span></div>
      <div class="avan-working-capital-evidence-human-list">
        ${items.slice(0, 12).map(ref => {
          const human = humanEvidenceRef(ref, contextItem);
          return `<div class="avan-working-capital-evidence-human-row"><b>${esc(human.title)}</b><span class="muted">${esc(human.meta)}</span></div>`;
        }).join('')}
      </div>
      ${items.length > 12 ? `<span class="muted">و ${Number(items.length - 12).toLocaleString('fa-IR')} مرجع دیگر</span>` : ''}
    </div>`).join('');
}

function evidenceModal(title, refs = [], contextItem = null) {
  openModal(`
    <div data-working-capital-evidence-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">شواهد حسابداری مرتبط</span></div><span class="cloud-badge">فقط خواندنی</span></div>
      <div class="avan-working-capital-evidence-list">${evidenceListHtml(refs, contextItem)}</div>
      <div class="form-actions"><button type="button" class="ghost" data-working-capital-close>بستن</button></div>
    </div>`);
  document.querySelector('[data-working-capital-close]')?.addEventListener('click', closeModal, { once: true });
}

function openItemById(id) {
  return allOpenItems().find(item => String(item.id || '') === String(id || '')) || null;
}

function humanGraphNode(node) {
  if (node?.type === 'open_item') {
    const item = openItemById(node.id);
    if (!item) return { title: 'مانده باز', meta: 'مانده باز متصل به شواهد حسابداری' };
    const party = partyNameForId(item.partyId, 'طرف‌حساب');
    const doc = item.invoiceNo ? `فاکتور ${item.invoiceNo}` : `سند ${item.journalNo || '—'}`;
    return { title: `${doc} — ${party}`, meta: `مانده ${money(item.remaining)} · سررسید ${dateFa(item.dueDate)}` };
  }
  return humanEvidenceRef({ type: node?.type, id: node?.id });
}

function evidenceGraphModal(mode) {
  const graph = state?.snapshot?.evidenceGraph;
  if (!graph) return;
  const isEdges = mode === 'edges';
  const rows = isEdges ? graph.edges : graph.nodes;
  const title = isEdges ? 'ارتباط‌های گراف شواهد' : 'گره‌های گراف شواهد';
  const body = rows.slice(0, 40).map(row => {
    if (!isEdges) {
      const human = humanGraphNode(row);
      return `<div class="avan-working-capital-evidence-human-row"><b>${esc(human.title)}</b><span class="muted">${esc(human.meta)}</span></div>`;
    }
    const fromKey = String(row.from || '');
    const toKey = String(row.to || '');
    const fromNode = graph.nodes.find(node => node.key === fromKey);
    const toNode = graph.nodes.find(node => node.key === toKey);
    const from = humanGraphNode(fromNode);
    const to = humanGraphNode(toNode);
    return `<div class="avan-working-capital-evidence-human-row"><b>${esc(from.title)}</b><span class="muted">متصل به: ${esc(to.title)}${to.meta ? ` · ${esc(to.meta)}` : ''}</span></div>`;
  }).join('');

  openModal(`
    <div data-working-capital-graph-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">نمای حسابداری ارتباط مانده‌ها با اسناد و فاکتورها</span></div><span class="cloud-badge">${Number(rows.length).toLocaleString('fa-IR')} مورد</span></div>
      <div class="avan-working-capital-evidence-list"><div class="card"><div class="avan-working-capital-evidence-human-list">${body || '<div class="empty">موردی برای نمایش وجود ندارد.</div>'}</div>${rows.length > 40 ? `<span class="muted">۴۰ مورد نخست نمایش داده شده است؛ ${Number(rows.length - 40).toLocaleString('fa-IR')} مورد دیگر نیز در گراف وجود دارد.</span>` : ''}</div></div>
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
  root.querySelectorAll('[data-working-capital-evidence-kind]').forEach(button => button.addEventListener('click', () => {
    const kind = String(button.dataset.workingCapitalEvidenceKind || '');
    const id = String(button.dataset.workingCapitalEvidenceId || '');
    if (kind === 'collection') {
      const item = state.snapshot.collectionPriorities.find(row => String(row.partyId) === id);
      if (item) evidenceModal(`شواهد وصول — ${item.partyName}`, item.evidence, item);
      return;
    }
    if (kind === 'payment') {
      const item = state.snapshot.paymentCalendar.find(row => String(row.id) === id);
      if (item) evidenceModal('شواهد تعهد پرداختنی', item.evidence, item);
    }
  }));
  root.querySelectorAll('[data-working-capital-graph]').forEach(button => button.addEventListener('click', () => {
    evidenceGraphModal(String(button.dataset.workingCapitalGraph || 'nodes'));
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
