'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createControlTowerSnapshotService } from '../../application/intelligence/control-tower-snapshot-service.js';
import { createFinancialDigitalTwinService } from '../../application/intelligence/financial-digital-twin-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const ControlTowerService = HAS_BROWSER ? createControlTowerSnapshotService({ cloud: C }) : null;
const Service = HAS_BROWSER ? createFinancialDigitalTwinService({ controlTowerService: ControlTowerService }) : null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const FLOW_LABELS = Object.freeze({
  revenue: 'فروش نقدی جدید',
  collections: 'وصول مطالبات',
  operatingCosts: 'هزینه‌های نقدی عملیاتی',
  payments: 'پرداخت بدهی‌ها'
});

const EVIDENCE_TYPE_FA = Object.freeze({
  financial_account: 'حساب مالی',
  journal_entry: 'سند حسابداری',
  journal_line: 'ردیف سند',
  user_input: 'فرض واردشده توسط کاربر'
});

const SOURCE_TYPE_FA = Object.freeze({
  invoice: 'فاکتور',
  receipt: 'دریافت',
  payment: 'پرداخت',
  transfer: 'انتقال',
  manual: 'سند دستی',
  opening: 'افتتاحیه',
  reversal: 'برگشت سند'
});

const FINANCIAL_KIND_FA = Object.freeze({
  bank: 'حساب بانکی',
  cash: 'صندوق',
  card: 'کارت',
  wallet: 'کیف پول',
  other: 'حساب مالی'
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function money(value, { withUnit = true } = {}) {
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0'), { withUnit }) || '—';
}

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .replace(/,/g, '.');
}

function percentToBps(value, field) {
  const normalized = normalizeDigits(value).trim();
  const number = Number(normalized || '0');
  if (!Number.isFinite(number) || number < -100 || number > 10000) {
    const error = new Error(`DIGITAL_TWIN_INVALID_PERCENT:${field}`);
    error.userMessage = 'درصد تغییر باید عددی بین ۱۰۰- تا ۱۰٬۰۰۰ باشد.';
    throw error;
  }
  const bps = Math.round(number * 100);
  if (Math.abs(bps / 100 - number) > 1e-9) {
    const error = new Error(`DIGITAL_TWIN_PERCENT_PRECISION:${field}`);
    error.userMessage = 'درصد تغییر حداکثر می‌تواند دو رقم اعشار داشته باشد.';
    throw error;
  }
  return bps;
}

function parseMoneyInput(value, label, { allowNegative = false } = {}) {
  const raw = String(value ?? '').trim() || '0';
  const parsed = MoneyRuntime?.parseInput?.(raw);
  if (!parsed?.ok) {
    const error = new Error(parsed?.code || 'DIGITAL_TWIN_INVALID_MONEY');
    error.userMessage = `${label} معتبر نیست.`;
    throw error;
  }
  const canonical = String(parsed.value);
  if (!allowNegative && canonical.startsWith('-')) {
    const error = new Error('DIGITAL_TWIN_NEGATIVE_FLOW');
    error.userMessage = `${label} نمی‌تواند منفی باشد.`;
    throw error;
  }
  return canonical;
}

function defaults() {
  const from = today();
  return {
    from,
    to: addDaysIso(from, 30),
    revenue: '0',
    collections: '0',
    operatingCosts: '0',
    payments: '0',
    revenueChange: '0',
    collectionChange: '0',
    operatingCostChange: '0',
    paymentChange: '0',
    oneOffCashImpact: '0'
  };
}

function inputValue(form, key) {
  return esc(form[key] ?? '0');
}

function formHtml({ prepared, form }) {
  return `
    <form class="card avan-twin-form" data-digital-twin-form>
      <div class="section-head">
        <div>
          <h2>فرض‌های سناریو</h2>
          <span class="muted">تمام جریان‌های آینده را شما وارد می‌کنید؛ آوان مبلغ آینده را حدس نمی‌زند.</span>
        </div>
        <span class="cloud-badge">بدون ثبت در حسابداری</span>
      </div>

      <div class="avan-twin-horizon-grid section">
        <div class="field"><label>از تاریخ</label><input type="date" name="from" value="${inputValue(form, 'from')}" required></div>
        <div class="field"><label>تا تاریخ</label><input type="date" name="to" value="${inputValue(form, 'to')}" required></div>
        <div class="avan-twin-opening card">
          <span class="kpi-label">نقد و بانک ابتدای سناریو</span>
          <strong class="kpi-value" data-avan-number-output="1">${money(prepared.opening.cash)}</strong>
          <span class="muted">مانده واقعی تا پایان ${dateFa(prepared.opening.asOf)}</span>
          <button type="button" class="ghost small" data-digital-twin-opening-evidence>منشأ این عدد</button>
        </div>
      </div>

      <div class="section-head avan-twin-subhead"><div><h3>حالت مبنا</h3><span class="muted">برآورد نقدی پایه برای همین بازه؛ مبالغ تعهدی که نقد نمی‌شوند اینجا وارد نشوند.</span></div></div>
      <div class="grid4 avan-twin-input-grid">
        <div class="field"><label>فروش نقدی جدید</label><input type="text" inputmode="decimal" name="revenue" value="${inputValue(form, 'revenue')}" required><small>فقط اثر نقدی فروش جدید؛ فروش نسیه در این فیلد وارد نمی‌شود.</small></div>
        <div class="field"><label>وصول مطالبات</label><input type="text" inputmode="decimal" name="collections" value="${inputValue(form, 'collections')}" required><small>دریافت از مانده‌های دریافتنی قبلی.</small></div>
        <div class="field"><label>هزینه‌های نقدی عملیاتی</label><input type="text" inputmode="decimal" name="operatingCosts" value="${inputValue(form, 'operatingCosts')}" required><small>خروج نقدی هزینه‌ها در همین بازه.</small></div>
        <div class="field"><label>پرداخت بدهی‌ها</label><input type="text" inputmode="decimal" name="payments" value="${inputValue(form, 'payments')}" required><small>تسویه بدهی‌ها و پرداختنی‌ها در همین بازه.</small></div>
      </div>

      <div class="section-head avan-twin-subhead"><div><h3>تغییرات سناریو نسبت به مبنا</h3><span class="muted">برای کاهش، درصد منفی و برای افزایش، درصد مثبت وارد کنید.</span></div></div>
      <div class="grid4 avan-twin-input-grid">
        <div class="field"><label>تغییر فروش نقدی</label><div class="avan-twin-percent"><input type="text" inputmode="decimal" name="revenueChange" value="${inputValue(form, 'revenueChange')}"><span>٪</span></div></div>
        <div class="field"><label>تغییر وصول مطالبات</label><div class="avan-twin-percent"><input type="text" inputmode="decimal" name="collectionChange" value="${inputValue(form, 'collectionChange')}"><span>٪</span></div></div>
        <div class="field"><label>تغییر هزینه‌های نقدی</label><div class="avan-twin-percent"><input type="text" inputmode="decimal" name="operatingCostChange" value="${inputValue(form, 'operatingCostChange')}"><span>٪</span></div></div>
        <div class="field"><label>تغییر پرداخت بدهی‌ها</label><div class="avan-twin-percent"><input type="text" inputmode="decimal" name="paymentChange" value="${inputValue(form, 'paymentChange')}"><span>٪</span></div></div>
      </div>
      <div class="field avan-twin-oneoff">
        <label>اثر نقدی یک‌باره سناریو</label>
        <input type="text" inputmode="decimal" name="oneOffCashImpact" value="${inputValue(form, 'oneOffCashImpact')}">
        <small>ورودی نقدی را مثبت و خروج نقدی را منفی وارد کنید؛ مثال: جریمه، سرمایه‌گذاری مالک یا خرید یک‌باره.</small>
      </div>

      <div class="form-actions avan-twin-actions">
        <button type="submit" class="primary">محاسبه سناریو</button>
        <button type="button" class="ghost" data-digital-twin-reset>بازنشانی</button>
        <button type="button" class="ghost" data-digital-twin-control-tower>بازگشت به برج کنترل</button>
      </div>
    </form>
  `;
}

function resultTable(result) {
  const base = result.scenario.base;
  const scenario = result.scenario.scenario;
  return `
    <div class="avan-twin-table-wrap">
      <table class="avan-twin-table">
        <thead><tr><th>مولفه نقدی</th><th>حالت مبنا</th><th>سناریو</th></tr></thead>
        <tbody>
          ${Object.keys(FLOW_LABELS).map(key => `<tr><td>${FLOW_LABELS[key]}</td><td class="num">${money(base[key])}</td><td class="num">${money(scenario[key])}</td></tr>`).join('')}
          <tr><td>اثر نقدی یک‌باره</td><td class="num">—</td><td class="num">${money(scenario.oneOffCashImpact)}</td></tr>
          <tr class="avan-twin-total-row"><td>نقد و بانک پایان بازه</td><td class="num">${money(base.endingCash)}</td><td class="num">${money(scenario.endingCash)}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function resultsHtml(result) {
  const scenario = result.scenario;
  const stressed = scenario.liquidity.scenarioStatus === 'stressed';
  const rounded = scenario.precision.disclosures || [];
  const roundedFields = [...new Set(rounded.map(item => FLOW_LABELS[item.field] || item.field))];
  return `
    <section class="card avan-twin-results ${stressed ? 'stressed' : 'healthy'}" data-digital-twin-results>
      <div class="section-head">
        <div><h2>مقایسه حالت مبنا و سناریو</h2><span class="muted">از ${dateFa(scenario.horizon.from)} تا ${dateFa(scenario.horizon.to)}</span></div>
        <span class="cloud-badge">${stressed ? 'تنش نقدینگی' : 'نقدینگی غیرمنفی'}</span>
      </div>

      <div class="grid3 avan-twin-result-kpis section">
        <div class="card"><span class="kpi-label">پایان حالت مبنا</span><strong class="kpi-value" data-avan-number-output="1">${money(scenario.base.endingCash)}</strong></div>
        <div class="card"><span class="kpi-label">پایان سناریو</span><strong class="kpi-value" data-avan-number-output="1">${money(scenario.scenario.endingCash)}</strong></div>
        <div class="card"><span class="kpi-label">تفاوت سناریو با مبنا</span><strong class="kpi-value" data-avan-number-output="1">${money(scenario.scenario.deltaEndingCash)}</strong></div>
      </div>

      ${resultTable(result)}

      ${rounded.length ? `<div class="info-box section">برای حفظ دقت یک‌ریال، نتیجه درصدی ${Number(rounded.length).toLocaleString('fa-IR')} محاسبه دارای باقیمانده زیرِ ریال بود و با قاعده نزدیک‌ترین ریال گرد شد. مولفه‌ها: ${roundedFields.map(esc).join('، ')}.</div>` : '<div class="success-box section">این سناریو در محاسبات درصدی نیاز به گرد کردن زیرِ ریال نداشت.</div>'}

      <div class="info-box">این خروجی فقط سناریو است. هیچ سند حسابداری، دریافت، پرداخت یا مانده واقعی با این محاسبه تغییر نکرده است.</div>
    </section>
  `;
}

export function financialDigitalTwinPageHtml({ prepared, form, result = null }) {
  return `
    <div class="avan-financial-digital-twin" data-financial-digital-twin-page>
      <section class="card avan-twin-hero">
        <div>
          <div class="eyebrow">آزمایش امن تصمیم مالی</div>
          <h2>دوقلوی مالی کسب‌وکار</h2>
          <p class="muted">اثر تغییر فروش نقدی، وصول، هزینه و پرداخت را قبل از تصمیم واقعی روی نقدینگی «${esc(prepared.workspace.name)}» ببینید.</p>
        </div>
        <div class="avan-twin-contract-badges"><span class="summary-pill">دقت یک‌ریال</span><span class="summary-pill">بدون تغییر دفترکل</span><span class="summary-pill">فرض‌های صریح کاربر</span></div>
      </section>
      ${formHtml({ prepared, form })}
      ${result ? resultsHtml(result) : '<div class="info-box">مبالغ حالت مبنا و درصدهای تغییر را وارد کنید و «محاسبه سناریو» را بزنید. تا زمانی که محاسبه نکنید هیچ عدد آینده‌ای ساخته نمی‌شود.</div>'}
    </div>
  `;
}

let state = null;
let installed = false;

function setTwinNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-digital-twin-nav]')?.classList.toggle('active', Boolean(active));
}

function uniqueEvidenceIds(prepared, type, limit = 12) {
  return [...new Set((prepared?.opening?.evidence || [])
    .filter(ref => ref?.type === type && UUID_RE.test(String(ref?.id || '')))
    .map(ref => String(ref.id)))]
    .slice(0, limit);
}

async function loadOpeningEvidenceDetails(prepared) {
  if (!C?.select || !UUID_RE.test(String(prepared?.workspace?.id || ''))) {
    return { financialById: new Map(), accountById: new Map(), journalById: new Map() };
  }

  const workspaceId = String(prepared.workspace.id);
  const financialIds = uniqueEvidenceIds(prepared, 'financial_account');
  const journalIds = uniqueEvidenceIds(prepared, 'journal_entry');
  const [financialAccounts, journalEntries] = await Promise.all([
    financialIds.length
      ? C.select('financial_accounts', `select=id,ledger_account_id,kind,bank_name&workspace_id=eq.${workspaceId}&id=in.(${financialIds.join(',')})`)
      : Promise.resolve([]),
    journalIds.length
      ? C.select('journal_entries', `select=id,journal_no,entry_date,source_type,description&workspace_id=eq.${workspaceId}&id=in.(${journalIds.join(',')})`)
      : Promise.resolve([])
  ]);

  const financialById = new Map((financialAccounts || []).map(row => [String(row.id), row]));
  const ledgerIds = [...new Set((financialAccounts || [])
    .map(row => String(row?.ledger_account_id || ''))
    .filter(id => UUID_RE.test(id)))];
  const accounts = ledgerIds.length
    ? await C.select('accounts', `select=id,code,name&workspace_id=eq.${workspaceId}&id=in.(${ledgerIds.join(',')})`)
    : [];

  return {
    financialById,
    accountById: new Map((accounts || []).map(row => [String(row.id), row])),
    journalById: new Map((journalEntries || []).map(row => [String(row.id), row]))
  };
}

function humanOpeningEvidence(ref, details) {
  if (ref?.type === 'financial_account') {
    const financial = details?.financialById?.get(String(ref.id));
    const account = financial?.ledger_account_id
      ? details?.accountById?.get(String(financial.ledger_account_id))
      : null;
    const kind = FINANCIAL_KIND_FA[String(financial?.kind || '')] || 'حساب مالی';
    const title = financial?.bank_name ? `${kind} — ${financial.bank_name}` : kind;
    const meta = [
      account?.code ? `کد حساب ${account.code}` : null,
      account?.name || null
    ].filter(Boolean).join(' · ') || 'حساب مؤثر در مانده نقد و بانک';
    return { title, meta };
  }

  if (ref?.type === 'journal_entry') {
    const journal = details?.journalById?.get(String(ref.id));
    const title = journal?.journal_no !== null && journal?.journal_no !== undefined
      ? `سند حسابداری شماره ${journal.journal_no}`
      : 'سند حسابداری مؤثر در مانده نقد';
    const meta = [
      journal?.entry_date ? `تاریخ ${dateFa(String(journal.entry_date).slice(0, 10))}` : null,
      journal?.source_type ? (SOURCE_TYPE_FA[journal.source_type] || 'منبع حسابداری') : null,
      journal?.description || null
    ].filter(Boolean).join(' · ') || 'سند ثبت‌شده مؤثر در مانده نقد و بانک';
    return { title, meta };
  }

  return {
    title: EVIDENCE_TYPE_FA[ref?.type] || 'مرجع حسابداری',
    meta: 'مرجع ثبت‌شده در گراف شواهد آوان'
  };
}

function openingEvidenceListHtml(prepared, details) {
  const grouped = new Map();
  (prepared?.opening?.evidence || []).forEach(ref => {
    if (!ref?.type || !ref?.id) return;
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref);
  });

  if (!grouped.size) return '<div class="empty">مرجع جزئی برای نمایش وجود ندارد.</div>';

  return [...grouped.entries()].map(([type, refs]) => `
    <div class="card">
      <div class="section-head"><b>${esc(EVIDENCE_TYPE_FA[type] || 'مرجع حسابداری')}</b><span class="muted">${Number(refs.length).toLocaleString('fa-IR')} مرجع</span></div>
      <div class="avan-twin-evidence-human-list">
        ${refs.slice(0, 12).map(ref => {
          const human = humanOpeningEvidence(ref, details);
          return `<div class="avan-twin-evidence-human-row"><b>${esc(human.title)}</b><span class="muted">${esc(human.meta)}</span></div>`;
        }).join('')}
      </div>
      ${refs.length > 12 ? `<span class="muted">و ${Number(refs.length - 12).toLocaleString('fa-IR')} مرجع دیگر</span>` : ''}
    </div>`).join('');
}

async function openingEvidenceModal(prepared) {
  openModal(`
    <div data-digital-twin-evidence-modal>
      <div class="section-head"><div><h2>منشأ نقد و بانک ابتدای سناریو</h2><span class="muted">در حال آماده‌سازی شواهد حسابداری…</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="loading">در حال خواندن عنوان حساب‌ها و اسناد مؤثر…</div>
    </div>
  `);

  let details = { financialById: new Map(), accountById: new Map(), journalById: new Map() };
  try {
    details = await loadOpeningEvidenceDetails(prepared);
  } catch (error) {
    console.error('[Avan Financial Digital Twin evidence]', error);
  }

  openModal(`
    <div data-digital-twin-evidence-modal>
      <div class="section-head"><div><h2>منشأ نقد و بانک ابتدای سناریو</h2><span class="muted">مانده واقعی تا پایان ${dateFa(prepared.opening.asOf)}</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="info-box">${esc(prepared.opening.explanation || 'این عدد از حساب‌های مالی فعال و اسناد ثبت‌شده شرکت محاسبه شده است.')}</div>
      <div class="section avan-twin-evidence-list">${openingEvidenceListHtml(prepared, details)}</div>
      <div class="form-actions"><button type="button" class="ghost" data-digital-twin-close-evidence>بستن</button></div>
    </div>
  `);
  document.querySelector('[data-digital-twin-close-evidence]')?.addEventListener('click', closeModal, { once: true });
}

function collectForm(formElement) {
  const data = new FormData(formElement);
  const form = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
  if (!form.from || !form.to || form.from > form.to) {
    const error = new Error('DIGITAL_TWIN_HORIZON_INVALID');
    error.userMessage = 'بازه سناریو معتبر نیست.';
    throw error;
  }
  return {
    form,
    baseline: {
      revenue: parseMoneyInput(form.revenue, 'فروش نقدی جدید'),
      collections: parseMoneyInput(form.collections, 'وصول مطالبات'),
      operatingCosts: parseMoneyInput(form.operatingCosts, 'هزینه‌های نقدی عملیاتی'),
      payments: parseMoneyInput(form.payments, 'پرداخت بدهی‌ها')
    },
    assumptions: {
      revenueChangeBps: percentToBps(form.revenueChange, 'revenue'),
      collectionChangeBps: percentToBps(form.collectionChange, 'collections'),
      operatingCostChangeBps: percentToBps(form.operatingCostChange, 'operatingCosts'),
      paymentChangeBps: percentToBps(form.paymentChange, 'payments'),
      oneOffCashImpact: parseMoneyInput(form.oneOffCashImpact, 'اثر نقدی یک‌باره', { allowNegative: true })
    }
  };
}

function bindActions() {
  const root = document.querySelector('[data-financial-digital-twin-page]');
  if (!root || !state) return;

  root.querySelector('[data-digital-twin-opening-evidence]')?.addEventListener('click', () => void openingEvidenceModal(state.prepared));
  root.querySelector('[data-digital-twin-reset]')?.addEventListener('click', () => void openFinancialDigitalTwin(defaults()));
  root.querySelector('[data-digital-twin-control-tower]')?.addEventListener('click', () => window.AvanControlTower?.open?.());

  root.querySelector('[data-digital-twin-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    void (async () => {
      try {
        const input = collectForm(event.currentTarget);
        page('<div class="loading">در حال محاسبه سناریوی نقدینگی…</div>');
        const prepared = await Service.prepare({ from: input.form.from, to: input.form.to });
        const result = Service.run({ prepared, baseline: input.baseline, assumptions: input.assumptions });
        state = { prepared, form: input.form, result };
        page(financialDigitalTwinPageHtml(state));
        setTwinNavActive(true);
        bindActions();
      } catch (error) {
        console.error('[Avan Financial Digital Twin]', error);
        toast(error?.userMessage || 'محاسبه سناریو انجام نشد. ورودی‌ها را بررسی کنید.');
        if (state) {
          page(financialDigitalTwinPageHtml(state));
          setTwinNavActive(true);
          bindActions();
        }
      }
    })();
  });
}

export async function openFinancialDigitalTwin(initialForm = null) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    await MoneyRuntime?.ready?.();
    const form = { ...defaults(), ...(initialForm || {}) };
    setTitle('دوقلوی مالی');
    setTwinNavActive(true);
    page('<div class="loading">در حال خواندن مانده واقعی نقد و بانک…</div>');
    const prepared = await Service.prepare({ from: form.from, to: form.to });
    state = { prepared, form, result: null };
    page(financialDigitalTwinPageHtml(state));
    setTwinNavActive(true);
    bindActions();
    return state;
  } catch (error) {
    console.error('[Avan Financial Digital Twin]', error);
    page(`<div class="error-box">دوقلوی مالی در این لحظه قابل آماده‌سازی نیست: ${esc(error?.userMessage || error?.message || error)}</div>`);
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-digital-twin-nav]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.digitalTwinNav = '1';
  button.innerHTML = '<span>◇</span>دوقلوی مالی';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    void openFinancialDigitalTwin();
  });
  const controlTower = nav.querySelector('[data-control-tower-nav]');
  if (controlTower) controlTower.insertAdjacentElement('afterend', button);
  else nav.append(button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-digital-twin-report-launcher]')) return;
  const card = document.createElement('section');
  card.className = 'card avan-control-tower-report-launcher avan-digital-twin-report-launcher';
  card.dataset.digitalTwinReportLauncher = '1';
  card.innerHTML = '<div><b>◇ دوقلوی مالی</b><span class="muted">آزمایش فروش نقدی، وصول، هزینه و پرداخت قبل از تصمیم واقعی</span></div><button type="button" class="primary">ساخت سناریو</button>';
  card.querySelector('button')?.addEventListener('click', () => void openFinancialDigitalTwin());
  content.prepend(card);
}

function enhanceControlTowerPreview() {
  const preview = document.querySelector('.avan-control-tower-twin-preview');
  if (!preview || preview.querySelector('[data-open-digital-twin]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.dataset.openDigitalTwin = '1';
  button.textContent = 'ساخت سناریوی نقدینگی';
  button.addEventListener('click', () => void openFinancialDigitalTwin());
  preview.append(button);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title === 'برج کنترل مالی') enhanceControlTowerPreview();
  if (title !== 'دوقلوی مالی') document.querySelector('[data-digital-twin-nav]')?.classList.remove('active');
}

export function installFinancialDigitalTwinWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => {
    if (document.querySelector('[data-financial-digital-twin-page]')) void openFinancialDigitalTwin(state?.form || defaults());
  });
  const title = document.getElementById('pageTitle')?.textContent || '';
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title === 'برج کنترل مالی') enhanceControlTowerPreview();
  window.AvanFinancialDigitalTwin = Object.freeze({ open: openFinancialDigitalTwin });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFinancialDigitalTwinWorkspace, { once: true });
  else installFinancialDigitalTwinWorkspace();
}
