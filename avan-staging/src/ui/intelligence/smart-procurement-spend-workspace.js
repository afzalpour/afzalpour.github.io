'use strict';

import './intelligence-print-export.js';
import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createSmartProcurementSpendService } from '../../application/intelligence/smart-procurement-spend-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';
import { smartProcurementSpendPageHtml, procurementEvidenceHtml } from './smart-procurement-spend-view.js';

const HAS_BROWSER=typeof window!=='undefined'&&typeof document!=='undefined';
const C=HAS_BROWSER?installAvanCloud():null;
const Service=HAS_BROWSER?createSmartProcurementSpendService({cloud:C}):null;
let currentResult=null,installed=false;
const today=()=>new Date().toISOString().slice(0,10);

function evidenceModal(item){openModal(procurementEvidenceHtml(item));document.querySelector('[data-close-procurement-evidence]')?.addEventListener('click',closeModal);}
function bind(){const root=document.querySelector('[data-smart-procurement-page]');if(!root||!currentResult)return;root.querySelector('[data-procurement-date-form]')?.addEventListener('submit',e=>{e.preventDefault();const asOf=String(new FormData(e.currentTarget).get('asOf')||'');if(!asOf)return toast('تاریخ مبنا را انتخاب کنید.');void openSmartProcurementSpend(asOf);});root.querySelectorAll('[data-procurement-evidence]').forEach(b=>b.addEventListener('click',()=>{const item=currentResult.snapshot.findings.find(r=>r.id===b.dataset.procurementEvidence);if(item)evidenceModal(item);}));}
function navActive(v){document.querySelectorAll('#nav button.active').forEach(b=>b.classList.remove('active'));document.querySelector('[data-smart-procurement-nav]')?.classList.toggle('active',Boolean(v));}

export async function openSmartProcurementSpend(asOf=today()){
  if(!HAS_BROWSER||!Service)return null;
  try{
    setTitle('کنترل هوشمند خرید و مخارج');navActive(true);
    page('<div class="loading">در حال اجرای کنترل‌های خرید و تطبیق شواهد…</div>');
    await MoneyRuntime?.ready?.();
    currentResult=await Service.load({asOf});
    page(smartProcurementSpendPageHtml(currentResult));navActive(true);bind();
    window.dispatchEvent(new CustomEvent('avan:smart-procurement-rendered',{detail:{workspace_id:currentResult.workspace.id,as_of:currentResult.snapshot.asOf}}));
    return currentResult;
  }catch(error){console.error('[Avan Procurement]',error);page('<div class="error-box">کنترل خرید در این لحظه قابل محاسبه نیست. دوباره تلاش کنید.</div>');return null;}
}

function installSidebar(){const nav=document.getElementById('nav');if(!nav||nav.querySelector('[data-smart-procurement-nav]'))return;if(!nav.querySelector('[data-control-tower-nav-label]')){const l=document.createElement('div');l.className='nav-label';l.dataset.controlTowerNavLabel='1';l.textContent='هوشمندی مالی';nav.append(l);}const b=document.createElement('button');b.type='button';b.dataset.smartProcurementNav='1';b.innerHTML='<span>◈</span>کنترل هوشمند خرید و مخارج';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeModal();void openSmartProcurementSpend();});nav.append(b);}
function installLauncher(){const content=document.getElementById('content');if(!content||content.querySelector('[data-procurement-report-launcher]'))return;const card=document.createElement('section');card.className='card avan-procurement-report-launcher';card.dataset.procurementReportLauncher='1';card.innerHTML='<div><b>◈ کنترل هوشمند خرید و مخارج</b><span class="muted">تطبیق خرید و رسید، تغییر قیمت و نیاز موجودی</span></div><button type="button" class="primary">اجرای کنترل خرید</button>';card.querySelector('button')?.addEventListener('click',()=>void openSmartProcurementSpend());content.prepend(card);}
function onPage(e){const t=String(e?.detail?.title||document.getElementById('pageTitle')?.textContent||'');if(t==='گزارش‌ها')installLauncher();if(t!=='کنترل هوشمند خرید و مخارج')document.querySelector('[data-smart-procurement-nav]')?.classList.remove('active');}

export function installSmartProcurementSpendWorkspace(){if(!HAS_BROWSER||installed)return false;installed=true;installSidebar();window.addEventListener('avan:page-rendered',onPage);window.addEventListener('avan:company-context-changed',()=>{if(document.querySelector('[data-smart-procurement-page]'))void openSmartProcurementSpend();});if(document.getElementById('pageTitle')?.textContent==='گزارش‌ها')installLauncher();window.AvanSmartProcurementSpend=Object.freeze({open:openSmartProcurementSpend});return true;}
if(HAS_BROWSER){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSmartProcurementSpendWorkspace,{once:true});else installSmartProcurementSpendWorkspace();}
