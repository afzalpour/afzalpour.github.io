'use strict';
const holdCfg=window.STOCK_HUNTER_CONFIG||{};
const hold$=id=>document.getElementById(id);
const holdFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function holdHeaders(){const k=holdCfg.SUPABASE_PUBLISHABLE_KEY||holdCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function holdStateLabel(v){const m={IDLE_NO_ACTIVE_CANARY:'IDLE — NO ACTIVE CANARY',OBSERVING:'OBSERVING',PASS:'PASS',HOLD:'HOLD',ROLLBACK_RECOMMENDED:'ROLLBACK RECOMMENDED'};return m[String(v||'')]||String(v||'—')}
function holdStateClass(v){return ['PASS','IDLE_NO_ACTIVE_CANARY'].includes(String(v||''))?'ok-text':String(v||'')==='OBSERVING'?'muted':'warn-text'}
function ensureCanaryHoldRollbackSurfaceV417(){
  if(hold$('holdRollbackState'))return;
  const anchor=hold$('expansionPolicyBody')?.closest('.section')||hold$('telemetryMetricsBody')?.closest('.section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend',`<section class="section note"><strong>Canary Hold / Rollback Gate:</strong> این Gate فقط کنترل عملیاتی است. Telemetry بدون Capture سالم از <strong>۲۰ دقیقه</strong> Expansion را Hold می‌کند؛ اگر Active Canary تا <strong>۴۰ دقیقه</strong> بدون Telemetry سالم بماند، Rollback توصیه می‌شود. Severe divergence فقط پس از حداقل Evidence فریز‌شده می‌تواند به Rollback Recommendation ارتقا یابد. <strong>Auto-Rollback و Auto-Kill خاموش‌اند</strong> و هیچ مسیر نوشتنی عمومی در این صفحه وجود ندارد.</section>
<section class="cards"><article class="card"><span>Hold / Rollback State</span><b id="holdRollbackState" class="ok-text" style="font-size:15px">IDLE</b><small id="holdRollbackGuards">—</small></article><article class="card"><span>Challenger Traffic</span><b id="holdRollbackTraffic">۰٪</b></article><article class="card"><span>Telemetry Age / Hold</span><b id="holdRollbackAge">— / ۲۰ دقیقه</b></article><article class="card"><span>Rollback Stale Threshold</span><b id="holdRollbackStale">۴۰ دقیقه</b></article><article class="card"><span>Pairs / Rollback Evidence</span><b id="holdRollbackPairs">۰ / ۳۰</b></article><article class="card"><span>Divergence Guard</span><b id="holdRollbackDivergence">CLEAR</b></article><article class="card"><span>Expansion</span><b id="holdRollbackExpansion" class="ok-text">BLOCKED</b></article><article class="card"><span>Automatic Action</span><b id="holdRollbackAuto" class="ok-text" style="font-size:14px">OFF — MANUAL ONLY</b></article></section>
<section class="section note"><b>Rollback Safety Contract — Frozen</b><p id="holdRollbackPolicy">—</p><p id="holdRollbackDetail" class="muted">Rollback داخلی با State Version و Audit Event انجام می‌شود؛ Browser فقط Gate را مشاهده می‌کند.</p></section>`);
}
function renderCanaryHoldRollbackV417(p,g){
  ensureCanaryHoldRollbackSurfaceV417();
  const state=hold$('holdRollbackState');
  if(state){state.textContent=holdStateLabel(g.gate_state);state.className=holdStateClass(g.gate_state)}
  const guards=Array.isArray(g.triggered_guards)?g.triggered_guards:[];
  hold$('holdRollbackGuards').textContent=guards.length?guards.join(' · '):'بدون Guard فعال';
  hold$('holdRollbackTraffic').textContent=`${holdFa(g.challenger_traffic_percent)}٪`;
  hold$('holdRollbackAge').textContent=`${g.telemetry_age_minutes==null?'—':holdFa(g.telemetry_age_minutes)} / ${holdFa(g.hold_stale_after_minutes||p.hold_stale_after_minutes)} دقیقه`;
  hold$('holdRollbackStale').textContent=`${holdFa(g.rollback_stale_after_minutes||p.rollback_stale_after_minutes)} دقیقه`;
  hold$('holdRollbackPairs').textContent=`${holdFa(g.min_routed_pairs_observed)} / ${holdFa(g.min_pairs_per_mode_for_rollback||p.min_pairs_per_mode_for_rollback)}`;
  const div=g.severe_breach?'SEVERE':g.hold_breach?'HOLD BREACH':'CLEAR';
  hold$('holdRollbackDivergence').textContent=div;
  hold$('holdRollbackDivergence').className=div==='CLEAR'?'ok-text':'warn-text';
  hold$('holdRollbackExpansion').textContent=g.expansion_blocked?'BLOCKED':'PASS';
  hold$('holdRollbackExpansion').className=g.expansion_blocked?'warn-text':'ok-text';
  hold$('holdRollbackAuto').textContent=g.auto_rollback?'ON':'OFF — MANUAL ONLY';
  hold$('holdRollbackAuto').className=g.auto_rollback?'warn-text':'ok-text';
  hold$('holdRollbackPolicy').textContent=`Hold stale=${holdFa(p.hold_stale_after_minutes)} دقیقه؛ Rollback stale=${holdFa(p.rollback_stale_after_minutes)} دقیقه؛ حداقل ${holdFa(p.min_pairs_per_mode_for_rollback)} Pair در هر Mode برای Severe rollback؛ Hold on capture error=${p.hold_on_capture_error?'ON':'OFF'}؛ Rollback on severe=${p.rollback_on_severe_breach?'ON':'OFF'}؛ Auto-rollback=${p.auto_rollback?'ON':'OFF'}.`;
  hold$('holdRollbackDetail').textContent=g.rollback_recommended?'Rollback توصیه شده است؛ اقدام فقط از Control Plane داخلی و با بررسی State Version مجاز است.':g.gate_state==='HOLD'?'Expansion متوقف است؛ Canary باید تا رفع Guard در همین Stage بماند.':g.gate_state==='OBSERVING'?'Stage در حال جمع‌آوری Evidence است و Expansion مجاز نیست.':'Rollback خودکار انجام نمی‌شود؛ Kill Switch و Rollback فقط عملیات داخلی صریح هستند.';
}
async function loadCanaryHoldRollbackV417(){
  ensureCanaryHoldRollbackSurfaceV417();
  const base=String(holdCfg.SUPABASE_URL||holdCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  try{
    const [pr,gr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_canary_hold_rollback_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:holdHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_hold_rollback_gate_v417?select=*&limit=1`,{headers:holdHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!gr.ok)throw new Error('Canary Hold/Rollback API unavailable');
    renderCanaryHoldRollbackV417((await pr.json())[0]||{},(await gr.json())[0]||{});
  }catch(e){
    const state=hold$('holdRollbackState');if(state){state.textContent='READ ERROR';state.className='warn-text'}
    const detail=hold$('holdRollbackDetail');if(detail)detail.textContent=e?.message||'خطا در دریافت Hold/Rollback Gate';
  }
}
ensureCanaryHoldRollbackSurfaceV417();
const holdRefresh=hold$('refreshRoll');if(holdRefresh)holdRefresh.addEventListener('click',loadCanaryHoldRollbackV417);
loadCanaryHoldRollbackV417();
