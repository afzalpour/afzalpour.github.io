const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const OPENAI_KEY=Deno.env.get('OPENAI_API_KEY')||Deno.env.get('OPENAI_API_TOKEN')||'';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
function publishable(){try{const j=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');return j.default||'';}catch{return Deno.env.get('SUPABASE_ANON_KEY')||'';}}
async function user(req:Request){const a=req.headers.get('authorization')||'';if(!a.startsWith('Bearer '))return null;try{const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{Authorization:a,apikey:publishable()}});return r.ok?await r.json():null;}catch{return null;}}
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function textOf(j:any){if(typeof j?.output_text==='string')return j.output_text.trim();for(const o of j?.output||[])for(const c of o?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text.trim();return '';}
const allowedFields=new Set(['hunt_mode','day_change','baseline_hunt_score','baseline_today_opportunity','order_pressure','impulse','feasibility','flow_volume','market_context','continuation12','risk_score','cancellation_ratio','evidence_count','dynamic_evidence_count','baseline_state']);
const allowedOps=new Set(['>=','>','<=','<','=','!=']);
function sanitizeRules(v:any){if(!Array.isArray(v))return[];return v.slice(0,20).map((r:any)=>({field:String(r?.field||''),op:String(r?.op||''),value:r?.value})).filter((r:any)=>allowedFields.has(r.field)&&allowedOps.has(r.op)&&(['hunt_mode','baseline_state'].includes(r.field)?typeof r.value==='string':Number.isFinite(Number(r.value))));}
async function openai(instructions:string,input:unknown,max=1200){
  if(!OPENAI_KEY)throw new Error('AI_NOT_CONFIGURED');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:ctrl.signal,headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:max,instructions,input:JSON.stringify(input)})});
    const j=await r.json();if(!r.ok)throw new Error('OPENAI_'+r.status);return {text:textOf(j),model:j?.model||'gpt-5.6-luna'};
  }finally{clearTimeout(timer);}
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  const u=new URL(req.url);if(req.method==='GET'&&u.searchParams.get('health')==='1')return response({ok:true,configured:!!OPENAI_KEY,model:'gpt-5.6-luna'});
  if(req.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
  const who=await user(req);if(!who?.id)return response({error:'AUTH_REQUIRED'},401);
  let body:any;try{body=await req.json();}catch{return response({error:'INVALID_JSON'},400);}
  const raw=JSON.stringify(body);if(raw.length>60000)return response({error:'PAYLOAD_TOO_LARGE'},413);
  const mode=String(body?.mode||''),payload=body?.payload||{};
  try{
    if(mode==='assistant'){
      const r=await openai('تو دستیار فارسی شکارچی سهم هستی. فقط از داده ساختاریافته ورودی استفاده کن، داده مفقود را حدس نزن، توصیه قطعی خرید/فروش یا وعده بازده نده، و هرگز وزن‌ها یا آستانه‌های موتور ثابت ۴.۱.۶ را بازتعریف نکن. پاسخ روان، کوتاه و توضیح‌پذیر باشد.',payload,900);
      return response({ok:true,text:r.text,model:r.model});
    }
    if(mode==='daily_report'){
      const r=await openai('از خلاصه داده روز، یک گزارش پایان بازار فارسی و مدیریتی بساز: عملکرد شکار، شکست‌ها، فرصت‌های از دست‌رفته، پایداری داده و نکات قابل بررسی. هیچ عددی خارج از ورودی نساز و توصیه خرید/فروش نده.',payload,1300);
      return response({ok:true,text:r.text,model:r.model});
    }
    if(mode==='diagnose'){
      const r=await openai('تو دستیار تشخیص سلامت سامانه شکارچی سهم هستی. از داده پایداری فقط تشخیص بده مشکل محتمل از خوراک داده، ثبت شکار یا نبود شواهد کافی است. علت قطعی بدون شاهد اعلام نکن و موتور ۴.۱.۶ را مقصر یا تغییرپذیر فرض نکن.',payload,900);
      return response({ok:true,text:r.text,model:r.model});
    }
    if(mode==='strategy_parse'){
      const schema='فیلدهای مجاز: hunt_mode(reversal|acceleration), day_change, baseline_hunt_score, baseline_today_opportunity, order_pressure, impulse, feasibility, flow_volume, market_context, continuation12, risk_score, cancellation_ratio, evidence_count, dynamic_evidence_count, baseline_state. عملگرهای مجاز: >=,>,<=,<,=,!=.';
      const r=await openai('متن فارسی کاربر را فقط به قواعد سازنده راهبرد تبدیل کن. '+schema+' خروجی فقط یک آرایه JSON از اشیای {field,op,value} باشد؛ هیچ متن دیگری ننویس. اگر عبارتی مبهم است آن را حذف کن.',{text:String(payload?.text||'').slice(0,4000)},800);
      const a=r.text.indexOf('['),b=r.text.lastIndexOf(']');let parsed:any=[];if(a>=0&&b>a)try{parsed=JSON.parse(r.text.slice(a,b+1));}catch{}
      return response({ok:true,rules:sanitizeRules(parsed),model:r.model});
    }
    return response({error:'UNKNOWN_MODE'},400);
  }catch(e){const m=String((e as Error)?.message||e);if(m==='AI_NOT_CONFIGURED')return response({error:m,configured:false},503);return response({error:'AI_UPSTREAM_ERROR'},502);}
});