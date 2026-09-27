export const INGEST_LEASE_SECONDS=300;

export type GlobalIngestLease={
  collector_id:string;
  stream_id:string;
  sequence:number;
  claimed_at:number;
};

export type LatestOrderMeta={
  observed_at:number;
  body_sha256:string;
};

export function sameIngestLease(
  a:GlobalIngestLease|undefined|null,
  b:{collectorId:string;streamId:string;sequence:number},
):boolean{
  return Boolean(a&&a.collector_id===b.collectorId&&a.stream_id===b.streamId&&a.sequence===b.sequence);
}

export function ingestClaimDecision(args:{
  lastSequence:number;
  incomingSequence:number;
  now:number;
  lease?:GlobalIngestLease|null;
  leaseSeconds?:number;
  latest?:LatestOrderMeta|null;
  observedAt:number;
  bodyHash:string;
}){
  const last=Math.max(0,Math.floor(Number(args.lastSequence)||0));
  const incoming=Math.floor(Number(args.incomingSequence)||0);
  if(!Number.isSafeInteger(incoming)||incoming<1)throw new Error("claim_sequence_invalid");
  if(incoming<=last){
    return {action:"replay" as const,lastSequence:last,applyLatest:false};
  }

  const leaseSeconds=Math.max(30,Math.floor(args.leaseSeconds??INGEST_LEASE_SECONDS));
  const lease=args.lease||null;
  if(lease){
    const age=Math.max(0,args.now-Number(lease.claimed_at||0));
    if(age<=leaseSeconds){
      return {
        action:"busy" as const,
        lastSequence:last,
        applyLatest:false,
        pendingSequence:lease.sequence,
        pendingCollector:lease.collector_id,
        pendingStream:lease.stream_id,
        leaseAgeSeconds:age,
      };
    }
  }

  const latest=args.latest||null;
  const observedAt=Math.floor(Number(args.observedAt)||0);
  let applyLatest=!latest||observedAt>Number(latest.observed_at||0);
  if(latest&&observedAt===Number(latest.observed_at||0)){
    applyLatest=String(args.bodyHash||"").toLowerCase()!==String(latest.body_sha256||"").toLowerCase();
  }
  return {action:"claim" as const,lastSequence:last,applyLatest};
}
