'use strict';
(function(){
  if(window.StockHunterUxCommonV421)return;
  const VERSION='4.2.1-common1';
  const body=document.body;if(!body)return;
  body.classList.add('stock-ux-v421');

  function ensureUi433(){
    const css=['ux-nav-v433.css?v=1','pwa-v433.css?v=1'];
    css.forEach(href=>{if(document.querySelector('link[href*="'+href.split('?')[0]+'"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);});
    if(!document.querySelector('script[src*="pwa-v433.js"]')){const s=document.createElement('script');s.src='pwa-v433.js?v=1';s.defer=true;document.head.appendChild(s);}
  }
  ensureUi433();

  function menu(title,items){
    return '<details><summary>'+title+'</summary><div class="ux-global-nav-menu-v421">'+items.map(x=>'<a href="'+x[1]+'">'+x[0]+'</a>').join('')+'</div></details>';
  }
  function addGlobalNav(){
    if(document.getElementById('mainTable')||document.querySelector('.auth-shell,.profile-shell,.admin-shell')||document.getElementById('uxGlobalNavV421'))return;
    const nav=document.createElement('nav');nav.id='uxGlobalNavV421';nav.className='ux-global-nav-v421';
    nav.innerHTML='<a href="index.html">امروز</a>'+
      menu('شکار',[['سفر شکار','journey/'],['بازپخش بازار','replay/'],['مرکز هشدار','alerts/'],['گزارش بازار','report/']])+
      menu('تحلیل و آزمون',[['آزمایشگاه آزمون تاریخی','backtest/'],['فرصت‌های از دست‌رفته','missed/'],['سازنده راهبرد','strategy/'],['ارزیابی عملکرد واقعی','performance/']])+
      menu('پژوهش حرفه‌ای',[['مرکز حرفه‌ای','professional/'],['مرکز هوش مصنوعی','ai/'],['پایداری سامانه','reliability/']])+
      '<span class="ux-global-spacer-v421"></span><span class="ux-global-note-v421">موتور ثابت شکار ۴.۱.۶ بدون تغییر</span><a href="profile/">حساب من</a>';
    body.prepend(nav);body.classList.add('ux-has-global-nav-v421');
    nav.addEventListener('click',e=>{const link=e.target.closest('a');if(link)nav.querySelectorAll('details[open]').forEach(d=>d.removeAttribute('open'));});
  }
  function enhanceEmptyStates(root=document){
    const selectors=['.empty','.perf-empty','.pro-note','#researchStatus','.alert-box'];
    root.querySelectorAll(selectors.join(',')).forEach(el=>{const t=(el.textContent||'').trim();if(!t)return;if(/وجود ندارد|هنوز|داده کافی|نمادی|رخدادی|خطا|در حال دریافت|در حال آماده/.test(t))el.classList.add('ux-empty-state-v421');});
    root.querySelectorAll('tbody').forEach(tb=>{if(tb.children.length!==1)return;const tr=tb.firstElementChild,td=tr?.children?.length===1?tr.firstElementChild:null;if(!td)return;const t=(td.textContent||'').trim();if(/وجود ندارد|هنوز|داده کافی|نمادی|رخدادی/.test(t))td.classList.add('ux-empty-state-v421');});
  }
  function closeOtherMenus(e){if(e.target.closest('.ux-global-nav-v421 details'))return;document.querySelectorAll('.ux-global-nav-v421 details[open]').forEach(d=>d.removeAttribute('open'));}
  addGlobalNav();enhanceEmptyStates();
  let queued=false;
  new MutationObserver(m=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1)enhanceEmptyStates(n);});}).observe(body,{subtree:true,childList:true});
  document.addEventListener('click',closeOtherMenus);
  window.StockHunterUxCommonV421={version:VERSION,enhanceEmptyStates};
})();
