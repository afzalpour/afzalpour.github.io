import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-stock-hunter-cron","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json;charset=utf-8"}});
const enc=new TextEncoder();
async function sha256Hex(v:string){const d=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function adminClient(){
  const url=Deno.env.get("SUPABASE_URL")||"";
  let key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!key){try{key=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{}}
  if(!url||!key)throw new Error("پیکربندی سرور کامل نیست");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function tehranDate(){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const g=(t:string)=>p.find(x=>x.type===t)?.value||"";
  return g("year")+"-"+g("month")+"-"+g("day");
}
function tehranClock(){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tehran",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const g=(t:string)=>p.find(x=>x.type===t)?.value||"";
  return {wd:g("weekday"),hm:Number(g("hour"))*60+Number(g("minute"))};
}
function events(rows:any[]){
  const out:any[]=[];
  for(const x of rows||[]){
    const add=(kind:string,at:string|null,level:string,change:number|null)=>{
      if(!at)return;
      out.push({
        eventKey:[x.channel,x.trade_date,x.symbol_id,kind,at].join("|"),
        kind,level,at,symbol:x.symbol,company:x.company_name||"",huntState:x.hunt_state||"",
        huntScore:x.hunt_score,dayChange:change
      });
    };
    add("detect",x.detected_at,x.channel==="RADAR"?"early":"special",x.detected_day_change);
    add("zero",x.crossed_zero_at,"success",0);
    add("plus1",x.crossed_plus1_at,"success",1);
    add("plus2",x.crossed_plus2_at,"success",2);
    add("plus3",x.crossed_plus3_at,"success",3);
  }
  return out.sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
}
const kindFa:any={detect:"کشف شکار",zero:"عبور از صفر",plus1:"رسیدن به +۱٪",plus2:"رسیدن به +۲٪",plus3:"رسیدن به +۳٪"};
const levelFa:any={early:"شکار زودهنگام",special:"شکار ویژه",success:"عبور موفق"};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  try{
    const sb=adminClient();
    if(req.method==="GET"){
      const [{data:pub},{count}]=await Promise.all([
        sb.from("stock_hunter_push_public_v420").select("vapid_public_key").eq("id",1).maybeSingle(),
        sb.from("stock_hunter_push_subscriptions_v420").select("*",{count:"exact",head:true}).eq("enabled",true)
      ]);
      return json({ok:true,configured:!!pub?.vapid_public_key,active_subscriptions:count||0,version:"4.2.0-cloud-push-v1"});
    }
    if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
    const token=req.headers.get("x-stock-hunter-cron")||"";
    const [{data:priv,error:privErr},{data:pub,error:pubErr}]=await Promise.all([
      sb.from("stock_hunter_push_private_v420").select("vapid_private_key,cron_token_sha256,subject").eq("id",1).single(),
      sb.from("stock_hunter_push_public_v420").select("vapid_public_key").eq("id",1).single()
    ]);
    if(privErr||pubErr||!priv||!pub)return json({error:"PUSH_CONFIG_MISSING"},503);
    if(!token||await sha256Hex(token)!==priv.cron_token_sha256)return json({error:"UNAUTHORIZED"},401);

    const today=tehranDate(),clock=tehranClock();
    if(["Thu","Fri"].includes(clock.wd)||clock.hm<9*60||clock.hm>17*60){
      await sb.from("stock_hunter_push_private_v420").update({last_dispatch_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",1);
      return json({ok:true,skipped:"خارج از بازه کاری بازار",trade_date:today});
    }
    const {data:journey,error:jErr}=await sb.from("stock_hunter_hunt_journey_v416")
      .select("channel,trade_date,symbol_id,symbol,company_name,hunt_state,detected_at,detected_day_change,hunt_score,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at")
      .eq("trade_date",today).order("detected_at",{ascending:false}).limit(600);
    if(jErr)throw jErr;
    const ev=events(journey||[]).slice(-80);
    const {data:subs,error:sErr}=await sb.from("stock_hunter_push_subscriptions_v420")
      .select("subscription_id,user_id,endpoint,p256dh,auth,levels,created_at").eq("enabled",true).limit(5000);
    if(sErr)throw sErr;

    webpush.setVapidDetails(priv.subject,pub.vapid_public_key,priv.vapid_private_key);
    let sent=0,skipped=0,failed=0,gone=0;
    for(const sub of subs||[]){
      const levels=Array.isArray(sub.levels)?sub.levels:["early","special","success"];
      for(const e of ev){
        if(!levels.includes(e.level)||new Date(e.at)<=new Date(sub.created_at)){skipped++;continue;}
        const {data:claim,error:claimErr}=await sb.from("stock_hunter_push_delivery_v420")
          .insert({subscription_id:sub.subscription_id,event_key:e.eventKey,status:"PENDING"})
          .select("delivery_id").maybeSingle();
        if(claimErr){
          if((claimErr as any).code==="23505"){skipped++;continue;}
          failed++;continue;
        }
        if(!claim?.delivery_id){skipped++;continue;}
        const payload=JSON.stringify({
          title:"شکارچی سهم — "+levelFa[e.level],
          body:e.symbol+" — "+kindFa[e.kind]+(e.huntState?" — "+e.huntState:""),
          icon:"icon.svg",badge:"icon.svg",tag:e.eventKey,
          data:{url:"alerts-center-v416.html",eventKey:e.eventKey,symbol:e.symbol}
        });
        try{
          await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:300,urgency:e.level==="special"?"high":"normal"});
          sent++;
          await Promise.all([
            sb.from("stock_hunter_push_delivery_v420").update({status:"SENT",delivered_at:new Date().toISOString(),error:null}).eq("delivery_id",claim.delivery_id),
            sb.from("stock_hunter_push_subscriptions_v420").update({last_success_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("subscription_id",sub.subscription_id)
          ]);
        }catch(err:any){
          const code=Number(err?.statusCode||err?.status||0);
          const isGone=code===404||code===410;
          if(isGone)gone++;else failed++;
          await Promise.all([
            sb.from("stock_hunter_push_delivery_v420").update({status:isGone?"GONE":"FAILED",error:String(err?.message||err).slice(0,500)}).eq("delivery_id",claim.delivery_id),
            sb.from("stock_hunter_push_subscriptions_v420").update({enabled:!isGone,last_error:String(err?.message||err).slice(0,500),updated_at:new Date().toISOString()}).eq("subscription_id",sub.subscription_id)
          ]);
        }
      }
    }
    await sb.from("stock_hunter_push_private_v420").update({last_dispatch_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",1);
    return json({ok:true,trade_date:today,events:ev.length,subscriptions:(subs||[]).length,sent,skipped,failed,gone});
  }catch(err:any){
    console.error("stock-hunter-cloud-push-v420",err);
    return json({error:"SERVER_ERROR",message:String(err?.message||err).slice(0,300)},500);
  }
});