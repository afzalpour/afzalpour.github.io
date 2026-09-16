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
    btn.textContent=light?'🔵':'☀️';
    btn.title=light?'تغییر به نمای آبی':'تغییر به نمای سفید';
    btn.setAttribute('aria-label',btn.title);
    btn.setAttribute('aria-pressed',light?'true':'false');
    if(meta)meta.setAttribute('content',light?'#f4f8fc':'#07111f');
  }

  let initial='blue';
  try{initial=localStorage.getItem(KEY)==='light'?'light':'blue'}catch{}
  apply(initial);
  btn.addEventListener('click',()=>apply(root.dataset.theme==='light'?'blue':'light'));
})();
