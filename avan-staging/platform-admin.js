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

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const faNumber = value => Number(value || 0).toLocaleString('fa-IR');
function faDate(value){if(!value)return'—';try{return new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return'—'}}
function statusLabel(v){return({active:'فعال',onboarding:'راه‌اندازی',suspended:'تعلیق',archived:'آرشیو'})[v]||v||'—'}
function planLabel(v){return({trial:'آزمایشی',core:'Core',pro:'Pro',enterprise:'Enterprise',custom:'سفارشی'})[v]||v||'—'}
function onboardingLabel(v){return({not_started:'شروع نشده',in_progress:'در حال انجام',blocked:'مسدود',ready:'آماده',completed:'تکمیل'})[v]||v||'—'}
function supportLabel(v){return({none:'بدون درخواست',open:'باز',in_progress:'در حال پیگیری',waiting_customer:'منتظر مشتری',resolved:'حل‌شده'})[v]||v||'—'}
function registryLabel(v){return({ok:'سالم',missing_owner:'مالک ثبت نشده',missing_owner_user:'حساب مالک موجود نیست'})[v]||'نیازمند بررسی'}
function setAuthState(text,kind=''){authState.textContent=text;authState.className=`state-card ${kind}`.trim()}
function option(value,current,label,disabled=false){return`<option value="${esc(value)}" ${value===current?'selected':''} ${disabled?'disabled':''}>${esc(label)}</option>`}
function selectOptions(kind,current){
  if(kind==='status')return option('active',current,'فعال')+option('onboarding',current,'راه‌اندازی')+option('suspended',current,'تعلیق')+option('archived',current,'آرشیو',platformRole!=='platform_owner');
  if(kind==='plan')return option('trial',current,'آزمایشی')+option('core',current,'Core')+option('pro',current,'Pro')+option('enterprise',current,'Enterprise')+option('custom',current,'سفارشی');
  if(kind==='onboarding')return option('not_started',current,'شروع نشده')+option('in_progress',current,'در حال انجام')+option('blocked',current,'مسدود')+option('ready',current,'آماده')+option('completed',current,'تکمیل');
  return option('none',current,'بدون درخواست')+option('open',current,'باز')+option('in_progress',current,'در حال پیگیری')+option('waiting_customer',current,'منتظر مشتری')+option('resolved',current,'حل‌شده');
}

function renderKpis(data={}){
  const items=[['کل شرکت‌ها',data.companies_total],['فعال',data.companies_active],['تعلیق',data.companies_suspended],['کاربران',data.users_total],['عضویت فعال',data.active_memberships],['پشتیبانی باز',data.support_open],['Onboarding مسدود',data.onboarding_blocked],['ادمین پلتفرم',data.platform_admins_active]];
  kpis.innerHTML=items.map(([label,value])=>`<article class="kpi"><span>${esc(label)}</span><strong>${faNumber(value)}</strong></article>`).join('');
}

