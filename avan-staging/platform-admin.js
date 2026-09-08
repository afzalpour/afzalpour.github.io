'use strict';

import { createSupabaseClient } from './src/infrastructure/supabase/supabase-client.js';

const client = createSupabaseClient({ config: window.AVAN_CONFIG || {}, storage: localStorage });
const authState = document.getElementById('platformAuthState');
const content = document.getElementById('platformContent');
const kpis = document.getElementById('platformKpis');
const companyRows = document.getElementById('companyRows');
const auditHost = document.getElementById('platformAudit');
const companySearch = document.getElementById('companySearch');
const refreshButton = document.getElementById('refreshPlatform');
let companies = [];
let platformRole = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
const faNumber = value => Number(value || 0).toLocaleString('fa-IR');
const faDate = value => {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
  catch { return '—'; }
};

function option(value,current,label,disabled=false) { return `<option value="${esc(value)}" ${value===current?'selected':''} ${disabled?'disabled':''}>${esc(label)}</option>`; }
function selectOptions(kind,current) {
  if (kind === 'status') return option('active',current,'فعال')+option('onboarding',current,'در حال راه‌اندازی')+option('suspended',current,'تعلیق')+option('archived',current,'آرشیو',platformRole!=='platform_owner');
  if (kind === 'plan') return option('trial',current,'آزمایشی')+option('core',current,'پایه')+option('pro',current,'حرفه‌ای')+option('enterprise',current,'سازمانی')+option('custom',current,'سفارشی');
  if (kind === 'onboarding') return option('not_started',current,'شروع نشده')+option('in_progress',current,'در حال انجام')+option('blocked',current,'مسدود')+option('ready',current,'آماده')+option('completed',current,'تکمیل');
  return option('none',current,'بدون درخواست')+option('open',current,'باز')+option('in_progress',current,'در حال پیگیری')+option('waiting_customer',current,'منتظر مشتری')+option('resolved',current,'حل‌شده');
}
function setAuthState(text,kind='') { authState.textContent=text; authState.className=`state-card ${kind}`.trim(); }
function registryLabel(value) { return ({ok:'سالم',missing_owner:'مالک ثبت نشده',missing_owner_user:'حساب مالک موجود نیست'})[value] || 'نیازمند بررسی'; }
function renderKpis(data={}) {
  const items=[['کل شرکت‌ها',data.companies_total],['فعال',data.companies_active],['تعلیق',data.companies_suspended],['کاربران',data.users_total],['پشتیبانی فعال',data.active_support_sessions],['درخواست پشتیبانی باز',data.support_open],['عضویت فعال',data.active_memberships],['مدیران سامانه',data.platform_admins_active]];
  kpis.innerHTML=items.map(([label,value])=>`<article class="kpi"><span>${esc(label)}</span><strong>${faNumber(value)}</strong></article>`).join('');
}

