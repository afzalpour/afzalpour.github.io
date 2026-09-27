'use strict';
(function(){
  const VERSION='4.1.9-fa-ui-v3';
  const DIGITS='۰۱۲۳۴۵۶۷۸۹';
  const collator=new Intl.Collator('fa-IR',{usage:'sort',sensitivity:'base',ignorePunctuation:true,numeric:false});

  function faDigits(value){
    return String(value??'').replace(/[0-9]/g,d=>DIGITS[d.charCodeAt(0)-48]);
  }
  function normalizeFa(value){
    return String(value??'').normalize('NFKC')
      .replace(/ي/g,'ی').replace(/ى/g,'ی').replace(/ك/g,'ک')
      .replace(/[ًٌٍَُِّْـ]/g,'').replace(/\u200c/g,' ').replace(/\s+/g,' ').trim();
  }
  function compare(a,b){return collator.compare(normalizeFa(a),normalizeFa(b));}

  function skipText(node){
    const p=node.parentElement;if(!p)return true;
    return !!p.closest('script,style,noscript,template,[data-no-fa-digits]');
  }
  function localizeText(node){
    if(!node||node.nodeType!==Node.TEXT_NODE||skipText(node)||!/[0-9]/.test(node.nodeValue||''))return;
    node.nodeValue=faDigits(node.nodeValue);
  }
  function localizeControlValue(el){
    if(!(el instanceof HTMLInputElement)||el.matches('[data-no-fa-digits]'))return;
    const type=(el.type||'text').toLowerCase();
    if(!['text','search','tel','url'].includes(type))return;
    if(/[0-9]/.test(el.value||'')){
      const start=el.selectionStart,end=el.selectionEnd;
      el.value=faDigits(el.value);
      try{if(start!=null&&end!=null)el.setSelectionRange(start,end);}catch{}
    }
  }
  function localizeAttrs(el){
    if(!(el instanceof Element)||el.matches('[data-no-fa-digits]'))return;
    for(const a of ['title','aria-label','placeholder']){
      const v=el.getAttribute(a);if(v&&/[0-9]/.test(v))el.setAttribute(a,faDigits(v));
    }
    localizeControlValue(el);
  }
  function localizeTree(root){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){localizeText(root);return;}
    if(!(root instanceof Element||root instanceof Document||root instanceof DocumentFragment))return;
    if(root instanceof Element)localizeAttrs(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n;while((n=walker.nextNode()))localizeText(n);
    if(root.querySelectorAll)root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(localizeAttrs);
  }
  function shouldSortFa(select){
    if(!(select instanceof HTMLSelectElement))return false;
    if(select.matches('[data-sort-fa]'))return true;
    const hint=[select.id,select.name,select.getAttribute('aria-label'),select.closest('label')?.textContent].filter(Boolean).join(' ');
    return /(symbol|company|نماد|شرکت)/i.test(hint);
  }
  function sortSelect(select){
    if(!(select instanceof HTMLSelectElement)||!shouldSortFa(select))return;
    const selected=select.value,options=[...select.options],first=options[0],hasPlaceholder=!!(first&&(!first.value||first.disabled));
    const fixed=hasPlaceholder?[first]:[],rest=options.slice(hasPlaceholder?1:0);
    rest.sort((a,b)=>compare(a.textContent,b.textContent));
    select.replaceChildren(...fixed,...rest);
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    select.dataset.sortFaReady='1';
  }
  function wireSort(root=document){
    root.querySelectorAll?.('select').forEach(s=>{if(shouldSortFa(s))sortSelect(s);});
  }

  document.documentElement.lang='fa';
  document.body?.setAttribute('lang','fa-IR');
  document.title=faDigits(document.title);
  localizeTree(document.body);wireSort();
  document.addEventListener('change',e=>localizeControlValue(e.target),true);
  document.addEventListener('blur',e=>localizeControlValue(e.target),true);
  let scheduled=false;
  const pendingRoots=new Set(),pendingText=new Set();
  function flushLocaleMutations(){
    scheduled=false;
    for(const n of pendingText)localizeText(n);
    pendingText.clear();
    for(const n of pendingRoots){
      localizeTree(n);
      if(n instanceof Element){
        if(n.matches?.('select'))sortSelect(n);
        wireSort(n);
      }
    }
    pendingRoots.clear();
  }
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='characterData')pendingText.add(m.target);
      else for(const n of m.addedNodes)if(n.nodeType===Node.ELEMENT_NODE||n.nodeType===Node.TEXT_NODE)pendingRoots.add(n);
    }
    if(!scheduled){scheduled=true;requestAnimationFrame(flushLocaleMutations);}
  }).observe(document.body,{subtree:true,childList:true,characterData:true});

  window.StockHunterLocaleV419={version:VERSION,faDigits,normalizeFa,compare,sortSelect,shouldSortFa,localizeControlValue};
})();

// Shared UX 4.2.1 loader — presentation only; no Hunt logic.
(function(){
  if(!document.querySelector('link[data-ux-v421]')){const l=document.createElement('link');l.rel='stylesheet';l.href='ux-v421.css?v=1';l.dataset.uxV421='1';document.head.appendChild(l);}
  if(!document.querySelector('script[data-ux-common-v421]')){const x=document.createElement('script');x.src='ux-common-v421.js?v=1';x.defer=true;x.dataset.uxCommonV421='1';document.body.appendChild(x);}
})();
