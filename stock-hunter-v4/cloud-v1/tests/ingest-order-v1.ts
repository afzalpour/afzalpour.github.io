import assert from "node:assert/strict";
import {INGEST_LEASE_SECONDS,ingestClaimDecision,sameIngestLease} from "../cloudflare/src/ingest-order-v1.ts";

const now=1_790_272_800;
const lease={collector_id:"iran-primary",stream_id:"s1",sequence:11,claimed_at:now-5};

assert.equal(ingestClaimDecision({
  lastSequence:10,incomingSequence:10,now,lease:null,latest:null,observedAt:now,bodyHash:"a",
}).action,"replay");

const busy=ingestClaimDecision({
  lastSequence:10,incomingSequence:12,now,lease,latest:null,observedAt:now,bodyHash:"a",
});
assert.equal(busy.action,"busy");
assert.equal(busy.pendingSequence,11);

const stale=ingestClaimDecision({
  lastSequence:10,incomingSequence:12,now,
  lease:{...lease,claimed_at:now-INGEST_LEASE_SECONDS-1},
  latest:{observed_at:now-30,body_sha256:"a"},
  observedAt:now,bodyHash:"b",
});
assert.equal(stale.action,"claim");
assert.equal(stale.applyLatest,true);

const older=ingestClaimDecision({
  lastSequence:10,incomingSequence:11,now,lease:null,
  latest:{observed_at:now,body_sha256:"a"},
  observedAt:now-1,bodyHash:"b",
});
assert.equal(older.action,"claim");
assert.equal(older.applyLatest,false);

const sameSnapshot=ingestClaimDecision({
  lastSequence:10,incomingSequence:11,now,lease:null,
  latest:{observed_at:now,body_sha256:"abc"},
  observedAt:now,bodyHash:"ABC",
});
assert.equal(sameSnapshot.applyLatest,false);

const correctedSameTime=ingestClaimDecision({
  lastSequence:10,incomingSequence:11,now,lease:null,
  latest:{observed_at:now,body_sha256:"abc"},
  observedAt:now,bodyHash:"def",
});
assert.equal(correctedSameTime.applyLatest,true);

assert.equal(sameIngestLease(lease,{collectorId:"iran-primary",streamId:"s1",sequence:11}),true);
assert.equal(sameIngestLease(lease,{collectorId:"iran-primary",streamId:"s1",sequence:12}),false);

console.log("cloud-ingest-order-v1: PASS");
