import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const clamp=(v:number,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const pct=(a:number,b:number)=>b>0?(a/b-1)*100:0;
const range=(v:number,lo:number,hi:number)=>hi===lo?50:clamp((Number(v)-lo)/(hi-lo)*100);
const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const round10=(v:any)=>Number(num(v).toFixed(10));
const txt=(v:any)=>String(v??'').toLowerCase().replace(/ي|ى/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200dـ]+/g,' ').replace(/\s+/g,' ').trim();
function tparts(d=new Date()){const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d);const g=(k:string)=>p.find(x=>x.type===k)?.value||'';return{wd:g('weekday'),ymd:`${g('year')}-${g('month')}-${g('day')}`,hm:Number(g('hour'))*60+Number(g('minute')),iso:d.toISOString(),epochSec:d.getTime()/1000}}
function tsSec(v:any){let t=Number(v||0);if(t>1e12)t/=1000;return Number.isFinite(t)?t:0}
function ymdFromTs(ts:number){const d=new Date(tsSec(ts)*1000);if(!Number.isFinite(d.getTime()))return'';const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return`${g('year')}-${g('month')}-${g('day')}`}
function assetSession(x:any){const s=txt(`${x.symbol} ${x.company_name} ${x.asset_type||''} ${x.market||''}`),c=txt(x.company_name);if((s.includes('سپرده')&&s.includes('انرژی'))||(s.includes('کالایی')&&s.includes('انرژی')&&s.includes('صندوق')))return{tradeStart:660,end:900};if(String(x.asset_type||'').includes('کالایی')||String(x.asset_type||'').includes('گواهی')||/طلا|نقره|زعفران|سکه|شمش|گواهی/.test(s))return{tradeStart:720,end:1020};if((/صندوق|ص\.س|سرمایه گذاری/.test(c)&&/درآمد ?ثابت|درآمدثابت|[-– ]ثابت(?:$|[-– ])|ثابت-/.test(c))||/صندوق.*ثابت/.test(c))return{tradeStart:510,end:900};if(String(x.asset_type||'').includes('اوراق بدهی')||/املاک|مستغلات|تسهیلات|اوراق مسکن/.test(s)||/^(اخزا|اراد|گام|افاد|تسه|مرابح)/.test(txt(x.symbol)))return{tradeStart:540,end:900};return{tradeStart:540,end:750}}
function snapNum(z:any,...keys:string[]){for(const k of keys){const v=Number(z?.[k]);if(Number.isFinite(v))return v}return 0}
function snapTs(z:any){return tsSec(snapNum(z,'T','t','time'))}
function dyn(x:any){const src=Array.isArray(x.snapshots)?x.snapshots:[];const sn=src.filter(Boolean).map((z:any)=>({t:snapTs(z),last:snapNum(z,'Last','last'),volume:snapNum(z,'Volume','volume'),buyDepth:snapNum(z,'BuyDepth','buyDepth','buy_depth'),sellDepth:snapNum(z,'SellDepth','sellDepth','sell_depth')})).filter((z:any)=>z.t>0).sort((a:any,b:any)=>a.t-b.t);if(sn.length<3)return{ready:false,count:sn.length,span:0,pv15:0,ofi:0,bidStack:0,askPull:0,tradeAccel:0,sn};const first=sn[0],last=sn[sn.length-1],prev=sn[sn.length-2],span=Math.max(0,last.t-first.t),lastDt=Math.max(0,last.t-prev.t);const temporal=span>=20&&span<=900&&lastDt>0&&lastDt<=300;const hasCore=(first.last>0&&last.last>0)||(first.buyDepth+first.sellDepth+last.buyDepth+last.sellDepth>0)||(first.volume>0||last.volume>0);const pv15=temporal&&first.last>0?pct(last.last,first.last)*(15/span):0;const db=last.buyDepth-first.buyDepth,ds=last.sellDepth-first.sellDepth,den=Math.abs(db)+Math.abs(ds)+Math.max(last.buyDepth+last.sellDepth,1)*.08;const ofi=temporal?Math.max(-1,Math.min(1,(db-ds)/den)):0;const bidStack=temporal&&first.buyDepth>0?Math.max(-100,Math.min(300,(last.buyDepth-first.buyDepth)/first.buyDepth*100)):0;const askPull=temporal&&first.sellDepth>0?Math.max(-100,Math.min(100,(first.sellDepth-last.sellDepth)/first.sellDepth*100)):0;let tradeAccel=0;if(temporal&&sn.length>=4){const mid=sn[Math.floor((sn.length-1)/2)],dt1=Math.max(1,mid.t-first.t),dt2=Math.max(1,last.t-mid.t),r1=Math.max(0,mid.volume-first.volume)/dt1,r2=Math.max(0,last.volume-mid.volume)/dt2;tradeAccel=r1>0?Math.max(-100,Math.min(500,(r2/r1-1)*100)):(r2>0?100:0)}return{ready:Boolean(temporal&&hasCore),count:sn.length,span,pv15,ofi,bidStack,askPull,tradeAccel,sn}}
function reconcile(cur:any,win:any,dead:number){const c=num(cur),w=num(win);if(Math.abs(c)>dead)return c>0&&w>0?Math.max(c,w):c;return w}
function effective(x:any,d:any){return{pv:reconcile(x.price_velocity,d.pv15,.005),ofi:reconcile(x.ofi,d.ofi,.01),tradeAccel:reconcile(x.trade_accel,d.tradeAccel,1),accel:num(x.signal_accel),bidStack:reconcile(x.bid_stack_15s,d.bidStack,1),askPull:reconcile(x.ask_pull_15s,d.askPull,1)}}
function marketContext(x:any){const r=String(x.market_regime_v1||''),rs=r==='صعودی'?72:r==='خنثی'?55:r==='نزولی'?34:r==='پرنوسان'?45:50,b=Number.isFinite(Number(x.market_breadth_pct_v1))?clamp(x.market_breadth_pct_v1):50;return clamp(.62*rs+.38*b)}
function orderPressure(x:any,e:any){const qi=range(num(x.qi),-.35,.45),ofi=range(num(e.ofi),-.25,.35),dr=num(x.depth_ratio),depth=dr>0?clamp(50+32*Math.log(Math.max(.15,dr))):35,bid=clamp(50+num(e.bidStack)*.75),ask=clamp(50+num(e.askPull)*.8);return clamp(.32*qi+.30*ofi+.18*depth+.10*bid+.10*ask)}
function tech(x:any){let s=50;if(num(x.vwap)>0)s+=num(x.last_price)>=num(x.vwap)?12:-10;if(num(x.ema9_5m)>0&&num(x.ema21_5m)>0)s+=num(x.ema9_5m)>num(x.ema21_5m)?12:-10;const r=num(x.rsi_5m);if(r>0){if(r>=45&&r<=72)s+=8;else if(r>82)s-=14;else if(r<30)s-=5}return clamp(s)}
function zeroRecovery(x:any){const lo=num(x.low_price),y=num(x.yesterday_price),last=num(x.last_price);if(!(lo>0&&y>lo&&last>0))return clamp(x.recovery);return clamp((last-lo)/(y-lo)*100)}
function eligible(x:any){const s=String(`${x.asset_type||''} ${x.company_name||''} ${x.symbol||''}`).replace(/‌/g,' ');if(/اختیار معامله|اختیارخ|اختیارف/.test(s))return false;if(/اوراق بدهی|اسناد خزانه|درآمد ?ثابت|درآمدثابت|تسهیلات مسکن/.test(s))return false;if(/^(اخزا|اراد|گام|افاد|تسه)/.test(String(x.symbol||'')))return false;return true}
function dynEvidence(e:any){let c=0;if(num(e.pv)>.05)c++;if(num(e.ofi)>.05)c++;if(num(e.tradeAccel)>15)c++;if(num(e.accel)>5)c++;if(num(e.bidStack)>10)c++;if(num(e.askPull)>10)c++;return c}
function evidence(x:any,e:any){let c=dynEvidence(e);if(num(x.qi)>.10)c++;if(num(x.daily_rvol)>=1.10)c++;if(num(x.real_flow_ratio)>=1.10)c++;return c}
function impulse(x:any,mode:string,e:any){const velocity=clamp(50+num(e.pv)*90),trade=clamp(50+num(e.tradeAccel)*.25),acc=clamp(50+num(e.accel)*1.8),rec=mode==='reversal'?zeroRecovery(x):clamp(x.recovery||50),t=tech(x);return clamp(.30*velocity+.20*trade+.20*acc+.20*rec+.10*t)}
function timeScore(m:number){return m>=90?100:m>=60?86:m>=30?68:m>=15?45:m>0?22:0}
function feasibility(x:any,mode:string,day:number,e:any,left:number){const ts=timeScore(left);if(mode==='reversal'){const distance=Math.max(0,-day),distanceScore=clamp(100-distance*28),required15s=left>0?distance/(left*60)*15:99,actual15s=Math.max(0,num(e.pv)),velocityFit=required15s>.000001?clamp(20+70*(actual15s/required15s)):100,zr=zeroRecovery(x);return clamp(.40*velocityFit+.25*distanceScore+.20*ts+.15*zr)}const headroom=num(x.max_allowed)>0&&num(x.last_price)>0?Math.max(0,pct(num(x.max_allowed),num(x.last_price))):Math.max(.5,3-day);return clamp(.55*clamp(22+headroom*24)+.25*ts+.20*tech(x))}
function flowVolume(x:any){const rf=num(x.real_flow_ratio),real=rf>0?clamp(50+27*Math.log(Math.max(.15,rf))):38,rvol=num(x.daily_rvol)>0?clamp(20+36*num(x.daily_rvol)):35,abs=Number.isFinite(Number(x.absorption))?clamp(x.absorption):45;return clamp(.45*real+.35*rvol+.20*abs)}
function continuation(x:any){return x.integrated_eligible?clamp(.45*num(x.continuation_score)+.23*num(x.trend_score_v1)+.20*num(x.flow_score_v1)+.12*num(x.momentum_score_v1)):clamp(x.continuation_score||50)}
function status(score:number,today:number,risk:number,ev:number,gate:string){if(gate)return'عادی';if(score>=78&&today>=82&&risk<=45&&ev>=4)return'شکار ویژه';if(score>=68&&today>=74&&risk<=55&&ev>=3)return'هشدار فوری';if(score>=58&&today>=64&&risk<=62&&ev>=3)return'شکار زودهنگام';if(score>=50&&today>=55)return'رصد';return'عادی'}
function activity(x:any,d:any,now:any){const s=assetSession(x);if(!['Sat','Sun','Mon','Tue','Wed'].includes(now.wd)||now.hm<s.tradeStart||now.hm>s.end)return false;const nowSec=num(now.epochSec)||Date.now()/1000;const candles=Array.isArray(x.candles)?x.candles:[],rawSn=Array.isArray(x.snapshots)?x.snapshots.filter(Boolean):[];let lastTrade=0;for(const z of candles){const t=tsSec(z?.t??z?.time??0),v=num(z?.volume);if(t&&v>0&&ymdFromTs(t)===now.ymd)lastTrade=Math.max(lastTrade,t)}for(let i=1;i<rawSn.length;i++){const a=rawSn[i-1]||{},b=rawSn[i]||{},t=tsSec(b.T??b.t??0),va=num(a.Volume??a.volume??0),vb=num(b.Volume??b.volume??0);if(t&&vb>va&&ymdFromTs(t)===now.ymd)lastTrade=Math.max(lastTrade,t)}if(!lastTrade)return false;const mins=nowSec-lastTrade;if(mins<=1800)return true;const cut=nowSec-1800,recent=rawSn.filter((z:any)=>tsSec(z.T??z.t??0)>=cut);if(recent.length<2)return false;const keys=['Volume','Last','BuyDepth','SellDepth','BQ','SQ','Bid','Ask','BuyQueue','SellQueue'];for(let i=1;i<recent.length;i++)for(const k of keys)if(Number(recent[i]?.[k]??0)!==Number(recent[i-1]?.[k]??0))return true;return false}
function gateReason(x:any,d:any,mode:string,fz:number,de:number,ev:number){let gate='';if(!(num(x.last_price)>0&&num(x.yesterday_price)>0)||num(x.volume)<=0)gate='داده قیمت/حجم معتبر نیست';else if(!d.ready)gate='تاریخچه زمانی معتبر برای محاسبه Deltaهای درون‌روزی کافی نیست';else if(num(x.risk_score)>=75)gate='ریسک لحظه‌ای بسیار بالا است';else if(num(x.cancellation_ratio)>=90&&num(x.absorption)<12)gate='لغو سفارش بسیار بالا و جذب عرضه ضعیف است';if(!eligible(x))gate=gate||'این نوع ابزار در موتور شکار سریع سهام/صندوق‌های ریسکی قرار نمی‌گیرد';if(mode==='acceleration'&&(ev<3||de<2))gate=gate||'برای شتاب مثبت حداقل سه شاهد هم‌زمان و دو شاهد پویا لازم است';if(mode==='reversal'&&fz<28)gate=gate||'فاصله/زمان برای مثبت‌شدن امروز نامناسب است';if(mode==='reversal'&&de<1&&zeroRecovery(x)<55)gate=gate||'هنوز نشانه پویای کافی از شروع برگشت دیده نمی‌شود';return gate}
function evaluate(x:any,now:any){const d=dyn(x);if(!activity(x,d,now))return null;const day=pct(num(x.last_price),num(x.yesterday_price)),mode=day<0?'reversal':day<1?'acceleration':'outside';if(mode==='outside')return null;const e=effective(x,d),s=assetSession(x),left=Math.max(0,s.end-now.hm),op=orderPressure(x,e),imp=impulse(x,mode,e),fz=feasibility(x,mode,day,e,left),fv=flowVolume(x),mc=marketContext(x),cont=continuation(x),de=dynEvidence(e),ev=evidence(x,e);let today=mode==='reversal'?.28*op+.27*imp+.20*fz+.15*fv+.10*mc:.30*op+.30*imp+.15*fz+.15*fv+.10*mc;today=clamp(today-Math.max(0,num(x.risk_score)-40)*.23-Math.max(0,num(x.cancellation_ratio)-60)*.10);const score=clamp(today*(.82+.18*cont/100));const gate=gateReason(x,d,mode,fz,de,ev),h=status(score,today,num(x.risk_score),ev,gate),observed_at=new Date().toISOString();const base={trade_date:now.ymd,symbol_id:String(x.id),symbol:String(x.symbol||'—'),company_name:String(x.company_name||''),hunt_mode:mode,observed_at,price:num(x.last_price),hunt_score:score,today_opportunity:today,day_change:day,evidence_count:ev,dynamic_evidence_count:de,order_pressure:op,impulse:imp,feasibility:fz,flow_volume:fv,market_context:mc,continuation12:cont,risk_score:num(x.risk_score),cancellation_ratio:num(x.cancellation_ratio)};const shadow={...base,bucket_minute:Math.floor(now.hm/15)*15,baseline_state:h,gate_reason:gate,source_version:'4.1.6-shadow-v2-parity'};const event=(h==='شکار ویژه'||h==='هشدار فوری')?{...base,hunt_state:h,source_version:'4.1.6-server-v4-parity'}:null;return{shadow,event}}

