import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const cfg=window.STOCK_HUNTER_CONFIG||{};
const url=String(cfg.SUPABASE_URL||'').replace(/\/$/,'');
const key=cfg.SUPABASE_PUBLISHABLE_KEY||'';
if(!url||!key) throw new Error('Stock Hunter Supabase configuration is unavailable.');

export const supabase=createClient(url,key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
});

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const SAFE_NEXT=new Set(['profile-v417.html','index-v417.html','admin-v417.html']);

function message(text,type='info'){
  const el=$('authMessage'); if(!el)return;
  el.textContent=String(text||''); el.dataset.type=type; el.hidden=!text;
}
function safeNext(params){
  const raw=String(params.get('next')||'profile-v417.html').trim();
  return SAFE_NEXT.has(raw)?raw:'profile-v417.html';
}
async function currentSession(){
  const {data,error}=await supabase.auth.getSession();
  if(error)throw error;
  return data.session||null;
}
async function verifiedUser(){
  const {data,error}=await supabase.auth.getUser();
  if(error)throw error;
  return data.user||null;
}
async function loadOwnData(userId){
  const [roleRes,profileRes,prefRes,watchRes]=await Promise.all([
    supabase.from('stock_hunter_user_roles_v417').select('role,created_at,updated_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_profiles_v417').select('user_id,display_name,avatar_url,account_status,created_at,updated_at,last_seen_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_user_preferences_v417').select('theme,page_size,visible_columns,hunt_filter,decision_filter,notification_settings,updated_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_watchlists_v417').select('watchlist_id,name,created_at,updated_at').eq('user_id',userId).order('created_at',{ascending:true})
  ]);
  for(const r of [roleRes,profileRes,prefRes,watchRes]) if(r.error)throw r.error;
  return {role:roleRes.data,profile:profileRes.data,preferences:prefRes.data,watchlists:watchRes.data||[]};
}
function avatarInitial(name,email){
  const source=String(name||email||'ک').trim();
  return source ? Array.from(source)[0] : 'ک';
}
function safeAvatarUrl(value){
  const raw=String(value||'').trim(); if(!raw)return '';
  try{
    const u=new URL(raw,location.href);
    return ['http:','https:'].includes(u.protocol)?u.href:'';
  }catch{return '';}
}
function paintIdentity(profile,user,watchlists=[]){
  const name=String(profile?.display_name||user?.email?.split('@')[0]||'کاربر شکارچی سهم');
  $('profileDisplayTitle') && ($('profileDisplayTitle').textContent=name);
  $('profileEmail') && ($('profileEmail').textContent=user?.email||'—');
  $('profileEmailDetail') && ($('profileEmailDetail').textContent=user?.email||'—');
  $('profileWatchlistCount') && ($('profileWatchlistCount').textContent=Number(watchlists.length||0).toLocaleString('fa-IR'));
  const initial=$('profileAvatarInitial'),img=$('profileAvatarImage');
  if(initial)initial.textContent=avatarInitial(name,user?.email);
  if(img){
    const src=safeAvatarUrl(profile?.avatar_url);
    if(src){img.src=src;img.hidden=false;if(initial)initial.hidden=true;}
    else{img.removeAttribute('src');img.hidden=true;if(initial)initial.hidden=false;}
  }
}

function friendlyAuthError(err,mode){
  const raw=String(err?.message||'').trim();
  if(/invalid login credentials/i.test(raw))return 'ایمیل یا رمز عبور نادرست است. اگر رمز را به خاطر ندارید از «بازیابی رمز» استفاده کنید.';
  if(/invalid.*email|email.*invalid/i.test(raw))return 'این ایمیل نامعتبر است.';
  return raw||(mode==='signin'?'ورود ناموفق بود.':'عملیات حساب ناموفق بود.');
}
function initPasswordToggles(){
  document.querySelectorAll('[data-password-toggle]').forEach(button=>{
    const input=$(button.dataset.passwordToggle);
    if(!input)return;
    const label=String(button.dataset.passwordLabel||'رمز');
    const sync=()=>{
      const visible=input.type==='text';
      button.setAttribute('aria-pressed',String(visible));
      button.setAttribute('aria-label',(visible?'مخفی کردن ':'نمایش ')+label);
      button.title=(visible?'مخفی کردن ':'نمایش ')+label;
    };
    button.addEventListener('click',()=>{
      input.type=input.type==='password'?'text':'password';
      sync();
      input.focus({preventScroll:true});
    });
    sync();
  });
}
function emailIsValid(input){
  return !!input && !!input.value.trim() && input.checkValidity();
}

