import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const cfg=window.STOCK_HUNTER_CONFIG||{};
const url=String(cfg.SUPABASE_URL||'').replace(/\/$/,'');
const key=cfg.SUPABASE_PUBLISHABLE_KEY||'';
if(!url||!key) throw new Error('Stock Hunter Supabase configuration is unavailable.');

export const supabase=createClient(url,key,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    flowType:'pkce'
  }
});

const $=id=>document.getElementById(id);
const fa=v=>Number(v||0).toLocaleString('fa-IR');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function message(text,type='info'){
  const el=$('authMessage');
  if(!el)return;
  el.textContent=String(text||'');
  el.dataset.type=type;
  el.hidden=!text;
}

async function currentSession(){
  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  return data.session||null;
}

async function loadOwnData(userId){
  const [roleRes,profileRes,prefRes,watchRes]=await Promise.all([
    supabase.from('stock_hunter_user_roles_v417').select('role,created_at,updated_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_profiles_v417').select('user_id,display_name,avatar_url,account_status,created_at,updated_at,last_seen_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_user_preferences_v417').select('theme,page_size,visible_columns,hunt_filter,decision_filter,notification_settings,updated_at').eq('user_id',userId).maybeSingle(),
    supabase.from('stock_hunter_watchlists_v417').select('watchlist_id,name,created_at,updated_at').eq('user_id',userId).order('created_at',{ascending:true})
  ]);
  for(const r of [roleRes,profileRes,prefRes,watchRes]) if(r.error) throw r.error;
  return {role:roleRes.data,profile:profileRes.data,preferences:prefRes.data,watchlists:watchRes.data||[]};
}

async function initAuthPage(){
  if(!$('authForm'))return;
  const params=new URLSearchParams(location.search);
  const next=params.get('next')||'profile-v417.html';
  const mode=params.get('mode')||'signin';

  const setMode=m=>{
    document.body.dataset.authMode=m;
    document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===m));
    $('displayNameWrap').hidden=m!=='signup';
    $('passwordWrap').hidden=m==='recovery';
    $('newPasswordWrap').hidden=m!=='reset';
    $('authSubmit').textContent=m==='signup'?'ساخت حساب':m==='recovery'?'ارسال لینک بازیابی':m==='reset'?'ثبت رمز جدید':'ورود';
  };
  setMode(mode);

  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{message('');setMode(b.dataset.authTab);}));

  const session=await currentSession().catch(()=>null);
  if(session && mode!=='reset'){
    $('alreadySignedIn').hidden=false;
    $('alreadySignedInEmail').textContent=session.user?.email||'';
  }

  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();
    message('در حال انجام…');
    const m=document.body.dataset.authMode||'signin';
    const email=$('email').value.trim();
    const password=$('password').value;
    try{
      if(m==='signup'){
        const displayName=$('displayName').value.trim();
        const {data,error}=await supabase.auth.signUp({
          email,password,
          options:{
            data:{display_name:displayName||null},
            emailRedirectTo:new URL('auth-v417.html?verified=1',location.href).href
          }
        });
        if(error)throw error;
        if(data.session){
          location.href=next;
          return;
        }
        message('حساب ساخته شد. اگر تأیید ایمیل فعال باشد، لینک تأیید را باز کن و سپس وارد شو.','ok');
      }else if(m==='recovery'){
        const {error}=await supabase.auth.resetPasswordForEmail(email,{
          redirectTo:new URL('auth-v417.html?mode=reset',location.href).href
        });
        if(error)throw error;
        message('اگر این ایمیل معتبر باشد، لینک بازیابی ارسال شد.','ok');
      }else if(m==='reset'){
        const np=$('newPassword').value;
        if(np.length<8)throw new Error('رمز جدید باید حداقل ۸ کاراکتر باشد.');
        const {error}=await supabase.auth.updateUser({password:np});
        if(error)throw error;
        message('رمز جدید ثبت شد.','ok');
        setTimeout(()=>location.href=next,500);
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        if(!data.session)throw new Error('Session ساخته نشد.');
        location.href=next;
      }
    }catch(err){
      message(err?.message||'عملیات ورود ناموفق بود.','bad');
    }
  });

  $('continueSession')?.addEventListener('click',()=>location.href=next);
  $('signOutHere')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.reload();});

  supabase.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY')setMode('reset');
  });
}

async function initProfilePage(){
  if(!$('profilePage'))return;
  const session=await currentSession();
  if(!session){
    location.replace('auth-v417.html?next=profile-v417.html');
    return;
  }
  const user=session.user;
  $('profileEmail').textContent=user.email||'—';
  $('profileUserId').textContent=user.id;
  $('profileCreated').textContent=user.created_at?new Date(user.created_at).toLocaleString('fa-IR'):'—';

  try{
    const data=await loadOwnData(user.id);
    $('profileRole').textContent=data.role?.role||'user';
    $('profileStatus').textContent=data.profile?.account_status||'active';
    $('displayName').value=data.profile?.display_name||'';
    $('avatarUrl').value=data.profile?.avatar_url||'';
    $('prefTheme').value=data.preferences?.theme||'dark';
    $('prefPageSize').value=String(data.preferences?.page_size||25);
    renderWatchlists(data.watchlists);
    if(['owner_admin','admin'].includes(data.role?.role||''))$('adminHint').hidden=false;
  }catch(err){
    message(err?.message||'خواندن پروفایل ناموفق بود.','bad');
  }

  $('profileForm').addEventListener('submit',async e=>{
    e.preventDefault();message('در حال ذخیره…');
    const {error}=await supabase.from('stock_hunter_profiles_v417')
      .update({
        display_name:$('displayName').value.trim()||null,
        avatar_url:$('avatarUrl').value.trim()||null,
        last_seen_at:new Date().toISOString()
      }).eq('user_id',user.id);
    if(error)return message(error.message,'bad');
    message('پروفایل ذخیره شد.','ok');
  });

  $('preferencesForm').addEventListener('submit',async e=>{
    e.preventDefault();message('در حال ذخیره تنظیمات…');
    const {error}=await supabase.from('stock_hunter_user_preferences_v417')
      .update({
        theme:$('prefTheme').value,
        page_size:Number($('prefPageSize').value)
      }).eq('user_id',user.id);
    if(error)return message(error.message,'bad');
    message('تنظیمات ذخیره شد.','ok');
  });

  $('watchlistForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('watchlistName').value.trim();
    if(!name)return;
    const {error}=await supabase.from('stock_hunter_watchlists_v417').insert({user_id:user.id,name});
    if(error)return message(error.message,'bad');
    $('watchlistName').value='';
    const {data,error:readError}=await supabase.from('stock_hunter_watchlists_v417').select('watchlist_id,name,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:true});
    if(readError)return message(readError.message,'bad');
    renderWatchlists(data||[]);
    message('واچ‌لیست ساخته شد.','ok');
  });

  $('profileSignOut').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('auth-v417.html');});
}

function renderWatchlists(items){
  const host=$('watchlistList');
  if(!host)return;
  host.innerHTML=items.length?items.map(w=>`<div class="profile-list-row"><b>${esc(w.name)}</b><small>${new Date(w.created_at).toLocaleDateString('fa-IR')}</small></div>`).join(''):'<div class="profile-empty">هنوز واچ‌لیستی ساخته نشده است.</div>';
}

initAuthPage().catch(err=>message(err?.message||'خطای راه‌اندازی Auth','bad'));
initProfilePage().catch(err=>message(err?.message||'خطای راه‌اندازی پروفایل','bad'));
