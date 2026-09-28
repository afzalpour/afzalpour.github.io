import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import postgres from 'npm:postgres@3.4.7';

const PC_KEY_SHA256_V411 = 'a44db59e173ced2712fd0d405213a5a1fbbc6a2cc30498398f22ccea9408e89f';
const PC_KEY_SHA256_V425 = 'f38cad7d5c118610d8c54bcfbb96521536ea59db61c56747f4f907127513b17a';
const PC_KEY_SHA256_ALLOWED = new Set([PC_KEY_SHA256_V411,PC_KEY_SHA256_V425]);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,content-encoding,x-pc-key',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function recoveryPoolerUrlV427(){
  const direct=Deno.env.get('SUPABASE_DB_URL')||'';
  if(!direct)return '';
  try{
    const u=new URL(direct);
    u.protocol='postgres:';
    u.hostname='aws-0-eu-central-1.pooler.supabase.com';
    u.port='6543';
    u.username='postgres.summnepwuziwulzvpcms';
    return u.toString();
  }catch{return '';}
}

function backendKey() {
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try { key = JSON.parse(raw).default || key; } catch {}
  }
  return key;
}

function safeRow(r: any) {
  const allowed = [
    'id','symbol','company_name','state','last_price','closing_price','yesterday_price',
    'low_price','high_price','min_allowed','max_allowed','volume','value','buy_depth',
    'sell_depth','best_bid','best_ask','sell_queue','buy_queue','fast_score',
    'fast_probability','signal_accel','continuation_score','prob_2d','prob_3d',
    'risk_score','qi','ofi','bid_stack_15s','ask_pull_15s','daily_rvol','rsi_5m',
    'ema9_5m','ema21_5m','vwap','atr_5m','technical_score','microprice','absorption',
    'cancellation_ratio','price_velocity','trade_accel','recovery','depth_ratio',
    'queue_decay','momentum','real_flow_ratio','book_imbalance3_v425','mlofi3_v425','book_persistence_v425','cancel_proxy_v425','rvol_tod_v425','rvol_tod_samples_v425','book_levels_ready_v425','challenger_feature_version_v425','hunt_state','decision','entry_price',
    'entry_low','entry_high','stop_loss','target_1','target_2','target_3','risk_reward',
    'reason','snapshots','candles','raw_json'
  ];
  const o: any = {};
  for (const k of allowed) if (r?.[k] !== undefined) o[k] = r[k];
  o.id = String(o.id || '').trim();
  o.symbol = String(o.symbol || '').trim();
  o.company_name = String(o.company_name || '').trim();
  o.updated_at = new Date().toISOString();
  return o;
}

async function decodeBody(req: Request) {
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.byteLength > 2_000_000) throw new Error('compressed payload too large');
  let bytes = raw;
  if ((req.headers.get('content-encoding') || '').toLowerCase() === 'gzip') {
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (bytes.byteLength > 8_000_000) throw new Error('payload too large');
  return JSON.parse(new TextDecoder().decode(bytes));
}

let cronReliefDone = false;
let cronReliefAttemptAt = 0;
async function relieveResearchCron() {
  if (cronReliefDone) return true;
  const now = Date.now();
  if (now - cronReliefAttemptAt < 60_000) return false;
  cronReliefAttemptAt = now;
  const dbUrl = recoveryPoolerUrlV427();
  if (!dbUrl) return false;
  const sql = postgres(dbUrl, { max:1, connect_timeout:8, idle_timeout:2, prepare:false });
  try {
    await sql.unsafe("update cron.job set active=false where jobid in (10,28,29,33,34,36)");
    cronReliefDone = true;
    console.log('research cron relief applied');
    return true;
  } catch (e) {
    console.warn('research cron relief deferred:', String((e as any)?.message || e));
    return false;
  } finally {
    try { await sql.end({ timeout:1 }); } catch {}
  }
}

async function directSignalsUpsert(clean: any[]) {
  const dbUrl = recoveryPoolerUrlV427();
  if (!dbUrl) throw new Error('pooler database url unavailable');
  const cols = Object.keys(clean[0] || {}).filter(k => clean.every(r => r[k] !== undefined));
  if (!cols.includes('id') || !cols.includes('symbol')) throw new Error('direct upsert columns invalid');
  const payload = clean.map(r => Object.fromEntries(cols.map(k => [k, r[k]])));
  const assignments = cols.filter(k => k !== 'id').map(k => '"' + k.replaceAll('"','""') + '"=excluded."' + k.replaceAll('"','""') + '"').join(',');
  const sql = postgres(dbUrl, { max:1, connect_timeout:8, idle_timeout:3, prepare:false });
  try {
    const values = sql(payload, ...cols);
    await sql`insert into public.stock_hunter_signals_v4 ${values} on conflict (id) do update set ${sql.unsafe(assignments)}`;
  } finally {
    try { await sql.end({ timeout:1 }); } catch {}
  }
}

