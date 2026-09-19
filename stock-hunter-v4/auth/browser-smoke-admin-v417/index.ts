import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.12";

const AUDIENCE="stock-hunter-browser-smoke-v417";
const EXPECTED_REPO="afzalpour/afzalpour.github.io";
const EXPECTED_REPO_ID="1350071624";
const EXPECTED_OWNER_ID="221893601";
const EXPECTED_REF="refs/heads/main";
const EXPECTED_WORKFLOW_REF="afzalpour/afzalpour.github.io/.github/workflows/stock-hunter-v417-authenticated-browser-smoke.yml@refs/heads/main";
const EMAIL_RE=/^stock-hunter-browser-smoke-[0-9]+-[0-9]+@example\.invalid$/;
const JWKS=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

function adminKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(!raw)throw new Error("admin secret unavailable");
  const parsed=JSON.parse(raw);
  if(!parsed?.default)throw new Error("default admin secret unavailable");
  return parsed.default as string;
}
function out(status:number,body:unknown){
  return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
}
async function verifyGitHub(req:Request){
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))throw new Error("missing_oidc_token");
  const {payload}=await jwtVerify(auth.slice(7).trim(),JWKS,{
    issuer:"https://token.actions.githubusercontent.com",
    audience:AUDIENCE
  });
  if(String(payload.repository||"")!==EXPECTED_REPO)throw new Error("repository_mismatch");
  if(String(payload.repository_id||"")!==EXPECTED_REPO_ID)throw new Error("repository_id_mismatch");
  if(String(payload.repository_owner_id||"")!==EXPECTED_OWNER_ID)throw new Error("owner_id_mismatch");
  if(String(payload.ref||"")!==EXPECTED_REF)throw new Error("ref_mismatch");
  if(String(payload.workflow_ref||"")!==EXPECTED_WORKFLOW_REF)throw new Error("workflow_ref_mismatch");
  if(!["push","workflow_dispatch"].includes(String(payload.event_name||"")))throw new Error("event_not_allowed");
  return payload;
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return out(405,{error:"method_not_allowed"});
  try{
    await verifyGitHub(req);
  }catch(e){
    return out(401,{error:"oidc_verification_failed",message:String(e instanceof Error?e.message:e).slice(0,200)});
  }

  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||"");
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,adminKey(),{
    auth:{persistSession:false,autoRefreshToken:false}
  });

  try{
    if(action==="provision"){
      const email=String(body?.email||"").toLowerCase();
      const password=String(body?.password||"");
      if(!EMAIL_RE.test(email))return out(400,{error:"invalid_test_email"});
      if(password.length<24||password.length>128)return out(400,{error:"invalid_test_password"});

      const {data:created,error:createError}=await admin.auth.admin.createUser({
        email,
        password,
        email_confirm:true,
        user_metadata:{display_name:"CI Browser Smoke"}
      });
      if(createError||!created.user)throw createError||new Error("create_user_failed");

      const {data:sample,error:sampleError}=await admin
        .from("stock_hunter_integrated_v1")
        .select("id,symbol,updated_at")
        .not("id","is",null)
        .not("symbol","is",null)
        .order("updated_at",{ascending:false})
        .limit(1)
        .single();
      if(sampleError||!sample?.id){
        await admin.auth.admin.deleteUser(created.user.id).catch(()=>{});
        throw sampleError||new Error("market_sample_unavailable");
      }

      return out(200,{
        ok:true,
        user_id:created.user.id,
        symbol_id:String(sample.id),
        symbol:String(sample.symbol)
      });
    }

    if(action==="cleanup"){
      const userId=String(body?.user_id||"");
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)){
        return out(400,{error:"invalid_user_id"});
      }
      const {data:found,error:findError}=await admin.auth.admin.getUserById(userId);
      if(findError||!found.user)return out(200,{ok:true,already_absent:true});
      const email=String(found.user.email||"").toLowerCase();
      if(!EMAIL_RE.test(email))return out(403,{error:"refusing_non_test_user_cleanup"});
      const {error:deleteError}=await admin.auth.admin.deleteUser(userId);
      if(deleteError)throw deleteError;
      return out(200,{ok:true,deleted:true});
    }

    return out(400,{error:"unknown_action"});
  }catch(e){
    console.error("stock-hunter-browser-smoke-admin-v417",e);
    return out(500,{error:"internal_error"});
  }
});