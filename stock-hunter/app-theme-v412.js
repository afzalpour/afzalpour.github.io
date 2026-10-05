'use strict';
(() => {
  const KEY='sh_theme_v412';
  const root=document.documentElement;
  const btn=document.getElementById('themeToggle');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!btn)return;

  function apply(theme){
    const light=theme==='light';
    root.dataset.theme=light?'light':'blue';
    localStorage.setItem(KEY,light?'light':'blue');
    btn.textContent=light?'◐':'☀️';
    btn.title=light?'تغییر به نمای تیره':'تغییر به نمای روشن';
    btn.setAttribute('aria-label',btn.title);
    btn.setAttribute('aria-pressed',light?'true':'false');
    if(meta)meta.setAttribute('content',light?'#f3f4f6':'#15171a');
  }

  let initial='blue';
  try{initial=localStorage.getItem(KEY)==='light'?'light':'blue'}catch{}
  apply(initial);
  btn.addEventListener('click',()=>apply(root.dataset.theme==='light'?'blue':'light'));
})();

/* UX 4.2.6: data-theme=blue remains for backward compatibility; visually it is now professional dark gray. */

/* UI/PWA 4.3.3 bootstrap — presentation/installability only. */
(()=>{
  const ensureCss=href=>{if(document.querySelector('link[href*="'+href.split('?')[0]+'"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);};
  ensureCss('ux-nav-v433.css?v=1');ensureCss('pwa-v433.css?v=1');
  const m=document.querySelector('link[rel="manifest"]');if(m)m.href='manifest.webmanifest?v=4.3.3-pwa1';
  if(!document.querySelector('script[src*="pwa-v433.js"]')){const s=document.createElement('script');s.src='pwa-v433.js?v=1';s.defer=true;document.head.appendChild(s);}
})();