async function initAuthPage(){
  if(!$('authForm'))return;
  const params=new URLSearchParams(location.search);
  const next=safeNext(params);
  const validModes=new Set(['signin','signup','recovery','reset']);
  const requestedMode=String(params.get('mode')||'signin');
  const mode=validModes.has(requestedMode)?requestedMode:'signin';
  initPasswordToggles();

  const setMode=m=>{
    document.body.dataset.authMode=m;
    document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===m));
    $('displayNameWrap').hidden=m!=='signup';
    $('passwordWrap').hidden=m==='recovery'||m==='reset';
    $('confirmPasswordWrap').hidden=m!=='signup';
    $('newPasswordWrap').hidden=m!=='reset';
    $('email').required=m!=='reset';
    $('password').required=m==='signin'||m==='signup';
    $('confirmPassword').required=m==='signup';
    $('newPassword').required=m==='reset';
    $('authSubmit').textContent=m==='signup'?'ساخت حساب':m==='recovery'?'ارسال لینک بازیابی':m==='reset'?'ثبت رمز جدید':'ورود';
  };
  setMode(mode);
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{message('');setMode(b.dataset.authTab);}));

  if(params.get('reason')==='inactive')message('این حساب فعال نیست. برای دسترسی با مدیر سامانه تماس بگیرید.','bad');

  const session=await currentSession().catch(()=>null);
  if(session&&mode!=='reset'){
    const user=await verifiedUser().catch(()=>null);
    if(user&&params.get('verified')==='1'){location.replace(next);return;}
    $('alreadySignedIn').hidden=false;
    $('alreadySignedInEmail').textContent=user?.email||session.user?.email||'';
  }

  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault(); message('در حال انجام…');
    const m=document.body.dataset.authMode||'signin';
    const emailInput=$('email');
    const email=emailInput.value.trim();
    const password=$('password').value;
    if(m!=='reset'&&!emailIsValid(emailInput)){
      message('این ایمیل نامعتبر است.','bad');
      emailInput.focus();
      return;
    }
    if((m==='signin'||m==='signup')&&!password){
      message('رمز عبور را وارد کنید.','bad');
      $('password').focus();
      return;
    }
    try{
      if(m==='signup'){
        const confirmPassword=$('confirmPassword').value;
        if(password.length<8)throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        if(password!==confirmPassword){
          message('رمز عبور و تکرار آن یکسان نیستند.','bad');
          $('confirmPassword').focus();
          return;
        }
        const displayName=$('displayName').value.trim();
        const callback=new URL('auth-v417.html',location.href);
        callback.searchParams.set('verified','1');
        callback.searchParams.set('next',next);
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||null},emailRedirectTo:callback.href}});
        if(error)throw error;
        if(data.session){location.replace(next);return;}
        message('حساب ساخته شد. ایمیل تأیید را باز کنید؛ بعد از تأیید مستقیماً وارد صفحه شخصی خودتان می‌شوید.','ok');
      }else if(m==='recovery'){
        const callback=new URL('auth-v417.html',location.href);
        callback.searchParams.set('mode','reset'); callback.searchParams.set('next',next);
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:callback.href});
        if(error)throw error;
        message('اگر این ایمیل در سامانه ثبت شده باشد، لینک بازیابی ارسال می‌شود.','ok');
      }else if(m==='reset'){
        const np=$('newPassword').value;
        if(np.length<8)throw new Error('رمز جدید باید حداقل ۸ کاراکتر باشد.');
        const {error}=await supabase.auth.updateUser({password:np});
        if(error)throw error;
        message('رمز جدید ثبت شد. در حال انتقال به صفحه شخصی…','ok');
        setTimeout(()=>location.replace(next),350);
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        if(!data.session)throw new Error('Session ساخته نشد.');
        const user=await verifiedUser();
        if(!user)throw new Error('اعتبارسنجی حساب کامل نشد.');
        location.replace(next);
      }
    }catch(err){message(friendlyAuthError(err,m),'bad');}
  });

  $('continueSession')?.addEventListener('click',()=>location.replace(next));
  $('signOutHere')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.reload();});
  supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setMode('reset');});
}

