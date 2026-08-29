(function(g){
  'use strict';
  const SESSION_KEY='avan_cloud_session_v1';
  const cfg=g.AVAN_CONFIG||{};
  function required(){if(!cfg.supabaseUrl||!cfg.supabasePublishableKey)throw new Error('CLOUD_CONFIG_MISSING')}
  const base=()=>String(cfg.supabaseUrl||'').replace(/\/$/,'');
  function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function saveSession(s){if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}
  function apiError(payload,status){const e=new Error(payload?.message||payload?.msg||payload?.error_description||payload?.error||`HTTP_${status}`);e.status=status;e.payload=payload;return e}
  async function raw(path,{method='GET',body=null,token=null,prefer=null,headers={}}={}){
    required();
    const h={apikey:cfg.supabasePublishableKey,...headers};
    if(token)h.Authorization=`Bearer ${token}`;
    if(body!==null){h['Content-Type']='application/json';body=JSON.stringify(body)}
    if(prefer)h.Prefer=prefer;
    const res=await fetch(base()+path,{method,headers:h,body});
    const text=await res.text();
    let data=null; if(text){try{data=JSON.parse(text)}catch{data=text}}
    if(!res.ok)throw apiError(data,res.status);
    return data;
  }
  async function refreshIfNeeded(){
    let s=session(); if(!s)return null;
    const exp=Number(s.expires_at||0)*1000;
    if(exp && Date.now()<exp-60000)return s;
    if(!s.refresh_token)return s;
    try{
      const data=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});
      saveSession(data); return data;
    }catch(e){saveSession(null);throw e}
  }
  async function token(){const s=await refreshIfNeeded();return s?.access_token||null}
  async function authed(path,opts={}){const t=await token();if(!t)throw new Error('AUTH_REQUIRED');return raw(path,{...opts,token:t})}
  async function signup(email,password){
    const data=await raw('/auth/v1/signup',{method:'POST',body:{email,password,data:{app:'avan'}}});
    if(data?.access_token)saveSession(data);
    return data;
  }
  async function login(email,password){const data=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveSession(data);return data}
  async function logout(){try{const t=await token();if(t)await raw('/auth/v1/logout',{method:'POST',token:t})}finally{saveSession(null)}}
  async function user(){const t=await token();if(!t)return null;return raw('/auth/v1/user',{token:t})}
  const enc=v=>encodeURIComponent(v);
  async function select(table,query=''){return authed(`/rest/v1/${table}${query?`?${query}`:''}`)}
  async function insert(table,rows,selectFields='*'){return authed(`/rest/v1/${table}?select=${enc(selectFields)}`,{method:'POST',body:rows,prefer:'return=representation'})}
  async function update(table,patch,query,selectFields='*'){return authed(`/rest/v1/${table}?${query}&select=${enc(selectFields)}`,{method:'PATCH',body:patch,prefer:'return=representation'})}
  async function remove(table,query){return authed(`/rest/v1/${table}?${query}`,{method:'DELETE',prefer:'return=representation'})}
  async function rpc(name,args={}){return authed(`/rest/v1/rpc/${name}`,{method:'POST',body:args})}
  g.AvanCloud={cfg,SESSION_KEY,session,saveSession,signup,login,logout,user,select,insert,update,remove,rpc,token};
})(window);
