'use strict';
(async()=>{
 const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
 const summary=document.querySelector('.summary-row'),radar=document.getElementById('huntRadarV416'),table=document.querySelector('.table-panel'),toolbar=document.querySelector('.toolbar'),alertBox=document.getElementById('alertBox');
 if(!summary||!table||!toolbar)return;
 const read=()=>{try{return JSON.parse(localStorage.getItem('stockHunterWorkspaceV420')||'{}')}catch{return{}}};
 let layout=read();
 function apply(x){
   summary.hidden=x.summary===false;
   if(radar){radar.dataset.workspaceHidden=x.radar===false?'1':'0';if(x.radar===false)radar.hidden=true;}
   table.hidden=x.table===false;
   document.body.classList.toggle('workspace-compact-v420',!!x.compact);
   const first=['summary','radar','table'].includes(x.first)?x.first:'summary';
   if(first==='summary'){if(summary.nextElementSibling!==toolbar)toolbar.insertAdjacentElement('beforebegin',summary);}
   else if(first==='radar'&&radar){summary.insertAdjacentElement('beforebegin',radar);}
   else if(first==='table'){summary.insertAdjacentElement('beforebegin',table);}
 }
 async function cloudLoad(){
  if(!base||!key)return;try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'),sb=createClient(base,key,{auth:{persistSession:true,autoRefreshToken:true}}),{data:{session}}=await sb.auth.getSession();if(!session)return;const {data}=await sb.from('stock_hunter_workspace_v420').select('layout').eq('user_id',session.user.id).maybeSingle();if(data?.layout){layout=data.layout;localStorage.setItem('stockHunterWorkspaceV420',JSON.stringify(layout));apply(layout);}}catch{}
 }
 apply(layout);if(typeof requestIdleCallback==='function')requestIdleCallback(()=>cloudLoad(),{timeout:2400});else setTimeout(()=>cloudLoad(),1800);
 const a=document.createElement('a');a.className='top-link';a.href='professional-center-v420.html';a.textContent='میزکار حرفه‌ای';const host=document.querySelector('.top-actions');if(host&&!host.querySelector('a[href="professional-center-v420.html"]'))host.insertBefore(a,host.querySelector('#themeToggle')||null);
 window.StockHunterWorkspaceV420={version:'4.2.0-workspace-v1',apply,read};
})();