function renderCompanies(filter=''){
  const q=String(filter||'').trim().toLowerCase();
  const rows=companies.filter(c=>!q||[c.display_name,c.name,c.legal_name,c.owner_email,c.plan_code,c.status].some(v=>String(v||'').toLowerCase().includes(q)));
  companyRows.innerHTML=rows.length?rows.map(c=>{
    const registryOk=c.registry_state==='ok';
    return `<tr data-company-row="${esc(c.company_id)}">
      <td><div class="company-name"><strong>${esc(c.display_name||c.name||'شرکت بدون نام')}</strong><small>${esc(c.owner_email||'مالک نامشخص')}</small><small>${esc(c.company_id)}</small></div></td>
      <td><div class="member-limit"><span>${faNumber(c.active_members)} فعال</span><input data-field="member_limit" type="number" min="1" max="10000" value="${Number(c.member_limit||10)}" aria-label="سقف اعضا"></div></td>
      <td><select data-field="status">${selectOptions('status',c.status)}</select><small class="access-state">${c.access_allowed?'دسترسی Tenant باز':'دسترسی Tenant بسته'}</small></td>
      <td><select data-field="plan_code">${selectOptions('plan',c.plan_code||'core')}</select></td>
      <td><select data-field="onboarding_state">${selectOptions('onboarding',c.onboarding_state||'completed')}</select></td>
      <td><select data-field="support_state">${selectOptions('support',c.support_state||'none')}</select></td>
      <td><span class="badge ${registryOk?'ok':'bad'}">${esc(registryLabel(c.registry_state))}</span><small>${esc(faDate(c.last_changed_at))}</small></td>
      <td class="operation-cell"><textarea data-field="reason" rows="2" maxlength="500" placeholder="دلیل تغییر (الزامی)"></textarea><button class="primary small" data-save-company="${esc(c.company_id)}">ثبت عملیات</button><span class="row-status" aria-live="polite"></span></td>
    </tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">موردی پیدا نشد.</td></tr>';
  bindCompanyActions();
}

function renderAudit(rows=[]){auditHost.innerHTML=rows.length?rows.map(row=>`<div class="audit-item"><div><strong>${esc(row.summary||row.action)}</strong><span>${esc(row.action||'')}${row.tenant_id?` · Tenant ${esc(row.tenant_id)}`:''}</span></div><time>${esc(faDate(row.created_at))}</time></div>`).join(''):'<div class="empty">هنوز رویداد Control Plane ثبت نشده است.</div>'}

async function saveCompany(companyId,button){
  const row=button.closest('[data-company-row]'); if(!row)return;
  const get=name=>row.querySelector(`[data-field="${name}"]`);
  const reason=String(get('reason')?.value||'').trim();
  const statusHost=row.querySelector('.row-status');
  if(reason.length<5){statusHost.textContent='دلیل حداقل ۵ نویسه الزامی است.';return}
  const nextStatus=get('status').value;
  if(nextStatus==='archived'&&!confirm('آرشیو Tenant دسترسی شرکت را می‌بندد. ادامه می‌دهید؟'))return;
  button.disabled=true;statusHost.textContent='در حال ثبت…';
  try{
    await client.rpc('platform_admin_update_tenant',{
      p_company_id:companyId,
      p_status:nextStatus,
      p_plan_code:get('plan_code').value,
      p_member_limit:Number(get('member_limit').value),
      p_onboarding_state:get('onboarding_state').value,
      p_support_state:get('support_state').value,
      p_reason:reason
    });
    statusHost.textContent='ثبت شد.';
    await load({logEntry:false});
  }catch(error){
    console.error('[Avan Platform Admin] tenant update failed',error);
    const m=String(error?.message||error||'');
    statusHost.textContent=m.includes('PLATFORM_OWNER_REQUIRED')?'آرشیو فقط برای مالک پلتفرم مجاز است.':m.includes('TENANT_REASON_REQUIRED')?'دلیل معتبر الزامی است.':'عملیات ثبت نشد.';
  }finally{button.disabled=false}
}
function bindCompanyActions(){companyRows.querySelectorAll('[data-save-company]').forEach(button=>button.onclick=()=>saveCompany(button.dataset.saveCompany,button))}

async function load({logEntry=true}={}){
  if(refreshButton)refreshButton.disabled=true;
  setAuthState('در حال بررسی دسترسی ادمین کل…');content.hidden=true;
  try{
    const user=await client.user();if(!user?.id){setAuthState('برای ورود به کنترل‌پنل ابتدا در آوان وارد حساب کاربری شوید.','error');return}
    const me=await client.rpc('platform_admin_me',{});if(!me?.authorized){setAuthState('این حساب دسترسی Platform Admin ندارد. این صفحه از نقش‌های داخل شرکت مستقل است.','error');return}
    platformRole=me.role||'';
    if(logEntry)await client.rpc('platform_admin_enter',{});
    const [overview,companyList,auditRows]=await Promise.all([client.rpc('platform_admin_overview',{}),client.rpc('platform_admin_companies',{}),client.rpc('platform_admin_audit',{p_limit:40})]);
    companies=Array.isArray(companyList)?companyList:[];renderKpis(overview||{});renderCompanies(companySearch?.value||'');renderAudit(Array.isArray(auditRows)?auditRows:[]);content.hidden=false;
    setAuthState(`دسترسی تأیید شد — ${platformRole==='platform_owner'?'مالک پلتفرم':'ادمین پلتفرم'}. عملیات این صفحه فقط Control Plane را تغییر می‌دهد و Ledger مشتری را باز نمی‌کند.`,'ok');
  }catch(error){console.error('[Avan Platform Admin] load failed',error);const m=String(error?.message||error||'');setAuthState(m.includes('PLATFORM_ADMIN_REQUIRED')?'این حساب دسترسی Platform Admin ندارد.':'بارگذاری Control Plane انجام نشد.','error')}
  finally{if(refreshButton)refreshButton.disabled=false}
}

if(companySearch)companySearch.addEventListener('input',()=>renderCompanies(companySearch.value));
if(refreshButton)refreshButton.onclick=()=>load({logEntry:false});
load();