function supportControls(company) {
  const session=company.active_support_session;
  if (session) return `<div class="active-support compact-support"><div><strong>دسترسی پشتیبانی فعال</strong><small>تا ${esc(faDate(session.expires_at))}</small></div><div class="support-actions"><a class="ghost small" href="support-viewer.html?session=${encodeURIComponent(session.session_id)}">نمایش</a><button class="ghost small danger" data-revoke-support="${esc(session.session_id)}">لغو</button></div></div>`;
  return `<div class="support-create compact-support-create"><select data-support-duration><option value="15">۱۵ دقیقه</option><option value="30">۳۰ دقیقه</option><option value="60">۶۰ دقیقه</option></select><input data-support-reason maxlength="500" placeholder="دلیل دسترسی پشتیبانی"><button class="ghost small" data-create-support="${esc(company.company_id)}">شروع دسترسی</button></div>`;
}
function companyActions(company) {
  return `<div class="company-inline-actions"><button class="ghost small" data-toggle-company-action="operation">ثبت عملیات</button><button class="ghost small" data-toggle-company-action="support">دسترسی پشتیبانی</button></div><div class="company-action-panel" data-company-operation-panel hidden><textarea data-field="reason" rows="2" maxlength="500" placeholder="دلیل تغییر (الزامی)"></textarea><button class="primary small" data-save-company="${esc(company.company_id)}">ثبت تغییرات</button></div><div class="company-action-panel" data-company-support-panel hidden>${supportControls(company)}</div><span class="row-status" aria-live="polite"></span>`;
}
function renderCompanies(filter='') {
  const query=String(filter||'').trim().toLowerCase();
  const rows=companies.filter(company=>!query||[company.display_name,company.name,company.legal_name,company.owner_email,company.plan_code,company.status].some(value=>String(value||'').toLowerCase().includes(query)));
  companyRows.innerHTML=rows.length?rows.map(company=>{
    const ok=company.registry_state==='ok';
    return `<tr data-company-row="${esc(company.company_id)}"><td class="company-cell"><div class="company-name"><strong>${esc(company.display_name||company.name||'شرکت بدون نام')}</strong><small>${esc(company.owner_email||'مالک نامشخص')}</small></div>${companyActions(company)}</td><td><div class="member-limit"><span>${faNumber(company.active_members)} فعال</span><input data-field="member_limit" type="number" min="1" max="10000" value="${Number(company.member_limit||10)}"></div></td><td><select data-field="status">${selectOptions('status',company.status)}</select><small>${company.access_allowed?'دسترسی باز':'دسترسی بسته'}</small></td><td><select data-field="plan_code">${selectOptions('plan',company.plan_code||'core')}</select></td><td><select data-field="onboarding_state">${selectOptions('onboarding',company.onboarding_state||'completed')}</select></td><td><select data-field="support_state">${selectOptions('support',company.support_state||'none')}</select></td><td><span class="badge ${ok?'ok':'bad'}">${esc(registryLabel(company.registry_state))}</span></td></tr>`;
  }).join(''):'<tr><td colspan="7" class="empty">موردی پیدا نشد.</td></tr>';
  bindActions();
}

const AUDIT_ACTION_FA=Object.freeze({control_plane_opened:'ورود به مرکز مدیریت سامانه',tenant_operations_updated:'تنظیمات عملیاتی شرکت تغییر کرد',support_session_created:'دسترسی پشتیبانی ایجاد شد',support_session_revoked:'دسترسی پشتیبانی لغو شد',tax_rule_draft_created:'پیش‌نویس قانون مالیاتی ایجاد شد',tax_rule_published:'نسخه قانون مالیاتی منتشر شد'});
function renderAudit(rows=[]) {
  const visible=rows.slice(0,12);
  auditHost.innerHTML=visible.length?`<div class="compact-audit-summary">آخرین ${visible.length.toLocaleString('fa-IR')} رویداد مدیریتی</div>${visible.map(row=>`<div class="audit-item compact-audit-item"><span class="audit-dot" aria-hidden="true"></span><strong>${esc(AUDIT_ACTION_FA[row.action]||'رویداد مدیریتی ثبت شد')}</strong><small>${row.tenant_id?'شرکت':'سامانه'}</small><time>${esc(faDate(row.created_at))}</time></div>`).join('')}`:'<div class="empty">هنوز رویدادی ثبت نشده است.</div>';
}

