'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createAvanConnectService } from '../../application/intelligence/avan-connect-service.js';
import { setTitle, page } from '../shell/shell-view.js';
import { avanConnectPageHtml } from './avan-connect-view.js';

const HAS_BROWSER=typeof window!=='undefined'&&typeof document!=='undefined';
const C=HAS_BROWSER?installAvanCloud():null;
const Service=HAS_BROWSER?createAvanConnectService({cloud:C}):null;
let current=null,installed=false;

export async function openAvanConnect(){
  if(!HAS_BROWSER||!Service)return null;
  try{
    setTitle('مرکز اتصال‌ها و اتوماسیون');
    page('<div class="loading">در حال آماده‌سازی بازارچه اتصال‌ها…</div>');
    current=await Service.load();
    page(avanConnectPageHtml(current));
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
  label.textContent='اتصال و اتوماسیون';
  const button=document.createElement('button');
  button.type='button';
  button.dataset.avanConnectNav='1';
  button.innerHTML='<span>⛓</span>مرکز اتصال‌ها و اتوماسیون';
  button.addEventListener('click',()=>void openAvanConnect());
  nav.append(label,button);
}

export function installAvanConnectWorkspace(){
  if(!HAS_BROWSER||installed)return false;
  installed=true;
  installSidebar();
  window.AvanConnect=Object.freeze({open:openAvanConnect});
  return true;
}

if(HAS_BROWSER){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAvanConnectWorkspace,{once:true});else installAvanConnectWorkspace();}
