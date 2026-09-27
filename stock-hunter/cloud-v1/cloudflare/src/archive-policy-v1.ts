export const RAW_ARCHIVE_PREFIX="raw/v1";
export const RAW_ARCHIVE_RETENTION_DAYS=3;
export const RAW_ARCHIVE_DAILY_MAX_BYTES=1_000_000_000;
export const RAW_ARCHIVE_DAILY_MAX_OBJECTS=1500;
export const RAW_PACK_PREFIX="packs/raw-v1";
export const RAW_PACK_RETENTION_DAYS=15;
export const RAW_PACK_DAILY_MAX_BYTES=200_000_000;

export type ArchiveBudgetEntry={bytes:number;objects:number};
export type ArchiveBudgetLedger=Record<string,ArchiveBudgetEntry>;

export function tehranDateFromEpochSeconds(epochSeconds:number):string{
  if(!Number.isSafeInteger(epochSeconds)||epochSeconds<=0)throw new Error("archive_timestamp_invalid");
  const d=new Date(epochSeconds*1000);
  const p=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(d);
  const g=(k:string)=>p.find(x=>x.type===k)?.value||"";
  const y=g("year"),m=g("month"),day=g("day");
  if(!/^\d{4}$/.test(y)||!/^\d{2}$/.test(m)||!/^\d{2}$/.test(day))throw new Error("archive_date_invalid");
  return `${y}-${m}-${day}`;
}

export function rawArchiveKey(input:{
  observedAt:number;collectorId:string;streamId:string;sequence:number;bodyHash:string;
}):string{
  const date=tehranDateFromEpochSeconds(input.observedAt);
  if(!/^[A-Za-z0-9._:-]{1,128}$/.test(input.collectorId))throw new Error("archive_collector_invalid");
  if(!/^[A-Za-z0-9._:-]{1,128}$/.test(input.streamId))throw new Error("archive_stream_invalid");
  if(!Number.isSafeInteger(input.sequence)||input.sequence<1)throw new Error("archive_sequence_invalid");
  const hash=String(input.bodyHash||"").toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(hash))throw new Error("archive_hash_invalid");
  return `${RAW_ARCHIVE_PREFIX}/${date}/${input.collectorId}/${input.streamId}/${input.observedAt}-${input.sequence}-${hash.slice(0,16)}.json.gz`;
}

export function trimArchiveBudgetLedger(
  source:ArchiveBudgetLedger|undefined|null,
  keepDates=7,
):ArchiveBudgetLedger{
  const src=source&&typeof source==="object"?source:{};
  const keys=Object.keys(src).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse().slice(0,Math.max(1,keepDates));
  const out:ArchiveBudgetLedger={};
  for(const key of keys){
    const v=src[key];
    const bytes=Math.max(0,Math.floor(Number(v?.bytes)||0));
    const objects=Math.max(0,Math.floor(Number(v?.objects)||0));
    out[key]={bytes,objects};
  }
  return out;
}

export function archiveBudgetDecision(args:{
  ledger:ArchiveBudgetLedger|undefined|null;
  date:string;
  bodyBytes:number;
  maxBytes?:number;
  maxObjects?:number;
}){
  const maxBytes=Math.max(1,Math.floor(args.maxBytes??RAW_ARCHIVE_DAILY_MAX_BYTES));
  const maxObjects=Math.max(1,Math.floor(args.maxObjects??RAW_ARCHIVE_DAILY_MAX_OBJECTS));
  const bodyBytes=Math.max(0,Math.floor(Number(args.bodyBytes)||0));
  const ledger=trimArchiveBudgetLedger(args.ledger);
  const current=ledger[args.date]||{bytes:0,objects:0};
  const nextBytes=current.bytes+bodyBytes;
  const nextObjects=current.objects+1;
  const allowed=bodyBytes>0&&nextBytes<=maxBytes&&nextObjects<=maxObjects;
  return {
    allowed,
    reason:allowed?"within_budget":nextBytes>maxBytes?"daily_byte_budget":"daily_object_budget",
    current,
    next:{bytes:nextBytes,objects:nextObjects},
    maxBytes,maxObjects,ledger,
  };
}

export function recordArchiveBudget(
  ledger:ArchiveBudgetLedger|undefined|null,
  date:string,
  next:ArchiveBudgetEntry,
):ArchiveBudgetLedger{
  const out=trimArchiveBudgetLedger({...ledger,[date]:next});
  out[date]={bytes:Math.max(0,Math.floor(next.bytes)),objects:Math.max(0,Math.floor(next.objects))};
  return trimArchiveBudgetLedger(out);
}