const PARITY_FIXED_ISO='2026-09-16T07:00:00.000Z';
function paritySnaps(nowSec:number,o:any={}){const prices=o.prices||[98.5,98.7,98.9,99],buy=o.buy||[1000,1200,1400,1600],sell=o.sell||[1400,1200,1000,800],vol=o.vol||[10000,12000,15000,19000],times=o.times||[-90,-60,-30,0],ms=Boolean(o.ms),extra=o.extra||[];return prices.map((p:number,i:number)=>({T:(nowSec+times[i])*(ms?1000:1),Last:p,Volume:vol[i],BuyDepth:buy[i],SellDepth:sell[i],BQ:buy[i]/2,SQ:sell[i]/2,Bid:p-.1,Ask:p+.1,BuyQueue:0,SellQueue:0,...(extra[i]||{})}))}
function parityRaw(nowSec:number,id:string,extra:any={}){return{id,symbol:`T${id}`,company_name:`Fixture ${id}`,last_price:99,yesterday_price:100,low_price:96,high_price:101,max_allowed:105,volume:19000,qi:.30,ofi:.15,price_velocity:.08,trade_accel:40,signal_accel:12,bid_stack_15s:25,ask_pull_15s:20,daily_rvol:1.4,real_flow_ratio:1.35,risk_score:25,cancellation_ratio:10,absorption:60,recovery:65,depth_ratio:1.6,vwap:98.5,ema9_5m:99,ema21_5m:98.5,rsi_5m:58,continuation_score:70,asset_type:'سهام / سایر',market:'بورس',integrated_eligible:false,flow_score_v1:0,trend_score_v1:0,momentum_score_v1:0,market_regime_v1:'خنثی',market_breadth_pct_v1:50,snapshots:paritySnaps(nowSec),candles:[],...extra}}
function parityStaleBook(nowSec:number,active:boolean){const a={T:nowSec-2700,Last:99,Volume:100,BuyDepth:1000,SellDepth:1000,BQ:500,SQ:500,Bid:98.9,Ask:99.1,BuyQueue:0,SellQueue:0},b={...a,T:nowSec-2670,Volume:200},c={...b,T:nowSec-300},d:any={...c,T:nowSec-120};if(active){d.Bid=99;d.Ask=99.05;d.BQ=560}return[a,b,c,d]}
function parityFixtures(now:any){const n=Math.floor(now.epochSec);return[
  parityRaw(n,'101'),
  parityRaw(n,'102',{last_price:100.5,yesterday_price:100,low_price:99.5,high_price:101.5,snapshots:paritySnaps(n,{prices:[100,100.2,100.35,100.5]})}),
  parityRaw(n,'103',{snapshots:[{T:n-60,Last:99,Volume:19000,BuyDepth:1000,SellDepth:1000}],candles:[{t:n-30,volume:500,open:99,high:99,low:99,close:99}]}),
  parityRaw(n,'104',{risk_score:80}),
  parityRaw(n,'105',{asset_type:'اختیار معامله'}),
  parityRaw(n,'106',{snapshots:paritySnaps(n,{vol:[19000,19000,19000,19000]}),candles:[{t:n-30,volume:500,open:99,high:99,low:99,close:99}]}),
  parityRaw(n,'107',{snapshots:parityStaleBook(n,true),volume:200}),
  parityRaw(n,'108',{snapshots:paritySnaps(n,{ms:true})}),
  parityRaw(n,'109',{snapshots:parityStaleBook(n,false),volume:200})
]}
function parityResult(r:any,now:any){const z=evaluate(r,now);if(!z)return{id:String(r.id),captured:false};const s=z.shadow;return{id:String(r.id),captured:true,mode:s.hunt_mode,today:round10(s.today_opportunity),score:round10(s.hunt_score),state:s.baseline_state,gate:s.gate_reason,evidence:s.evidence_count,dynamicEvidence:s.dynamic_evidence_count,orderPressure:round10(s.order_pressure),impulse:round10(s.impulse),feasibility:round10(s.feasibility),flowVolume:round10(s.flow_volume),marketContext:round10(s.market_context),continuation:round10(s.continuation12)}}
function runParity(){const now=tparts(new Date(PARITY_FIXED_ISO));return{protocol:'4.1.6-browser-server-parity-v1',fixedNow:PARITY_FIXED_ISO,results:parityFixtures(now).map((r:any)=>parityResult(r,now))}}