function isPressureError(error: any) {
  const m = String(error?.message || error || '').toLowerCase();
  return m.includes('statement timeout') || m.includes('gateway timeout') ||
    m.includes('connection timeout') || m.includes('schema cache') ||
    m.includes('canceling statement');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ok:false,error:'method'}), {
      status:405, headers:{...cors,'Content-Type':'application/json'}
    });
  }

  const supplied = req.headers.get('x-pc-key') || '';
  const suppliedHash = supplied ? await sha256Hex(supplied) : '';
  if (!suppliedHash || !PC_KEY_SHA256_ALLOWED.has(suppliedHash)) {
    return new Response(JSON.stringify({ok:false,error:'unauthorized'}), {
      status:401, headers:{...cors,'Content-Type':'application/json'}
    });
  }

  try {
    const cronRelief = await relieveResearchCron();
    const body = await decodeBody(req);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length < 1 || rows.length > 300) {
      return new Response(JSON.stringify({ok:false,error:'row_count'}), {
        status:413, headers:{...cors,'Content-Type':'application/json'}
      });
    }

    const totalSymbols = Number(body?.total_symbols || rows.length);
    const batchIndex = Number(body?.batch_index || 1);
    const batchCount = Number(body?.batch_count || 1);
    if (!Number.isInteger(totalSymbols) || totalSymbols < rows.length || totalSymbols > 5000 ||
        !Number.isInteger(batchIndex) || !Number.isInteger(batchCount) ||
        batchIndex < 1 || batchCount < 1 || batchIndex > batchCount || batchCount > 32) {
      return new Response(JSON.stringify({ok:false,error:'batch_metadata'}), {
        status:400, headers:{...cors,'Content-Type':'application/json'}
      });
    }

    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = backendKey();
    if (!url || !key) throw new Error('backend credentials unavailable');
    const db = createClient(url, key, { auth:{persistSession:false,autoRefreshToken:false} });

    // Keep live scoring columns hot, but stagger large JSON rewrites across batches.
    // Every batch still updates all core market/scoring fields; snapshots/candles/raw_json
    // are refreshed for one rotating batch per minute to reduce database write amplification.
    const minuteSlot = (Math.floor(Date.now() / 60000) % batchCount) + 1;
    const refreshHeavy = batchIndex === minuteSlot;
    const agentVersion = String(body?.agent_version || '4.1.1-pc-eco-full-universe');
    const sourceTag = agentVersion.startsWith('4.2.5') ? 'pc-eco-bridge-v425' : 'pc-eco-bridge-v411';
    const clean = rows.map(safeRow).filter((r:any) => r.id && r.symbol && r.symbol !== '—');
    if (!clean.length) throw new Error('no valid rows');
    if (!refreshHeavy) {
      for (const r of clean) {
        delete r.snapshots;
        delete r.candles;
        delete r.raw_json;
      }
    }

    let directFallback = false;
    const { error } = await db.from('stock_hunter_signals_v4').upsert(clean, { onConflict:'id' });
    if (error) {
      if (!isPressureError(error)) throw error;
      console.warn('PostgREST write path under pressure; using transaction pooler fallback:', String(error.message || error));
      await directSignalsUpsert(clean);
      directFallback = true;
    }

    // Universe metadata is search/support data, not the critical live-feed write path.
    // Refresh only one rotating batch per minute; failures must not trigger a retry storm.
    let universeWarning = '';
    if (batchIndex === minuteSlot) {
      const seed = clean.map((r:any) => ({
        ins_code:r.id, symbol:r.symbol, company_name:r.company_name,
        source:sourceTag, is_active:true,
        last_seen_at:r.updated_at, updated_at:new Date().toISOString()
      }));
      const { error:se } = await db.from('stock_hunter_universe_v4').upsert(seed, {onConflict:'ins_code'});
      if (se) {
        universeWarning = String(se.message || se);
        console.warn('universe refresh deferred:', universeWarning);
      }
    }

    // One health write per complete feed cycle is sufficient and avoids six redundant writes.
    let healthWarning = '';
    if (batchIndex === batchCount) {
      const now = new Date().toISOString();
      const health = {
        id:'local-agent',
        source:sourceTag,
        status:'ok',
        message:String(body?.message || 'full-universe batched pc bridge'),
        symbols:totalSymbols,
        agent_version:agentVersion,
        last_feed_at:now,
        updated_at:now
      };
      const { error:he } = await db.from('stock_hunter_feed_health_v4').upsert(health, {onConflict:'id'});
      if (he) {
        healthWarning = String(he.message || he);
        console.warn('health refresh deferred:', healthWarning);
      }
    }

    return new Response(JSON.stringify({
      ok:true,count:clean.length,total_symbols:totalSymbols,
      batch_index:batchIndex,batch_count:batchCount,
      heavy_refresh:refreshHeavy,
      direct_fallback:directFallback,
      cron_relief:cronRelief||undefined,
      universe_warning:universeWarning||undefined,
      health_warning:healthWarning||undefined
    }), {
      headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}
    });
  } catch (e) {
    const pressure = isPressureError(e);
    return new Response(JSON.stringify({ok:false,error:String((e as any)?.message || e)}), {
      status:pressure?503:500,
      headers:{
        ...cors,'Content-Type':'application/json','Cache-Control':'no-store',
        ...(pressure?{'Retry-After':'5'}:{})
      }
    });
  }
});