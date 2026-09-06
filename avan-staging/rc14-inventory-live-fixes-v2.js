'use strict';

import { closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let saveBusy = false;
let returning = false;

function toLatin(value){
  return String(value ?? '')
    .replace(/[۰-۹]/g,d=>String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g,d=>String(ARABIC_DIGITS.indexOf(d)));
}
function rawDecimal(value){
  let s=toLatin(value).trim().replace(/[٬,\s]/g,'').replace(/٫/g,'.');
  const i=s.indexOf('.');
  if(i>=0)s=s.slice(0,i+1)+s.slice(i+1).replace(/\./g,'');
  return s;
}
function parseDecimal(value,max=6){
  const s=rawDecimal(value);
  return new RegExp(`^\\d+(?:\\.\\d{1,${max}})?$`).test(s)?s:null;
}
function grouped(value,max=6){
  const s=rawDecimal(value).replace(/[^\d.]/g,'');
  if(!s)return '';
  const hadDot=s.includes('.');
  const [ri='',rf='']=s.split('.');
  const intPart=(ri||'0').replace(/^0+(?=\d)/,'')||'0';
  const g=intPart.replace(/\B(?=(\d{3})+(?!\d))/g,'٬');
  const frac=rf.slice(0,Math.max(0,max));
  return hadDot&&max>0?`${g}٫${frac}`:g;
}

function decimalsForQty(input){
  const n=Number(input?.dataset?.rc14Decimals ?? input?.dataset?.eDecimals ?? 6);
  return Number.isFinite(n)?Math.max(0,Math.min(6,n)):6;
}
function formatTarget(input){
  if(!(input instanceof HTMLInputElement))return;
  if(!input.closest('#eDocForm'))return;
  if(input.name==='qty')input.value=grouped(input.value,decimalsForQty(input));
  if(input.name==='cost')input.value=grouped(input.value,6);
}

async function masterData(){
  const state=await C.companyContext.ensure();
  const company=state?.active_company;
  if(!company?.id)throw new Error('COMPANY_REQUIRED');
  const wid=company.id;
  const [items,units]=await Promise.all([
    C.select('inventory_items',`select=id,base_unit_id,item_type,is_active&workspace_id=eq.${wid}`),
    C.select('inventory_units',`select=id,decimal_places,is_active&workspace_id=eq.${wid}`)
  ]);
  return {company,items:items||[],units:units||[]};
}

async function save(form,button){
  if(saveBusy)return;
  saveBusy=true;
  const oldText=button?.textContent||'ذخیره پیش‌نویس';
  if(button){button.disabled=true;button.textContent='در حال ذخیره…';}
  try{
    const d=await masterData();
    const type=form.elements.type?.value;
    const rows=[];
    const lineEls=[...form.querySelectorAll('[data-e-line]')];
    for(const [i,row] of lineEls.entries()){
      const item=d.items.find(x=>x.id===row.querySelector('[name=item]')?.value);
      const unit=d.units.find(x=>x.id===item?.base_unit_id);
      const decimals=Number(unit?.decimal_places??6);
      const qty=parseDecimal(row.querySelector('[name=qty]')?.value,decimals);
      const dir=row.querySelector('[name=dir]')?.value||'in';
      let from=row.querySelector('[name=from]')?.value||null;
      let to=row.querySelector('[name=to]')?.value||null;
      if(!item||item.item_type!=='inventory'||!qty||Number(qty)<=0){throw new Error(`مقدار ردیف ${i+1} معتبر نیست`);}
      if(['receipt','opening'].includes(type)){from=null;if(!to)throw new Error('انبار مقصد را انتخاب کنید');}
      if(type==='issue'){to=null;if(!from)throw new Error('انبار مبدأ را انتخاب کنید');}
      if(type==='transfer'&&(!from||!to||from===to))throw new Error('مبدأ و مقصد انتقال معتبر نیست');
      if(type==='adjustment'){
        if(dir==='in'){from=null;if(!to)throw new Error('انبار تعدیل را انتخاب کنید');}
        else{to=null;if(!from)throw new Error('انبار تعدیل را انتخاب کنید');}
      }
      const needCost=['receipt','opening'].includes(type)||(type==='adjustment'&&dir==='in');
      const cost=parseDecimal(row.querySelector('[name=cost]')?.value||'0',6);
      if(cost===null||(needCost&&Number(cost)<=0))throw new Error(`بهای واحد ردیف ${i+1} معتبر نیست`);
      rows.push({
        item_id:item.id,
        from_warehouse_id:from,
        to_warehouse_id:to,
        quantity:qty,
        unit_cost:cost,
        description:row.querySelector('[name=desc]')?.value.trim()||null
      });
    }
    await C.rpc('save_inventory_draft',{
      p_workspace_id:d.company.id,
      p_fiscal_year_id:form.elements.fy?.value,
      p_document_id:null,
      p_document_type:type,
      p_document_date:form.elements.date?.value,
      p_description:form.elements.description?.value.trim()||null,
      p_lines:rows
    });
    sessionStorage.setItem('avan.rc14.inventory.notice','پیش‌نویس سند انبار با موفقیت ذخیره شد.');
    sessionStorage.setItem('avan.rc14.inventory.return','documents');
    closeModal();
    location.reload();
  }catch(err){
    saveBusy=false;
    if(button){button.disabled=false;button.textContent=oldText;}
    const msg=String(err?.message||err||'');
    if(/معتبر|انتخاب کنید/.test(msg))return toast(msg);
    showError(err,'inventory draft save v2');
  }
}

function updateRowHints(){
  const form=document.getElementById('eDocForm');
  if(!form)return;
  form.querySelectorAll('[data-e-line]').forEach(row=>{
    const qty=row.querySelector('[name=qty]');
    const cost=row.querySelector('[name=cost]');
    if(qty){qty.type='text';qty.inputMode='decimal';qty.autocomplete='off';qty.classList.add('rc14l-number-input');formatTarget(qty);}
    if(cost){cost.type='text';cost.inputMode='decimal';cost.autocomplete='off';cost.classList.add('rc14l-number-input');formatTarget(cost);}
    const qtyField=qty?.closest('.field');
    if(qtyField&&!qtyField.querySelector('[data-v2-number-help]')){
      const h=document.createElement('small');h.dataset.v2NumberHelp='1';h.className='rc14l-field-help';h.textContent='جداکننده سه‌رقمی هنگام ورود اعمال می‌شود.';qty.insertAdjacentElement('afterend',h);
    }
    const costField=cost?.closest('.field');
    if(costField&&!costField.querySelector('[data-v2-number-help]')){
      const h=document.createElement('small');h.dataset.v2NumberHelp='1';h.className='rc14l-field-help';h.textContent='مبلغ با جداکننده سه‌رقمی نمایش داده می‌شود.';cost.insertAdjacentElement('afterend',h);
    }
  });
}

function tryReturnToDocuments(){
  if(returning||sessionStorage.getItem('avan.rc14.inventory.return')!=='documents')return;
  const inventory=document.querySelector('[data-page="inventory"]');
  if(!inventory)return;
  returning=true;
  inventory.click();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const tab=document.querySelector('[data-e-tab="documents"]');
    if(tab){clearInterval(timer);tab.click();sessionStorage.removeItem('avan.rc14.inventory.return');returning=false;}
    if(tries>20){clearInterval(timer);returning=false;}
  },100);
}

function install(){
  document.addEventListener('input',e=>{
    const input=e.target;
    if(input?.matches?.('#eDocForm [name="qty"],#eDocForm [name="cost"]'))formatTarget(input);
  },true);
  document.addEventListener('blur',e=>{
    const input=e.target;
    if(input?.matches?.('#eDocForm [name="qty"],#eDocForm [name="cost"]'))formatTarget(input);
  },true);

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('#eDocForm button.primary');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    save(btn.form||document.getElementById('eDocForm'),btn);
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target?.closest?.('#eDocForm')||e.target.tagName==='TEXTAREA')return;
    const form=e.target.closest('#eDocForm');
    e.preventDefault();
    e.stopImmediatePropagation();
    save(form,form.querySelector('button.primary'));
  },true);

  const observer=new MutationObserver(()=>{updateRowHints();tryReturnToDocuments();});
  observer.observe(document.body,{childList:true,subtree:true});
  updateRowHints();
  tryReturnToDocuments();
  const n=sessionStorage.getItem('avan.rc14.inventory.notice');
  if(n){sessionStorage.removeItem('avan.rc14.inventory.notice');setTimeout(()=>toast(n),900);}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