function captureAdminKey(){
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(legacy)return legacy;
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(!raw)throw new Error('capture admin key unavailable');
  const parsed=JSON.parse(raw);
  if(!parsed?.default)throw new Error('default capture admin key unavailable');
  return parsed.default;
}
Deno.serve(async(req)=>{
  const u=new URL(req.url);
  if(u.searchParams.get('parity')==='1'){
    if(req.method!=='GET')return Response.json({ok:false,error:'method-not-allowed'},{status:405,headers:{Allow:'GET'}});
    return Response.json(runParity());
  }
  if(req.method!=='POST')return Response.json({ok:false,error:'method-not-allowed'},{status:405,headers:{Allow:'POST'}});
  const url=Deno.env.get('SUPABASE_URL')!,key=captureAdminKey();
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(req.headers.has('x-stock-hunter-capture-token')){
    return Response.json({ok:false,error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  const authMode=req.headers.get('x-stock-hunter-capture-auth')||'';
  const timestampRaw=req.headers.get('x-stock-hunter-capture-timestamp')||'';
  const nonce=req.headers.get('x-stock-hunter-capture-nonce')||'';
  const signature=req.headers.get('x-stock-hunter-capture-signature')||'';
  if(authMode!=='hmac-sha256-v2'||!/^[0-9]{10,12}$/.test(timestampRaw)||nonce.length>64||!/^[0-9a-f]{64}$/.test(signature)){
    return Response.json({ok:false,error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  const timestamp=Number(timestampRaw);
  if(!Number.isSafeInteger(timestamp)){
    return Response.json({ok:false,error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  const{data:authorized,error:authErr}=await sb.rpc('stock_hunter_validate_capture_request_v416',{
    p_timestamp:timestamp,p_nonce:nonce,p_signature:signature
  });
  if(authErr||authorized!==true){
    return Response.json({ok:false,error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  const now=tparts();
  if(!['Sat','Sun','Mon','Tue','Wed'].includes(now.wd)||now.hm<540||now.hm>1020)return Response.json({ok:true,skipped:'outside-market-window'});
  const{data:claimed,error:claimErr}=await sb.rpc('claim_stock_hunter_capture_v416');
  if(claimErr)return Response.json({ok:false,error:claimErr.message},{status:500});
  if(!claimed)return Response.json({ok:true,skipped:'rate-limit'});
  try{
    const select='id,symbol,company_name,last_price,yesterday_price,low_price,max_allowed,volume,qi,ofi,bid_stack_15s,ask_pull_15s,daily_rvol,rsi_5m,ema9_5m,ema21_5m,vwap,absorption,cancellation_ratio,price_velocity,trade_accel,recovery,depth_ratio,signal_accel,real_flow_ratio,risk_score,continuation_score,snapshots,candles,asset_type,market,integrated_eligible,flow_score_v1,trend_score_v1,momentum_score_v1,market_regime_v1,market_breadth_pct_v1,updated_at';
    const freshCutoffIso=new Date(Date.now()-180000).toISOString();
    const{data,error}=await sb.from('stock_hunter_integrated_v1').select(select).gte('updated_at',freshCutoffIso).limit(2500);if(error)throw error;
    const evals=(data||[]).map((x:any)=>evaluate(x,now)).filter(Boolean);
    const events=evals.map((z:any)=>z.event).filter(Boolean),shadows=evals.map((z:any)=>z.shadow).filter(Boolean);
    let recorded=0,shadowRecorded=0;
    if(events.length){const r=await sb.rpc('record_stock_hunter_hunt_events_v416',{p_events:events});if(r.error)throw r.error;recorded=Number(r.data||0)}
    if(shadows.length){const r=await sb.rpc('record_stock_hunter_shadow_samples_v416',{p_samples:shadows});if(r.error)throw r.error;shadowRecorded=Number(r.data||0)}
    await sb.rpc('finish_stock_hunter_capture_v416',{p_event_count:recorded,p_error:null});
    return Response.json({ok:true,scanned:(data||[]).length,candidates:events.length,recorded,shadow_candidates:shadows.length,shadow_recorded:shadowRecorded,trade_date:now.ymd,source_version:'4.1.6-server-v4-parity'});
  }catch(e){const m=e instanceof Error?e.message:String(e);await sb.rpc('finish_stock_hunter_capture_v416',{p_event_count:0,p_error:m});return Response.json({ok:false,error:m},{status:500})}
});
