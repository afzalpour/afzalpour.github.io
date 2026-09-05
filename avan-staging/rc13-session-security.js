'use strict';

const IDLE_LIMIT_MS=60*60*1000;
const MAX_SESSION_MS=12*60*60*1000;
const HEARTBEAT_MS=60*1000;
const ACTIVITY_THROTTLE_MS=30*1000;
const KEY_USER='avan.security.user_id';
const KEY_STARTED='avan.security.started_at';
const KEY_ACTIVITY='avan.security.last_activity_at';
const KEY_REASON='avan.security.logout_reason';
let lastActivityWrite=0;
let signingOut=false;

function store(){try{return window.localStorage}catch{return null}}
function sessionStore(){try{return window.sessionStorage}catch{return null}}
function now(){return Date.now()}
function readNumber(key){const n=Number(store()?.getItem(key)||0);return Number.isFinite(n)?n:0}
function clearMarkers(){const s=store();[KEY_USER,KEY_STARTED,KEY_ACTIVITY].forEach(k=>s?.removeItem(k))}
function initializeFor(userId){const s=store();const t=now();s?.setItem(KEY_USER,userId);s?.setItem(KEY_STARTED,String(t));s?.setItem(KEY_ACTIVITY,String(t));lastActivityWrite=t}

async function currentUser(){try{return await window.AvanCloud?.user?.()}catch{return null}}

function touch(){
  if(signingOut)return;
  const t=now();
  if(t-lastActivityWrite<ACTIVITY_THROTTLE_MS)return;
  const s=store();if(!s?.getItem(KEY_USER))return;
  s.setItem(KEY_ACTIVITY,String(t));lastActivityWrite=t;
}

async function forceLogout(reason){
  if(signingOut)return;signingOut=true;
  try{sessionStore()?.setItem(KEY_REASON,reason);await window.AvanCloud?.logout?.()}catch(error){console.warn('[Avan security] forced logout failed',error)}
  clearMarkers();
  try{sessionStorage.removeItem('avan.active_workspace_id')}catch{}
  location.reload();
}

async function check(){
  const user=await currentUser();
  if(!user?.id){clearMarkers();return}
  const s=store();const known=s?.getItem(KEY_USER)||'';
  if(known!==user.id){initializeFor(user.id);return}
  let started=readNumber(KEY_STARTED),last=readNumber(KEY_ACTIVITY);
  if(!started||!last){initializeFor(user.id);return}
  const t=now();
  if(t-started>=MAX_SESSION_MS)return forceLogout('حداکثر زمان نشست امنیتی آوان به پایان رسید. لطفاً دوباره وارد شوید.');
  if(t-last>=IDLE_LIMIT_MS)return forceLogout('به‌دلیل ۶۰ دقیقه عدم فعالیت، برای امنیت حساب از آوان خارج شدید.');
}

function showReason(){const ss=sessionStore();const reason=ss?.getItem(KEY_REASON);if(!reason)return;ss.removeItem(KEY_REASON);const status=document.getElementById('authStatus');if(status)status.innerHTML=`<span class="info-box" style="display:block">${reason}</span>`}

function install(){
  ['pointerdown','keydown','touchstart','wheel'].forEach(type=>document.addEventListener(type,touch,{capture:true,passive:true}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  const observer=new MutationObserver(()=>check());
  const app=document.getElementById('appShell');if(app)observer.observe(app,{attributes:true,attributeFilter:['hidden']});
  showReason();check();window.setInterval(check,HEARTBEAT_MS);
  window.AvanSessionSecurity=Object.freeze({idleMinutes:60,maxHours:12,check});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
