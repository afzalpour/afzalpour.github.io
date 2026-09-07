'use strict';

import { openModal, closeModal } from './src/ui/components/modal.js';
import { jalalizeDateInputs } from './src/ui/date/jalali-picker.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
let busy = false;
let lastSignature = '';

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const faDate = iso => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(`${iso}T12:00:00`)); } catch { return iso || '—'; } };
const groupInt = v => String(v ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g,'٬');

async function companyId(){
  const state = await C.companyContext.ensure();
  return state?.active_company?.id || null;
}

async function loadRows(){
  const wid = await companyId();
  if(!wid) return null;
  const [schedules,invoices,parties,checks] = await Promise.all([
    C.select('invoice_settlement_schedule',`select=id,invoice_id,installment_no,due_date,amount,status,settled_at,planned_method&workspace_id=eq.${wid}&status=eq.settled&order=settled_at.desc&limit=100`),
    C.select('invoices',`select=id,invoice_no,invoice_type,party_id,status&workspace_id=eq.${wid}&status=eq.posted&limit=500`),
    C.select('parties',`select=id,name&workspace_id=eq.${wid}&is_active=eq.true&limit=500`),
    C.select('financial_checks',`select=id,schedule_id,check_number,bank_name,status,direction&workspace_id=eq.${wid}&limit=500`)
  ]);
  const invMap = new Map((invoices||[]).map(x=>[x.id,x]));
  const partyMap = new Map((parties||[]).map(x=>[x.id,x]));
  const checkMap = new Map((checks||[]).map(x=>[x.schedule_id,x]));
  const rows = (schedules||[]).filter(s=>invMap.has(s.invoice_id)).map(s=>({s,inv:invMap.get(s.invoice_id),party:partyMap.get(invMap.get(s.invoice_id)?.party_id),check:checkMap.get(s.id)}));
  return {wid,rows};
}

function signature(rows){
  return rows.map(({s,check})=>`${s.id}:${s.status}:${s.settled_at||''}:${check?.id||''}:${check?.status||''}`).join('|');
}

async function render(force=false){
  if(busy || !document.getElementById('newSaleInvoice') || document.getElementById('invoiceForm')) return;
  const content = document.getElementById('content');
  if(!content) return;
  busy = true;
  try{
    const data = await loadRows();
    if(!data) return;
    const sig = signature(data.rows);
    if(!force && sig === lastSignature && content.querySelector('[data-v60-settlement-reversal]')) return;
    lastSignature = sig;
    let card = content.querySelector('[data-v60-settlement-reversal]');
    if(!data.rows.length){ card?.remove(); return; }
    if(!card){ card=document.createElement('section'); card.className='card section'; card.dataset.v60SettlementReversal='1'; content.append(card); }
    card.innerHTML = `<div class="section-head"><div><h2>تسویه‌های انجام‌شده</h2><span class="muted">برای برگشت فاکتور، در صورت نیاز ابتدا تسویه مرتبط را لغو کنید.</span></div></div><div class="table-wrap"><table><thead><tr><th>فاکتور</th><th>طرف‌حساب</th><th>سررسید</th><th>مبلغ</th><th>روش</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${data.rows.map(({s,inv,party,check})=>`<tr><td>${inv.invoice_type==='sale'?'فروش':'خرید'} ${inv.invoice_no??'—'}</td><td>${esc(party?.name||'—')}</td><td>${faDate(s.due_date)}</td><td class="num">${groupInt(s.amount)} تومان</td><td>${check?`چک ${esc(check.check_number)} · ${esc(check.bank_name)}`:(s.planned_method==='cash'?'صندوق':s.planned_method==='bank'?'بانک':'تسویه')}</td><td>${check?({received:'دریافت‌شده',issued:'صادرشده',cleared:'وصول/پاس‌شده'}[check.status]||esc(check.status)):'تسویه‌شده'}</td><td><button class="danger small" data-v60-reverse-settlement="${s.id}">لغو تسویه</button></td></tr>`).join('')}</tbody></table></div>`;
    card.querySelectorAll('[data-v60-reverse-settlement]').forEach(btn=>btn.onclick=()=>openReverse(btn.dataset.v60ReverseSettlement));
  }catch(err){
    if(!/schema cache|invoice_settlement/i.test(String(err?.message||err))) showError(err,'settlement reversal dashboard');
  }finally{busy=false;}
}

function openReverse(scheduleId){
  openModal(`<h2>لغو تسویه</h2><form id="v60ReverseSettlementForm"><div class="info-box">این عملیات سند مالی تسویه را معکوس می‌کند و سررسید را دوباره باز می‌کند. سپس در صورت نیاز می‌توانید خود فاکتور را برگشت بزنید.</div><div class="form-grid"><div class="field"><label>تاریخ برگشت</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label>شرح</label><input name="reason" value="لغو تسویه فاکتور"></div></div><div class="form-actions"><button type="button" class="ghost" data-cancel>انصراف</button><button class="danger">ثبت لغو تسویه</button></div></form>`);
  const form=document.getElementById('v60ReverseSettlementForm');
  jalalizeDateInputs(form);
  form.querySelector('[data-cancel]').onclick=closeModal;
  form.onsubmit=async e=>{
    e.preventDefault(); const fd=new FormData(form);
    try{
      await C.rpc('reverse_invoice_settlement_schedule',{p_schedule_id:scheduleId,p_reverse_date:fd.get('date'),p_reason:String(fd.get('reason')||'').trim()||null});
      closeModal(); toast('تسویه لغو شد و سررسید دوباره باز شد'); lastSignature=''; await render(true);
    }catch(err){showError(err,'reverse settlement');}
  };
}

let scheduled=false;
function schedule(){ if(scheduled)return; scheduled=true; requestAnimationFrame(async()=>{scheduled=false;await render();}); }
const observer=new MutationObserver(records=>{ if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.id==='content'||n.querySelector?.('#newSaleInvoice')||n.matches?.('#newSaleInvoice'))))) schedule(); });
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{ if(e.target.closest?.('[data-page="invoices"]')) setTimeout(schedule,0); },true);
window.addEventListener('avan:company-context-changed',()=>{lastSignature='';schedule();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
