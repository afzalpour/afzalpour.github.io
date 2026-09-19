'use strict';
(async()=>{
  const config=window.STOCK_HUNTER_CONFIG||{};
  const baseUrl=String(config.SUPABASE_URL||'').replace(/\/$/,'');
  const publishableKey=config.SUPABASE_PUBLISHABLE_KEY||'';
  const gate=document.getElementById('v417AuthGate');
  const byId=id=>document.getElementById(id);
  const setGate=(title,sub)=>{
    if(!gate)return;
    gate.innerHTML='<div><b>'+esc(String(title||''))+'</b><span>'+esc(String(sub||''))+'</span></div>';
    gate.hidden=false;
  };
  if(!baseUrl||!publishableKey){
    setGate('پیکربندی Auth در دسترس نیست','4.1.6 بدون تغییر باقی مانده است.');
    return;
  }

  let createClient;
  try{
    ({createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'));
  }catch{
    setGate('کتابخانه ورود بارگذاری نشد','اتصال شبکه را بررسی کن.');
    return;
  }
  const supabase=createClient(baseUrl,publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
  });

  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!session){
    location.replace('auth-v417.html?next=index-v417.html');
    return;
  }
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user){
    await supabase.auth.signOut();
    location.replace('auth-v417.html?next=index-v417.html');
    return;
  }

  const [roleRes,profileRes,prefRes]=await Promise.all([
    supabase.from('stock_hunter_user_roles_v417').select('role').eq('user_id',user.id).maybeSingle(),
    supabase.from('stock_hunter_profiles_v417').select('display_name,account_status').eq('user_id',user.id).maybeSingle(),
    supabase.from('stock_hunter_user_preferences_v417').select('theme,page_size,visible_columns,hunt_filter,decision_filter,notification_settings').eq('user_id',user.id).maybeSingle()
  ]);
  if(roleRes.error||profileRes.error||prefRes.error||!profileRes.data||profileRes.data.account_status!=='active'){
    setGate('حساب فعال نیست','دسترسی به محیط شخصی 4.1.7 متوقف شده است.');
    return;
  }

  const role=String(roleRes.data?.role||'user');
  const profile=profileRes.data||{};
  const prefs=prefRes.data||{};
  const validColumnKeys=new Set(columns.map(c=>c[0]));
  let hydrating=true;
  let activeWatchlistId='';
  let watchlistOnly=false;
  let watchlistIds=new Set();
  let watchlists=[];
  let saveTimer=null;

  byId('personalNameV417').textContent=profile.display_name||user.email||'کاربر';
  byId('personalRoleV417').textContent=role==='owner_admin'?'مالک اصلی':role==='admin'?'ادمین':'کاربر';
  if(['owner_admin','admin'].includes(role))byId('personalAdminV417').hidden=false;

  function desiredTheme(){
    const p=String(prefs.theme||'dark');
    if(p==='system')return matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
    return p==='light'?'light':'dark';
  }
  function applyStoredPreferences(){
    const size=String(Number(prefs.page_size||25));
    if([...byId('pageSize').options].some(o=>o.value===size))byId('pageSize').value=size;
    if(typeof prefs.hunt_filter==='string'&&[...byId('hunt').options].some(o=>o.value===prefs.hunt_filter))byId('hunt').value=prefs.hunt_filter;
    if(typeof prefs.decision_filter==='string'&&[...byId('decision').options].some(o=>o.value===prefs.decision_filter))byId('decision').value=prefs.decision_filter;
    if(Array.isArray(prefs.visible_columns)&&prefs.visible_columns.length){
      const keys=prefs.visible_columns.filter(k=>validColumnKeys.has(k));
      if(keys.length>=4){
        visible=new Set(keys);
        localStorage.setItem('sh_columns_v407',JSON.stringify(keys));
        renderColumnOptions();
      }
    }
    const wantLight=desiredTheme()==='light';
    const isLight=document.documentElement.dataset.theme==='light';
    if(wantLight!==isLight)byId('themeToggle').click();
    const soundPref=prefs.notification_settings&&typeof prefs.notification_settings.sound==='boolean'?prefs.notification_settings.sound:null;
    if(soundPref!==null&&Boolean(sound)!==soundPref)byId('soundBtn').click();
  }

  function saveState(text='تنظیمات ذخیره شد',type='ok'){
    const el=byId('personalSaveStateV417');
    el.textContent=text;
    el.dataset.state=type;
  }
  async function savePreferencesNow(){
    if(hydrating)return;
    saveState('در حال ذخیره…','busy');
    const payload={
      theme:document.documentElement.dataset.theme==='light'?'light':'dark',
      page_size:Number(byId('pageSize').value||25),
      visible_columns:[...visible],
      hunt_filter:byId('hunt').value||null,
      decision_filter:byId('decision').value||null,
      notification_settings:{...(prefs.notification_settings||{}),sound:Boolean(sound)}
    };
    const {error}=await supabase.from('stock_hunter_user_preferences_v417').update(payload).eq('user_id',user.id);
    if(error){saveState('خطا در ذخیره تنظیمات','bad');return;}
    Object.assign(prefs,payload);
    saveState('تنظیمات همگام است','ok');
  }
  function queuePreferenceSave(){
    if(hydrating)return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>savePreferencesNow().catch(()=>saveState('خطا در ذخیره تنظیمات','bad')),350);
  }

  async function loadWatchlists(preferred=''){
    const {data,error}=await supabase.from('stock_hunter_watchlists_v417')
      .select('watchlist_id,name,created_at').eq('user_id',user.id).order('created_at',{ascending:true});
    if(error)throw error;
    watchlists=data||[];
    const sel=byId('personalWatchlistV417');
    sel.innerHTML='<option value="">واچ‌لیست شخصی</option>'+watchlists.map(w=>'<option value="'+esc(w.watchlist_id)+'">'+esc(w.name)+'</option>').join('');
    activeWatchlistId=preferred&&watchlists.some(w=>w.watchlist_id===preferred)?preferred:(activeWatchlistId&&watchlists.some(w=>w.watchlist_id===activeWatchlistId)?activeWatchlistId:(watchlists[0]?.watchlist_id||''));
    sel.value=activeWatchlistId;
    await loadWatchlistItems();
  }
  async function ensureWatchlist(){
    if(activeWatchlistId)return activeWatchlistId;
    const {data,error}=await supabase.from('stock_hunter_watchlists_v417')
      .insert({user_id:user.id,name:'واچ‌لیست من'}).select('watchlist_id,name,created_at').single();
    if(error)throw error;
    await loadWatchlists(data.watchlist_id);
    return data.watchlist_id;
  }
  async function loadWatchlistItems(){
    watchlistIds=new Set();
    if(activeWatchlistId){
      const {data,error}=await supabase.from('stock_hunter_watchlist_items_v417')
        .select('ins_code,symbol').eq('user_id',user.id).eq('watchlist_id',activeWatchlistId);
      if(error)throw error;
      for(const item of data||[])watchlistIds.add(String(item.ins_code));
    }
    updateWatchlistControls();
    page=1;
    render();
  }
  function updateWatchlistControls(){
    byId('watchlistCountV417').textContent=watchlistIds.size.toLocaleString('fa-IR')+' نماد';
    const btn=byId('watchlistOnlyV417');
    btn.setAttribute('aria-pressed',watchlistOnly?'true':'false');
    btn.textContent=(watchlistOnly?'★':'☆')+' فقط واچ‌لیست';
    btn.disabled=!activeWatchlistId;
  }
  async function toggleSavedSymbol(id,symbol){
    const listId=await ensureWatchlist();
    id=String(id);
    if(watchlistIds.has(id)){
      const {error}=await supabase.from('stock_hunter_watchlist_items_v417')
        .delete().eq('user_id',user.id).eq('watchlist_id',listId).eq('ins_code',id);
      if(error)throw error;
      watchlistIds.delete(id);
    }else{
      const {error}=await supabase.from('stock_hunter_watchlist_items_v417')
        .insert({watchlist_id:listId,user_id:user.id,ins_code:id,symbol:String(symbol||'')});
      if(error)throw error;
      watchlistIds.add(id);
    }
    updateWatchlistControls();
    render();
  }

  const filteredBeforePersonalV417=filtered;
  filtered=function(){
    const out=filteredBeforePersonalV417();
    return watchlistOnly?out.filter(x=>watchlistIds.has(String(x.id))):out;
  };

  const cellBeforePersonalV417=cell;
  cell=function(k,x){
    const base=cellBeforePersonalV417(k,x);
    if(k!=='symbol')return base;
    const saved=watchlistIds.has(String(x.id));
    return '<div class="personal-symbol-row-v417">'+
      '<button type="button" class="personal-star-v417'+(saved?' saved':'')+'" data-watch-id="'+esc(x.id)+'" data-watch-symbol="'+esc(x.symbol)+'" title="'+(saved?'حذف از واچ‌لیست':'افزودن به واچ‌لیست')+'" aria-label="'+(saved?'حذف از واچ‌لیست':'افزودن به واچ‌لیست')+'">'+(saved?'★':'☆')+'</button>'+
      '<div>'+base+'</div></div>';
  };

  function decorateMobile(){
    document.querySelectorAll('#mobileList .mobile-card').forEach(card=>{
      if(card.querySelector('.personal-star-v417'))return;
      const detail=card.querySelector('.detail-btn[data-id]');
      if(!detail)return;
      const id=detail.dataset.id;
      const row=rows.find(x=>String(x.id)===String(id));
      const star=document.createElement('button');
      star.type='button';
      star.className='personal-star-v417'+(watchlistIds.has(String(id))?' saved':'');
      star.dataset.watchId=String(id);
      star.dataset.watchSymbol=row?.symbol||'';
      star.textContent=watchlistIds.has(String(id))?'★':'☆';
      star.title=watchlistIds.has(String(id))?'حذف از واچ‌لیست':'افزودن به واچ‌لیست';
      card.querySelector('.mobile-foot')?.prepend(star);
    });
  }
  const renderBeforePersonalV417=render;
  render=function(...args){
    const out=renderBeforePersonalV417(...args);
    decorateMobile();
    return out;
  };

  document.addEventListener('click',async e=>{
    const star=e.target.closest('.personal-star-v417[data-watch-id]');
    if(!star)return;
    e.preventDefault();
    e.stopPropagation();
    star.disabled=true;
    try{
      await toggleSavedSymbol(star.dataset.watchId,star.dataset.watchSymbol);
      saveState('واچ‌لیست همگام شد','ok');
    }catch(err){
      saveState(err?.message||'خطا در واچ‌لیست','bad');
    }finally{star.disabled=false;}
  },true);

  byId('personalWatchlistV417').addEventListener('change',async()=>{
    activeWatchlistId=byId('personalWatchlistV417').value;
    watchlistOnly=false;
    await loadWatchlistItems().catch(err=>saveState(err?.message||'خطا در واچ‌لیست','bad'));
  });
  byId('createWatchlistV417').addEventListener('click',async()=>{
    const name=prompt('نام واچ‌لیست جدید:','واچ‌لیست جدید');
    if(!name||!name.trim())return;
    const {data,error}=await supabase.from('stock_hunter_watchlists_v417')
      .insert({user_id:user.id,name:name.trim().slice(0,80)}).select('watchlist_id').single();
    if(error){saveState(error.message,'bad');return;}
    await loadWatchlists(data.watchlist_id);
    saveState('واچ‌لیست ساخته شد','ok');
  });
  byId('watchlistOnlyV417').addEventListener('click',()=>{
    if(!activeWatchlistId)return;
    watchlistOnly=!watchlistOnly;
    page=1;
    updateWatchlistControls();
    render();
  });
  byId('personalSignOutV417').addEventListener('click',async()=>{
    await supabase.auth.signOut();
    location.replace('auth-v417.html');
  });

  for(const id of ['hunt','decision','pageSize'])byId(id).addEventListener('change',queuePreferenceSave);
  byId('themeToggle').addEventListener('click',()=>setTimeout(queuePreferenceSave,0));
  byId('soundBtn').addEventListener('click',()=>setTimeout(queuePreferenceSave,0));
  byId('columnOptions').addEventListener('change',()=>setTimeout(queuePreferenceSave,0));
  byId('defaultColumns').addEventListener('click',()=>setTimeout(queuePreferenceSave,0));
  byId('allColumns').addEventListener('click',()=>setTimeout(queuePreferenceSave,0));

  applyStoredPreferences();
  await loadWatchlists();
  await supabase.from('stock_hunter_profiles_v417').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
  hydrating=false;
  document.body.classList.remove('v417-auth-pending');
  if(gate)gate.hidden=true;
  render();
  saveState('تنظیمات همگام است','ok');

  supabase.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT')location.replace('auth-v417.html');
  });
})().catch(err=>{
  const gate=document.getElementById('v417AuthGate');
  if(gate){
    gate.hidden=false;
    gate.innerHTML='<div><b>راه‌اندازی محیط شخصی ناموفق بود</b><span>'+String(err?.message||'خطای ناشناخته').replace(/[&<>"']/g,'')+'</span></div>';
  }
});