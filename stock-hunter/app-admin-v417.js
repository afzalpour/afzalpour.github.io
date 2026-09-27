import { supabase } from './app-auth-v417.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let actorRole='user';
let users=[];

function msg(text,type='info'){
  const el=$('adminMessage');
  if(!el)return;
  el.textContent=String(text||'');
  el.dataset.type=type;
  el.hidden=!text;
}
async function invoke(body){
  const {data,error}=await supabase.functions.invoke('stock-hunter-admin-v417',{body});
  if(error)throw new Error(error.message||'Admin API error');
  if(data?.error)throw new Error(data.error);
  return data;
}
function fmtDate(v){if(!v)return '—';const d=new Date(v);return Number.isFinite(+d)?d.toLocaleString('fa-IR'):'—';}
function roleFa(r){return r==='owner_admin'?'مالک اصلی':r==='admin'?'ادمین':'کاربر';}
function statusFa(s){return s==='suspended'?'تعلیق':'فعال';}

function renderUsers(){
  const host=$('adminUsersBody');
  host.innerHTML=users.length?users.map(u=>{
    const isOwner=u.role==='owner_admin';
    const canRole=actorRole==='owner_admin'&&!isOwner;
    const canSuspend=!isOwner&&(actorRole==='owner_admin'||(actorRole==='admin'&&u.role==='user'));
    return '<tr>'+
      '<td><b>'+esc(u.email||'—')+'</b><small>'+esc(u.display_name||'')+'</small></td>'+
      '<td><span class="admin-role admin-role-'+esc(u.role)+'">'+roleFa(u.role)+'</span></td>'+
      '<td><span class="admin-status admin-status-'+esc(u.account_status)+'">'+statusFa(u.account_status)+'</span></td>'+
      '<td>'+fmtDate(u.created_at)+'</td>'+
      '<td>'+fmtDate(u.last_sign_in_at)+'</td>'+
      '<td class="admin-actions-cell">'+
      (canRole?'<select data-role-target="'+u.id+'"><option value="user" '+(u.role==='user'?'selected':'')+'>کاربر</option><option value="admin" '+(u.role==='admin'?'selected':'')+'>ادمین</option></select><button data-set-role="'+u.id+'">ثبت نقش</button>':'')+
      (canSuspend?(u.account_status==='suspended'?'<button data-reactivate="'+u.id+'">فعال‌سازی</button>':'<button data-suspend="'+u.id+'" class="danger">تعلیق</button>'):'')+
      (isOwner?'<span class="admin-protected">محافظت‌شده</span>':'')+
      '</td></tr>';
  }).join(''):'<tr><td colspan="6">کاربری وجود ندارد.</td></tr>';

  host.querySelectorAll('[data-set-role]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.dataset.setRole;
    const sel=host.querySelector('[data-role-target="'+id+'"]');
    await doMutation({action:'set_role',target_user_id:id,role:sel.value},'نقش کاربر به‌روزرسانی شد.');
  }));
  host.querySelectorAll('[data-suspend]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('این کاربر تعلیق شود؟'))return;
    await doMutation({action:'suspend',target_user_id:b.dataset.suspend},'کاربر تعلیق شد.');
  }));
  host.querySelectorAll('[data-reactivate]').forEach(b=>b.addEventListener('click',async()=>{
    await doMutation({action:'reactivate',target_user_id:b.dataset.reactivate},'کاربر دوباره فعال شد.');
  }));
}

async function loadUsers(){
  msg('در حال خواندن کاربران…');
  const data=await invoke({action:'list_users',page:1,per_page:100});
  users=data.users||[];
  renderUsers();
  $('adminUserCount').textContent=users.length.toLocaleString('fa-IR');
  msg('');
}
async function loadAudit(){
  const panel=$('auditPanel');
  if(actorRole!=='owner_admin'){panel.hidden=true;return;}
  panel.hidden=false;
  const data=await invoke({action:'list_audit',limit:80});
  const rows=data.audit||[];
  $('adminAuditBody').innerHTML=rows.length?rows.map(a=>'<tr><td>'+fmtDate(a.created_at)+'</td><td>'+esc(a.action)+'</td><td><code>'+esc(a.actor_user_id||'—')+'</code></td><td><code>'+esc(a.target_user_id||'—')+'</code></td></tr>').join(''):'<tr><td colspan="4">Audit خالی است.</td></tr>';
}
async function doMutation(payload,successText){
  try{
    msg('در حال اعمال تغییر…');
    await invoke(payload);
    await Promise.all([loadUsers(),loadAudit()]);
    msg(successText,'ok');
  }catch(err){msg(err?.message||'عملیات مدیریتی ناموفق بود.','bad');}
}
async function init(){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(!session){location.replace('auth-v417.html?next=admin-v417.html');return;}
  const uid=session.user.id;
  const [{data:roleRow,error:roleError},{data:profile,error:profileError}]=await Promise.all([
    supabase.from('stock_hunter_user_roles_v417').select('role').eq('user_id',uid).single(),
    supabase.from('stock_hunter_profiles_v417').select('account_status').eq('user_id',uid).single()
  ]);
  if(roleError||profileError||profile?.account_status!=='active')throw new Error('دسترسی مدیریتی فعال نیست.');
  actorRole=roleRow?.role||'user';
  if(!['owner_admin','admin'].includes(actorRole))throw new Error('این حساب دسترسی مدیریتی ندارد.');
  $('adminActorEmail').textContent=session.user.email||'—';
  $('adminActorRole').textContent=roleFa(actorRole);
  await Promise.all([loadUsers(),loadAudit()]);
  $('adminRefresh').addEventListener('click',()=>Promise.all([loadUsers(),loadAudit()]).catch(e=>msg(e.message,'bad')));
  $('adminSignOut').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('auth-v417.html');});
}
init().catch(err=>{msg(err?.message||'راه‌اندازی کنسول مدیریت ناموفق بود.','bad');if($('adminGrid'))$('adminGrid').hidden=true;});