async function saveCompany(id,button) {
  const row=button.closest('[data-company-row]'); const get=name=>row.querySelector(`[data-field="${name}"]`); const status=row.querySelector('.row-status'); const reason=String(get('reason')?.value||'').trim();
  if(reason.length<5){status.textContent='دلیل حداقل ۵ نویسه الزامی است.';return;} button.disabled=true; status.textContent='در حال ثبت…';
  try {
    await client.rpc('platform_admin_update_tenant',{p_company_id:id,p_status:get('status').value,p_plan_code:get('plan_code').value,p_member_limit:Number(get('member_limit').value),p_onboarding_state:get('onboarding_state').value,p_support_state:get('support_state').value,p_reason:reason});
    status.textContent='ثبت شد.'; await load({logEntry:false});
  } catch(error){status.textContent=String(error?.message||'').includes('PLATFORM_OWNER_REQUIRED')?'آرشیو فقط برای مالک سامانه مجاز است.':'عملیات ثبت نشد.';} finally{button.disabled=false;}
}
async function createSupport(id,button) {
  const row=button.closest('[data-company-row]'); const reason=String(row.querySelector('[data-support-reason]')?.value||'').trim(); const minutes=Number(row.querySelector('[data-support-duration]')?.value||15); const status=row.querySelector('.row-status');
  if(reason.length<10){status.textContent='دلیل پشتیبانی حداقل ۱۰ نویسه باشد.';return;} button.disabled=true; status.textContent='در حال ایجاد دسترسی…';
  try { const session=await client.rpc('platform_admin_create_support_session',{p_company_id:id,p_duration_minutes:minutes,p_reason:reason}); status.textContent='دسترسی فقط‌خواندنی فعال شد.'; await load({logEntry:false}); if(session?.session_id) window.open(`support-viewer.html?session=${encodeURIComponent(session.session_id)}`,'_blank','noopener'); }
  catch(error){status.textContent=String(error?.message||'').includes('SUPPORT_SESSION_ALREADY_ACTIVE')?'برای این شرکت دسترسی پشتیبانی فعال وجود دارد.':'ایجاد دسترسی انجام نشد.';} finally{button.disabled=false;}
}
async function revokeSupport(sessionId,button) {
  if(!confirm('دسترسی پشتیبانی فوراً لغو شود؟'))return; button.disabled=true;
  try{await client.rpc('platform_admin_revoke_support_session',{p_session_id:sessionId,p_reason:'لغو دستی توسط مدیر سامانه آوان'});await load({logEntry:false});}catch{alert('لغو دسترسی انجام نشد.');}finally{button.disabled=false;}
}
function toggleCompanyPanel(button) {
  const row=button.closest('[data-company-row]'); const kind=button.dataset.toggleCompanyAction; const op=row.querySelector('[data-company-operation-panel]'); const support=row.querySelector('[data-company-support-panel]'); const target=kind==='operation'?op:support; const other=kind==='operation'?support:op;
  other.hidden=true; target.hidden=!target.hidden; row.querySelectorAll('[data-toggle-company-action]').forEach(item=>item.classList.toggle('active',item===button&&!target.hidden));
}
function bindActions() {
  companyRows.querySelectorAll('[data-toggle-company-action]').forEach(button=>button.onclick=()=>toggleCompanyPanel(button));
  companyRows.querySelectorAll('[data-save-company]').forEach(button=>button.onclick=()=>saveCompany(button.dataset.saveCompany,button));
  companyRows.querySelectorAll('[data-create-support]').forEach(button=>button.onclick=()=>createSupport(button.dataset.createSupport,button));
  companyRows.querySelectorAll('[data-revoke-support]').forEach(button=>button.onclick=()=>revokeSupport(button.dataset.revokeSupport,button));
}

async function load({logEntry=true}={}) {
  if(refreshButton)refreshButton.disabled=true; setAuthState('در حال بررسی دسترسی مدیر سامانه…'); content.hidden=true;
  try {
    const user=await client.user(); if(!user?.id){setAuthState('ابتدا در آوان وارد حساب کاربری شوید.','error');return;}
    const me=await client.rpc('platform_admin_me',{}); if(!me?.authorized){setAuthState('این حساب مجوز مدیریت سامانه را ندارد.','error');return;}
    platformRole=me.role||''; if(logEntry)await client.rpc('platform_admin_enter',{});
    const [overview,list,audit]=await Promise.all([client.rpc('platform_admin_overview',{}),client.rpc('platform_admin_companies',{}),client.rpc('platform_admin_audit',{p_limit:20})]);
    companies=Array.isArray(list)?list:[]; renderKpis(overview||{}); renderCompanies(companySearch?.value||''); renderAudit(Array.isArray(audit)?audit:[]); content.hidden=false;
    setAuthState(`دسترسی تأیید شد — ${platformRole==='platform_owner'?'مالک سامانه':'مدیر سامانه'}. دسترسی پشتیبانی فقط موقت و فقط‌خواندنی است.`,'ok'); window.dispatchEvent(new CustomEvent('avan:platform-admin-refreshed'));
  } catch(error){console.error(error);setAuthState('بارگذاری مرکز مدیریت سامانه انجام نشد.','error');} finally{if(refreshButton)refreshButton.disabled=false;}
}
if(companySearch)companySearch.addEventListener('input',()=>renderCompanies(companySearch.value)); if(refreshButton)refreshButton.onclick=()=>load({logEntry:false}); load();
