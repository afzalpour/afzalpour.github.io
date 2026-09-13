'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createAvanConnectService } from '../../application/intelligence/avan-connect-service.js';
import { setTitle, page } from '../shell/shell-view.js';
import { avanConnectPageHtml } from './avan-connect-view.js';
import { bindAvanConnectInteractions } from './avan-connect-interactions.js';

const HAS_BROWSER=typeof window!=='undefined'&&typeof document!=='undefined';
const C=HAS_BROWSER?installAvanCloud():null;
const Service=HAS_BROWSER?createAvanConnectService({cloud:C}):null;
let current=null,installed=false;

function navActive(value){
  document.querySelectorAll('#nav button.active').forEach(button=>button.classList.remove('active'));
  document.querySelector('[data-avan-connect-nav]')?.classList.toggle('active',Boolean(value));
}

export async function openAvanConnect(){
  if(!HAS_BROWSER||!Service)return null;
  try{
    setTitle('مرکز اتصال‌ها و اتوماسیون');
    navActive(true);
    page('<div class="loading">در حال آماده‌سازی بازارچه اتصال‌ها…</div>');
    current=await Service.load();
    page(avanConnectPageHtml(current));
    navActive(true);
    bindAvanConnectInteractions({service:Service,current});
    window.dispatchEvent(new CustomEvent('avan:connect-rendered',{detail:{workspace_id:current.workspace.id}}));
    return current;
  }catch(error){
    console.error('[Avan Connect]',error);
    page('<div class="error-box">مرکز اتصال‌ها در این لحظه قابل نمایش نیست. دوباره تلاش کنید.</div>');
    return null;
  }
}

function installSidebar(){
  const nav=document.getElementById('nav');
  if(!nav||nav.querySelector('[data-avan-connect-nav]'))return;
  const label=document.createElement('div');
  label.className='nav-label';
  label.dataset.avanConnectNavLabel='1';
  label.textContent='اتصال و اتوماسیون';
  const button=document.createElement('button');
  button.type='button';
  button.dataset.avanConnectNav='1';
  button.innerHTML='<span>⛓</span>مرکز اتصال‌ها و اتوماسیون';
  button.addEventListener('click',()=>void openAvanConnect());
  nav.append(label,button);
}

function onPage(){
  const title=String(document.getElementById('pageTitle')?.textContent||'');
  if(title!=='مرکز اتصال‌ها و اتوماسیون')document.querySelector('[data-avan-connect-nav]')?.classList.remove('active');
}

export function installAvanConnectWorkspace(){
  if(!HAS_BROWSER||installed)return false;
  installed=true;
  installSidebar();
  window.addEventListener('avan:page-rendered',onPage);
  window.addEventListener('avan:company-context-changed',()=>{if(document.querySelector('[data-avan-connect-page]'))void openAvanConnect();});
  window.AvanConnect=Object.freeze({open:openAvanConnect});
  return true;
}

if(HAS_BROWSER){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAvanConnectWorkspace,{once:true});else installAvanConnectWorkspace();}
