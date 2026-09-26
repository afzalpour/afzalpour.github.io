'use strict';
(function(){
  const VERSION='4.1.9-fa-ui-v1';
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
  function localizeAttrs(el){
    if(!(el instanceof Element)||el.matches('[data-no-fa-digits]'))return;
    for(const a of ['title','aria-label','placeholder']){
      const v=el.getAttribute(a);if(v&&/[0-9]/.test(v))el.setAttribute(a,faDigits(v));
    }
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
  function sortSelect(select){
    if(!(select instanceof HTMLSelectElement)||select.dataset.sortFaReady==='1')return;
    select.dataset.sortFaReady='1';
    const options=[...select.options],first=options[0],rest=options.slice(first&&(!first.value||first.disabled)?1:0);
    rest.sort((a,b)=>compare(a.textContent,b.textContent));
    if(first&&(!first.value||first.disabled)){
      select.replaceChildren(first,...rest);
    }else{
      select.replaceChildren(...rest.sort((a,b)=>compare(a.textContent,b.textContent)));
    }
  }
  function wireSort(root=document){
    root.querySelectorAll?.('select[data-sort-fa]').forEach(sortSelect);
  }

  document.title=faDigits(document.title);
  localizeTree(document.body);wireSort();
  let scheduled=false;
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='characterData')localizeText(m.target);
      else for(const n of m.addedNodes)localizeTree(n);
    }
    if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;wireSort();});}
  }).observe(document.body,{subtree:true,childList:true,characterData:true});

  window.StockHunterLocaleV419={version:VERSION,faDigits,normalizeFa,compare,sortSelect};
})();