async function initProfilePage(){
  if(!$('profilePage'))return;
  const session=await currentSession();
  if(!session){location.replace('auth-v417.html?next=profile-v417.html');return;}
  const user=await verifiedUser();
  if(!user){await supabase.auth.signOut();location.replace('auth-v417.html?next=profile-v417.html');return;}

  $('profileUserId').textContent=user.id;
  $('profileCreated').textContent=user.created_at?new Date(user.created_at).toLocaleString('fa-IR'):'—';

  let data;
  try{
    data=await loadOwnData(user.id);
    if(!data.profile)throw new Error('پروفایل این حساب هنوز ایجاد نشده است.');
    if(data.profile.account_status!=='active'){
      await supabase.auth.signOut();
      location.replace('auth-v417.html?reason=inactive&next=profile-v417.html');
      return;
    }
    if(!data.role)throw new Error('نقش حساب در دسترس نیست.');
    $('profileRole').textContent=data.role.role||'user';
    $('profileStatus').textContent=data.profile.account_status;
    $('displayName').value=data.profile.display_name||'';
    $('avatarUrl').value=data.profile.avatar_url||'';
    $('prefTheme').value=data.preferences?.theme||'dark';
    $('prefPageSize').value=String(data.preferences?.page_size||25);
    renderWatchlists(data.watchlists);
    paintIdentity(data.profile,user,data.watchlists);
    if(['owner_admin','admin'].includes(data.role.role||'')){$('adminHint').hidden=false;$('adminConsoleLink').hidden=false;}
    await supabase.from('stock_hunter_profiles_v417').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
  }catch(err){
    message(err?.message||'خواندن پروفایل ناموفق بود.','bad');
    return;
  }

  $('profileForm').addEventListener('submit',async e=>{
    e.preventDefault(); message('در حال ذخیره پروفایل…');
    const patch={display_name:$('displayName').value.trim()||null,avatar_url:$('avatarUrl').value.trim()||null,last_seen_at:new Date().toISOString()};
    const {data:updated,error}=await supabase.from('stock_hunter_profiles_v417').update(patch).eq('user_id',user.id)
      .select('user_id,display_name,avatar_url,account_status,created_at,updated_at,last_seen_at').single();
    if(error)return message(error.message,'bad');
    data.profile=updated; paintIdentity(data.profile,user,data.watchlists);
    message('پروفایل ذخیره شد.','ok');
  });

  $('preferencesForm').addEventListener('submit',async e=>{
    e.preventDefault(); message('در حال ذخیره تنظیمات…');
    const {error}=await supabase.from('stock_hunter_user_preferences_v417').update({
      theme:$('prefTheme').value,page_size:Number($('prefPageSize').value)
    }).eq('user_id',user.id);
    if(error)return message(error.message,'bad');
    message('تنظیمات ذخیره شد و در بازار شخصی شما اعمال می‌شود.','ok');
  });

  $('watchlistForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('watchlistName').value.trim(); if(!name)return;
    const {error}=await supabase.from('stock_hunter_watchlists_v417').insert({user_id:user.id,name});
    if(error)return message(error.message,'bad');
    $('watchlistName').value='';
    const {data:items,error:readError}=await supabase.from('stock_hunter_watchlists_v417')
      .select('watchlist_id,name,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:true});
    if(readError)return message(readError.message,'bad');
    data.watchlists=items||[]; renderWatchlists(data.watchlists); paintIdentity(data.profile,user,data.watchlists);
    message('واچ‌لیست ساخته شد.','ok');
  });

  $('profileSignOut').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('auth-v417.html');});
  supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('auth-v417.html');});
}

function renderWatchlists(items){
  const host=$('watchlistList'); if(!host)return;
  host.innerHTML=items.length
    ?items.map(w=>`<div class="profile-list-row"><b>${esc(w.name)}</b><small>${new Date(w.created_at).toLocaleDateString('fa-IR')}</small></div>`).join('')
    :'<div class="profile-empty">هنوز واچ‌لیستی ساخته نشده است.</div>';
}

initAuthPage().catch(err=>message(err?.message||'خطای راه‌اندازی Auth','bad'));
initProfilePage().catch(err=>message(err?.message||'خطای راه‌اندازی پروفایل','bad'));
