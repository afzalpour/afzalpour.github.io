'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { buildTransactionJournalSuggestion } from '../../core/reconciliation/transaction-journal-suggestion.js';

const C = installAvanCloud();
let latestSnapshot = null;
let latestAccounts = new Map();
let runToken = 0;

const SEVERITY_FA = Object.freeze({ critical: 'بحرانی', high: 'مهم', medium: 'نیازمند بررسی', info: 'اطلاعاتی' });
const CATEGORY_FA = Object.freeze({
  accounting: 'حسابداری', invoice: 'فاکتور', inventory: 'انبار', settlement: 'تسویه',
  cashbank: 'دریافت/پرداخت/انتقال', check: 'چک', smart_document: 'اسناد هوشمند', duplicate: 'احتمال تکرار'
});
const TX_FA = Object.freeze({ receipt: 'دریافت', payment: 'پرداخت', transfer: 'انتقال' });
const SUGGESTION_FA = Object.freeze({
  repair_source_link: 'مرجع مادر و زنجیره ارتباطی رکورد بررسی و در صورت نیاز از منبع معتبر بازسازی شود.',
  reverse_and_reenter: 'سند قطعی مستقیماً ویرایش نشود؛ علت عدم توازن بررسی و در صورت لزوم با برگشت و ثبت مجدد اصلاح شود.',
  rebuild_from_source: 'سند حسابداری باید از همان فاکتور و قواعد ثبت آوان بازسازی شود؛ ساخت سند دستی بدون کنترل منبع توصیه نمی‌شود.',
  review_invoice_totals: 'ردیف‌ها، جمع قبل از مالیات، مالیات و جمع نهایی فاکتور با Snapshot مالیاتی آن تطبیق داده شوند.',
  review_inventory_posting: 'زنجیره فاکتور ↔ سند انبار ↔ حرکت موجودی بررسی و ثبت انبار از منبع اصلی ترمیم شود.',
  review_settlement_plan: 'برنامه تسویه بازبینی شود تا جمع سررسیدها دقیقاً با جمع نهایی فاکتور برابر باشد.',
  review_settlement_posting: 'زنجیره تسویه و سند حسابداری آن بررسی شود؛ وضعیت تسویه بدون Evidence حسابداری قطعی تلقی نشود.',
  journal_from_transaction: 'برای این تراکنش، حساب‌ها و مبلغ منبع بدون ابهام هستند و سیستم می‌تواند یک سند پیشنهادی متوازن نمایش دهد.',
  review_check_posting: 'چرخه شناسایی/وصول/برگشت چک با سندهای حسابداری مربوط تطبیق داده شود.',
  review_document_link: 'لینک سند هوشمند به سند حسابداری بازبینی شود؛ فایل اصلی و Evidence استخراج‌شده حفظ می‌شوند.',
  review_duplicate: 'این مورد فقط شباهت قوی است؛ قبل از هر اصلاح باید کاربر اصل اسناد را بررسی کند.'
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function isReports(documentObject = document) {
  return documentObject.getElementById('pageTitle')?.textContent?.trim() === 'گزارش‌ها';
}

function faDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${value}T12:00:00`));
  } catch { return value; }
}

function money(value, withUnit = true) {
  if (value === null || value === undefined || value === '') return '—';
  if (!MoneyRuntime?.isReady()) return String(value);
  return MoneyRuntime.formatCanonicalDecimal(String(value), { withUnit });
}

function accountLabel(id, accounts) {
  const account = accounts.get(id);
  if (account) return `${account.code} — ${account.name}`;
  const short = String(id || '').slice(0, 8);
  return short ? `حساب مرجع ${short}` : 'حساب نامشخص';
}

function referenceLabel(finding) {
  if (finding.entity_no) return String(finding.entity_no);
  return String(finding.entity_id || '').slice(0, 8) || '—';
}

function proposalHtml(finding, accounts) {
  const proposal = buildTransactionJournalSuggestion(finding);
  if (!proposal) return '';
  return `<div class="avan-recon-proposal">
    <div class="section-head"><div><h4>پیشنهاد سند اصلاحی — ثبت نشده</h4><span class="muted">این فقط پیش‌نویس پیشنهادی است؛ هیچ سندی خودکار ایجاد یا Post نمی‌شود.</span></div><span class="badge">کنترل انسانی</span></div>
    <div class="muted">تاریخ پیشنهادی: ${esc(faDate(proposal.entry_date))} · ${esc(proposal.description)}</div>
    <div class="table-wrap"><table><thead><tr><th>حساب</th><th>بدهکار (${esc(MoneyRuntime.unitLabel())})</th><th>بستانکار (${esc(MoneyRuntime.unitLabel())})</th></tr></thead><tbody>
      ${proposal.lines.map(line => `<tr><td>${esc(accountLabel(line.account_id, accounts))}</td><td class="num">${esc(money(line.debit, false))}</td><td class="num">${esc(money(line.credit, false))}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
}

function evidenceHtml(finding) {
  const parts = [
    `<span><b>مرجع:</b> ${esc(referenceLabel(finding))}</span>`,
    finding.event_date ? `<span><b>تاریخ:</b> ${esc(faDate(finding.event_date))}</span>` : '',
    finding.amount !== null && finding.amount !== undefined ? `<span><b>مبلغ:</b> ${esc(money(finding.amount))}</span>` : ''
  ];
  if (finding.expected !== null && finding.expected !== undefined) parts.push(`<span><b>مورد انتظار:</b> ${esc(money(finding.expected))}</span>`);
  if (finding.actual !== null && finding.actual !== undefined) parts.push(`<span><b>ثبت‌شده:</b> ${esc(money(finding.actual))}</span>`);
  const duplicateCount = Number(finding.metadata?.duplicate_count || 0);
  if (duplicateCount > 1) parts.push(`<span><b>تعداد مشابه:</b> ${duplicateCount.toLocaleString('fa-IR')}</span>`);
  const txType = finding.metadata?.tx_type;
  if (TX_FA[txType]) parts.push(`<span><b>نوع تراکنش:</b> ${TX_FA[txType]}</span>`);
  return parts.filter(Boolean).join('');
}

function findingHtml(finding, accounts) {
  const severity = SEVERITY_FA[finding.severity] || 'نیازمند بررسی';
  const category = CATEGORY_FA[finding.category] || 'کنترل داخلی';
  const action = SUGGESTION_FA[finding.suggestion_type] || 'منبع و سندهای مرتبط بررسی شوند.';
  return `<article class="card avan-recon-finding" data-severity="${esc(finding.severity)}" data-category="${esc(finding.category)}">
    <div class="section-head"><div><h3>${esc(finding.title || 'مغایرت')}</h3><span class="muted">${esc(category)}</span></div><span class="badge avan-recon-severity avan-recon-${esc(finding.severity)}">${esc(severity)}</span></div>
    <p>${esc(finding.description || '')}</p>
    <div class="avan-recon-evidence">${evidenceHtml(finding)}</div>
    <div class="info-box"><b>اقدام پیشنهادی:</b> ${esc(action)}</div>
    ${proposalHtml(finding, accounts)}
  </article>`;
}

function filteredFindings(snapshot, severity, category) {
  const rows = Array.isArray(snapshot?.findings) ? snapshot.findings : [];
  return rows.filter(item => (!severity || item.severity === severity) && (!category || item.category === category));
}

function workspaceHtml(snapshot, accounts, severity = '', category = '') {
  const summary = snapshot?.summary || {};
  const findings = filteredFindings(snapshot, severity, category);
  const categories = [...new Set((snapshot?.findings || []).map(item => item.category).filter(Boolean))];
  return `<section class="avan-reconciliation-workspace" data-avan-reconciliation-workspace="1">
    <div class="section-head avan-recon-head"><div><h2 data-report-title>مغایرت‌یابی هوشمند</h2><span class="muted">کنترل هم‌زمان دفتر حسابداری، فاکتور، انبار، تسویه، دریافت/پرداخت/انتقال، چک و اسناد هوشمند</span></div><button type="button" class="ghost" data-recon-refresh>اجرای مجدد</button></div>
    <div class="info-box">این موتور بر پایه شواهد و قواعد حسابداری/یکپارچگی کار می‌کند. موارد «احتمال تکرار» هشدار قطعی نیستند. پیشنهاد سند هرگز به معنی ثبت خودکار نیست و مسیر نهایی همچنان پیش‌نویس → تأیید کاربر → ثبت قطعی است.</div>
    <div class="summary-strip avan-recon-summary">
      <span class="summary-pill"><b>${Number(summary.total || 0).toLocaleString('fa-IR')}</b> کل یافته</span>
      <span class="summary-pill"><b>${Number(summary.critical || 0).toLocaleString('fa-IR')}</b> بحرانی</span>
      <span class="summary-pill"><b>${Number(summary.high || 0).toLocaleString('fa-IR')}</b> مهم</span>
      <span class="summary-pill"><b>${Number(summary.medium || 0).toLocaleString('fa-IR')}</b> نیازمند بررسی</span>
    </div>
    <div class="filters avan-recon-filters">
      <div class="field"><label>شدت</label><select data-recon-filter-severity><option value="">همه شدت‌ها</option>${Object.entries(SEVERITY_FA).map(([key,label]) => `<option value="${key}" ${severity===key?'selected':''}>${label}</option>`).join('')}</select></div>
      <div class="field"><label>حوزه</label><select data-recon-filter-category><option value="">همه حوزه‌ها</option>${categories.map(key => `<option value="${esc(key)}" ${category===key?'selected':''}>${esc(CATEGORY_FA[key] || 'کنترل داخلی')}</option>`).join('')}</select></div>
    </div>
    <div class="avan-recon-results">${findings.length ? findings.map(item => findingHtml(item, accounts)).join('') : '<div class="empty">در فیلتر انتخاب‌شده مغایرتی یافت نشد.</div>'}</div>
    <p class="muted avan-recon-foot">زمان آخرین تحلیل: ${esc(new Date(snapshot?.generated_at || Date.now()).toLocaleString('fa-IR'))}</p>
  </section>`;
}

function installStyle(documentObject) {
  if (documentObject.getElementById('avanReconciliationStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanReconciliationStyle';
  style.textContent = `
    .avan-reconciliation-workspace{display:flex;flex-direction:column;gap:14px;direction:rtl}
    .avan-recon-head{justify-content:center!important;text-align:center!important}
    .avan-recon-head>div{flex:1;text-align:center!important}.avan-recon-head h2{text-align:center!important;margin:0}
    .avan-recon-filters{align-items:end}.avan-recon-filters .field{min-width:190px}
    .avan-recon-results{display:grid;gap:12px}.avan-recon-finding{padding:16px}.avan-recon-finding h3{margin:0;font-size:15px}
    .avan-recon-evidence{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 12px;color:var(--muted);font-size:12px}
    .avan-recon-evidence span{background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:6px 9px}
    .avan-recon-critical{color:var(--bad)!important;background:var(--bad-soft)!important}.avan-recon-high{color:var(--warn)!important;background:var(--warn-soft)!important}
    .avan-recon-proposal{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.avan-recon-proposal h4{margin:0 0 4px}.avan-recon-proposal th{text-align:center!important}
    .avan-recon-launcher{display:flex;justify-content:center;margin:10px 0}.avan-recon-launcher button{min-width:190px}
    @media(max-width:700px){.avan-recon-filters{display:grid;grid-template-columns:1fr}.avan-recon-filters .field{min-width:0}}
  `;
  documentObject.head.append(style);
}

function bindWorkspace(out, snapshot, accounts) {
  const rerender = () => {
    const severity = out.querySelector('[data-recon-filter-severity]')?.value || '';
    const category = out.querySelector('[data-recon-filter-category]')?.value || '';
    out.innerHTML = workspaceHtml(snapshot, accounts, severity, category);
    bindWorkspace(out, snapshot, accounts);
    window.AvanMoneyOutput?.project?.();
  };
  out.querySelector('[data-recon-filter-severity]')?.addEventListener('change', rerender);
  out.querySelector('[data-recon-filter-category]')?.addEventListener('change', rerender);
  out.querySelector('[data-recon-refresh]')?.addEventListener('click', () => runReconciliation(out, true));
}

async function runReconciliation(out, force = false) {
  const token = ++runToken;
  out.innerHTML = '<div class="loading">در حال مقایسه اسناد حسابداری، فاکتورها، انبار، تسویه‌ها، بانک/صندوق، چک‌ها و اسناد هوشمند…</div>';
  try {
    const state = await C.companyContext.ensure();
    const wid = state?.active_company?.id;
    if (!wid) throw new Error('COMPANY_REQUIRED');
    if (!force && latestSnapshot?.workspace_id === wid) {
      out.innerHTML = workspaceHtml(latestSnapshot, latestAccounts);
      bindWorkspace(out, latestSnapshot, latestAccounts);
      window.AvanMoneyOutput?.project?.();
      return;
    }
    const [snapshot, accounts] = await Promise.all([
      C.rpc('avan_reconciliation_findings', { wid }),
      C.select('accounts', `select=id,code,name&workspace_id=eq.${wid}&order=code.asc`)
    ]);
    if (token !== runToken || !out.isConnected) return;
    latestSnapshot = snapshot || { workspace_id: wid, findings: [], summary: {} };
    latestAccounts = new Map((accounts || []).map(account => [account.id, account]));
    out.innerHTML = workspaceHtml(latestSnapshot, latestAccounts);
    bindWorkspace(out, latestSnapshot, latestAccounts);
    window.AvanMoneyOutput?.project?.();
  } catch (error) {
    console.error('[Reconciliation intelligence]', error);
    if (token !== runToken || !out.isConnected) return;
    out.innerHTML = '<div class="error-box">اجرای مغایرت‌یابی انجام نشد. دسترسی شرکت و اتصال داده را بررسی کنید.</div>';
  }
}

function setStandardReportChrome(content, visible) {
  content.querySelectorAll('.report-toolbar,.ledger-select').forEach(node => { node.hidden = !visible; });
}

function activateReconciliation(button, content, out) {
  content.querySelectorAll('[data-r],[data-avan-reconciliation-tab]').forEach(node => node.classList.remove('active'));
  button.classList.add('active');
  out.dataset.avanReconciliationActive = '1';
  setStandardReportChrome(content, false);
  void runReconciliation(out, true);
}

function ensureEntryPoint(documentObject, content, out) {
  const existing = content.querySelector('[data-avan-reconciliation-tab]');
  if (existing) return existing;

  const standardTabs = [...content.querySelectorAll('[data-r]')];
  const button = documentObject.createElement('button');
  button.type = 'button';
  button.dataset.avanReconciliationTab = '1';
  button.textContent = 'مغایرت‌یابی هوشمند';
  button.addEventListener('click', () => activateReconciliation(button, content, out));

  if (standardTabs.length) {
    const last = standardTabs[standardTabs.length - 1];
    last.insertAdjacentElement('afterend', button);
  } else {
    const launcher = documentObject.createElement('div');
    launcher.className = 'avan-recon-launcher card';
    launcher.dataset.avanReconciliationLauncher = '1';
    launcher.append(button);
    out.before(launcher);
  }
  return button;
}

export function projectReconciliationWorkspace(documentObject = document) {
  if (!isReports(documentObject)) return false;
  const content = documentObject.getElementById('content');
  const out = documentObject.getElementById('reportOut');
  if (!content || !out) return false;
  installStyle(documentObject);
  ensureEntryPoint(documentObject, content, out);
  return true;
}

export function installReconciliationWorkspace({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanReconciliation?.installed) return globalObject.AvanReconciliation;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('reports:reconciliation-workspace', () => projectReconciliationWorkspace(documentObject), { priority: 960 });
  const scheduleBurst = reason => [0, 60, 180, 500].forEach(delay => globalObject.setTimeout(() => Lifecycle.schedule(`${reason}-${delay}`), delay));
  globalObject.addEventListener('avan:page-rendered', () => scheduleBurst('reconciliation-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('reconciliation-ui'));
  documentObject.addEventListener('click', event => {
    const standardTab = event.target.closest?.('[data-r]');
    if (standardTab && isReports(documentObject)) {
      const content = documentObject.getElementById('content');
      const out = documentObject.getElementById('reportOut');
      content?.querySelector('[data-avan-reconciliation-tab]')?.classList.remove('active');
      if (out) delete out.dataset.avanReconciliationActive;
      if (content) setStandardReportChrome(content, true);
      scheduleBurst('reconciliation-standard-tab');
      globalObject.AvanMoneyOutput?.project?.();
      return;
    }
    if (event.target.closest?.('[data-page="reports"]')) scheduleBurst('reconciliation-nav');
  }, true);
  globalObject.addEventListener('avan:company-context-changed', () => {
    latestSnapshot = null;
    latestAccounts = new Map();
    scheduleBurst('reconciliation-company');
  });
  const api = Object.freeze({
    installed: true,
    project: () => projectReconciliationWorkspace(documentObject),
    refresh: () => {
      const out = documentObject.getElementById('reportOut');
      return out ? runReconciliation(out, true) : null;
    }
  });
  globalObject.AvanReconciliation = api;
  scheduleBurst('reconciliation-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installReconciliationWorkspace();
