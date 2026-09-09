'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { openModal, closeModal } from '../components/modal.js';
import { MoneyRuntime } from '../money/money-runtime.js';

const C = installAvanCloud();
const HEALTH_GROUPS = Object.freeze([
  Object.freeze({ code: 'orphan_journal_line', label: 'ردیف حسابداری بدون سند', match: /ردیف.*بدون سند/u }),
  Object.freeze({ code: 'posted_invoice_missing_journal', label: 'فاکتور بدون سند', match: /فاکتور بدون سند/u }),
  Object.freeze({ code: 'invoice_total_mismatch', label: 'اختلاف جمع فاکتور', match: /اختلاف جمع فاکتور/u })
]);

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function trailingCount(text) {
  const match = latinDigits(text).match(/(\d+)\s*$/u);
  return match ? Number(match[1]) : 0;
}

function faDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${value}T12:00:00`));
  } catch { return value; }
}

function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  return MoneyRuntime?.isReady() ? MoneyRuntime.formatCanonicalDecimal(String(value)) : String(value);
}

function referenceText(finding) {
  if (finding.entity_no) return finding.entity_no;
  const id = String(finding.entity_id || '');
  return id ? id.slice(0, 8) : '—';
}

function groupHtml(group, findings, focusCode) {
  const rows = findings.filter(item => item.code === group.code);
  const focused = focusCode === group.code ? ' style="outline:2px solid var(--brand);outline-offset:2px"' : '';
  if (!rows.length) {
    return `<section class="card section" data-health-detail="${group.code}"${focused}>
      <div class="section-head"><h3>${group.label}</h3><span class="badge pos">صفر مورد</span></div>
      <div class="empty">مورد ناسازگاری برای این کنترل یافت نشد.</div>
    </section>`;
  }
  return `<section class="card section" data-health-detail="${group.code}"${focused}>
    <div class="section-head"><h3>${group.label}</h3><span class="badge neg">${rows.length.toLocaleString('fa-IR')} مورد</span></div>
    <div class="table-wrap"><table><thead><tr><th>مرجع</th><th>تاریخ</th><th>مبلغ</th><th>مقدار مورد انتظار</th><th>مقدار ثبت‌شده</th><th>شرح</th></tr></thead><tbody>
      ${rows.map(item => `<tr>
        <td>${esc(referenceText(item))}</td>
        <td>${esc(faDate(item.event_date))}</td>
        <td class="num">${esc(money(item.amount))}</td>
        <td class="num">${esc(money(item.expected))}</td>
        <td class="num">${esc(money(item.actual))}</td>
        <td>${esc(item.description || item.title || '—')}</td>
      </tr>`).join('')}
    </tbody></table></div>
  </section>`;
}

function modalHtml(snapshot, focusCode) {
  const findings = Array.isArray(snapshot?.findings) ? snapshot.findings : [];
  return `<h2>جزئیات سلامت هسته</h2>
    <p class="muted">این پنجره Evidence همان کنترل‌های سلامت را از منبع واحد مغایرت‌یابی نمایش می‌دهد؛ هیچ داده‌ای در این صفحه اصلاح یا ثبت نمی‌شود.</p>
    ${HEALTH_GROUPS.map(group => groupHtml(group, findings, focusCode)).join('')}
    <div class="form-actions"><button type="button" class="ghost" data-health-close>بستن</button></div>`;
}

async function openHealthDetails(focusCode) {
  openModal('<h2>جزئیات سلامت هسته</h2><div class="loading">در حال خواندن اسناد دارای مشکل…</div>');
  try {
    const state = await C.companyContext.ensure();
    const wid = state?.active_company?.id;
    if (!wid) throw new Error('COMPANY_REQUIRED');
    const snapshot = await C.rpc('avan_reconciliation_findings', { wid });
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.innerHTML = modalHtml(snapshot, focusCode);
    modal.querySelector('[data-health-close]')?.addEventListener('click', closeModal);
    modal.querySelector(`[data-health-detail="${focusCode}"]`)?.scrollIntoView?.({ block: 'nearest' });
  } catch (error) {
    console.error('[Core health drilldown]', error);
    const modal = document.getElementById('modal');
    if (modal) modal.innerHTML = '<h2>جزئیات سلامت هسته</h2><div class="error-box">خواندن جزئیات سلامت هسته انجام نشد.</div><div class="form-actions"><button type="button" class="ghost" data-health-close>بستن</button></div>';
    modal?.querySelector('[data-health-close]')?.addEventListener('click', closeModal);
  }
}

function installStyle(documentObject) {
  if (documentObject.getElementById('avanCoreHealthDrilldownStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanCoreHealthDrilldownStyle';
  style.textContent = `
    .summary-pill[data-avan-health-drilldown="1"]{cursor:pointer;border-color:var(--warn);box-shadow:0 0 0 1px color-mix(in srgb,var(--warn) 20%,transparent)}
    .summary-pill[data-avan-health-drilldown="1"]:focus{outline:2px solid var(--brand);outline-offset:2px}
  `;
  documentObject.head.append(style);
}

export function projectCoreHealthDrilldown(documentObject = document) {
  if (documentObject.getElementById('pageTitle')?.textContent?.trim() !== 'تنظیمات') return false;
  const root = documentObject.getElementById('content');
  if (!root) return false;
  installStyle(documentObject);
  const healthCard = [...root.querySelectorAll('.card')].find(card =>
    [...card.querySelectorAll('h2')].some(h => h.textContent?.trim() === 'سلامت هسته')
  );
  if (!healthCard) return false;

  healthCard.querySelectorAll('.summary-pill').forEach(pill => {
    const group = HEALTH_GROUPS.find(item => item.match.test(pill.textContent || ''));
    if (!group) return;
    const count = trailingCount(pill.textContent);
    pill.dataset.avanHealthCode = group.code;
    if (count > 0) {
      pill.dataset.avanHealthDrilldown = '1';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.setAttribute('title', 'مشاهده اسناد دارای مشکل');
      if (pill.dataset.avanHealthBound !== '1') {
        pill.dataset.avanHealthBound = '1';
        const activate = event => {
          if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          openHealthDetails(group.code);
        };
        pill.addEventListener('click', activate);
        pill.addEventListener('keydown', activate);
      }
    } else {
      delete pill.dataset.avanHealthDrilldown;
      pill.removeAttribute('role');
      pill.removeAttribute('tabindex');
      pill.removeAttribute('title');
    }
  });
  return true;
}

export function installCoreHealthDrilldown({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanCoreHealthDrilldown?.installed) return globalObject.AvanCoreHealthDrilldown;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('health:core-drilldown', () => projectCoreHealthDrilldown(documentObject), { priority: 990 });
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('health-drilldown-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('health-drilldown-ui'));
  const api = Object.freeze({ installed: true, project: () => projectCoreHealthDrilldown(documentObject) });
  globalObject.AvanCoreHealthDrilldown = api;
  Lifecycle.schedule('health-drilldown-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installCoreHealthDrilldown();
