#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const VERSION="stock-hunter-raw-pack-v1";
const MAX_PACK_BYTES=Number(process.env.STOCK_HUNTER_RAW_PACK_MAX_BYTES||"200000000");

function arg(name,def=""){
  const i=process.argv.indexOf(name);
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def;
}
const inputDir=path.resolve(arg("--input","raw"));
const outputDir=path.resolve(arg("--output","out"));
const expectedDate=arg("--date","");

function sha256(b){return crypto.createHash("sha256").update(b).digest("hex");}
function walk(dir){
  const out=[];
  if(!fs.existsSync(dir))return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())out.push(...walk(p));
    else if(ent.isFile()&&ent.name.endsWith(".json.gz"))out.push(p);
  }
  return out;
}
function tehranDate(sec){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(sec*1000));
  const g=k=>parts.find(x=>x.type===k)?.value||"";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

const files=walk(inputDir).sort();
if(!files.length){
  console.error("NO_RAW_OBJECTS");
  process.exit(2);
}

const records=[];
let sourceGzipBytes=0,totalRows=0;
const seen=new Set();
const streams=new Map();
for(const file of files){
  const gz=fs.readFileSync(file); sourceGzipBytes+=gz.length;
  let payload;
  try{payload=JSON.parse(zlib.gunzipSync(gz).toString("utf8"));}
  catch(e){throw new Error(`invalid_gzip_json:${file}:${e.message}`);}
  if(payload?.protocol!=="stock-hunter-iran-ingest-v1")throw new Error(`protocol_mismatch:${file}`);
  const observed=Number(payload.observed_at),seq=Number(payload.sequence);
  const collector=String(payload.collector_id||""),stream=String(payload.stream_id||"");
  if(!Number.isSafeInteger(observed)||observed<=0||!Number.isSafeInteger(seq)||seq<1||!collector||!stream)
    throw new Error(`identity_invalid:${file}`);
  const date=tehranDate(observed);
  if(expectedDate&&date!==expectedDate)throw new Error(`date_mismatch:${file}:${date}`);
  if(!Array.isArray(payload.rows))throw new Error(`rows_invalid:${file}`);
  const key=`${collector}\n${stream}\n${seq}`;
  if(seen.has(key))throw new Error(`duplicate_sequence:${collector}:${stream}:${seq}`);
  seen.add(key);
  totalRows+=payload.rows.length;
  records.push({payload,observed,seq,collector,stream,source_sha256:sha256(gz),source_bytes:gz.length});
  const sk=`${collector}/${stream}`;
  const a=streams.get(sk)||[];
  a.push(seq); streams.set(sk,a);
}
records.sort((a,b)=>a.observed-b.observed||a.collector.localeCompare(b.collector)||a.stream.localeCompare(b.stream)||a.seq-b.seq);

const lines=records.map(r=>JSON.stringify(r.payload)).join("\n")+"\n";
const pack=zlib.gzipSync(Buffer.from(lines),{level:9,mtime:0});
if(pack.length>MAX_PACK_BYTES){
  console.error(`PACK_BUDGET_EXCEEDED bytes=${pack.length} max=${MAX_PACK_BYTES}`);
  process.exit(3);
}
fs.mkdirSync(outputDir,{recursive:true});
const packPath=path.join(outputDir,"market-facts.ndjson.gz");
fs.writeFileSync(packPath,pack);

const streamSummary=[];
for(const [id,seqs0] of [...streams.entries()].sort()){
  const seqs=[...seqs0].sort((a,b)=>a-b),gaps=[];
  for(let i=1;i<seqs.length;i++)if(seqs[i]>seqs[i-1]+1)gaps.push([seqs[i-1]+1,seqs[i]-1]);
  streamSummary.push({id,first_sequence:seqs[0],last_sequence:seqs.at(-1),count:seqs.length,gaps});
}
const date=expectedDate||tehranDate(records[0].observed);
const manifest={
  schema:VERSION,date,
  snapshot_count:records.length,
  total_rows:totalRows,
  first_observed_at:records[0].observed,
  last_observed_at:records.at(-1).observed,
  source_gzip_bytes:sourceGzipBytes,
  pack_gzip_bytes:pack.length,
  pack_sha256:sha256(pack),
  streams:streamSummary,
  sources:records.map(r=>({
    collector_id:r.collector,stream_id:r.stream,sequence:r.seq,observed_at:r.observed,
    source_sha256:r.source_sha256,source_bytes:r.source_bytes,
  })),
};
fs.writeFileSync(path.join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({ok:true,...manifest},null,2));
