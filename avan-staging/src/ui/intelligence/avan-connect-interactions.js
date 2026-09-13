'use strict';

import { openModal, closeModal } from '../components/modal.js';
import { connectorDetailHtml, automationPreviewHtml } from './avan-connect-view.js';

function closeBinding(){document.querySelector('[data-connect-close]')?.addEventListener('click',closeModal);}

export function bindAvanConnectInteractions({service,current}={}){
  const root=document.querySelector('[data-avan-connect-page]');
  if(!root||!current)return false;
  root.querySelector('[data-connect-refresh]')?.addEventListener('click',()=>void window.AvanConnect?.open?.());
  root.querySelector('[data-connect-print]')?.addEventListener('click',()=>{
    const api=window.AvanPrintExport;
    if(api?.printElement)api.printElement(root.cloneNode(true),'مرکز اتصال‌ها و اتوماسیون');
  });
  root.querySelectorAll('[data-connect-detail]').forEach(button=>button.addEventListener('click',()=>{
    const row=current.marketplace.connectors.find(x=>x.key===button.dataset.connectDetail);
    if(!row)return;
    openModal(connectorDetailHtml(row));closeBinding();
  }));
  root.querySelectorAll('[data-connect-preview]').forEach(button=>button.addEventListener('click',async()=>{
    const preview=await service.preview(button.dataset.connectPreview);
    openModal(automationPreviewHtml(preview));closeBinding();
  }));
  return true;
}
