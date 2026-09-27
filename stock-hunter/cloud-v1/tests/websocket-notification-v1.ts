import assert from "node:assert/strict";
import { snapshotNotificationV1 } from "../cloudflare/src/index.ts";

const meta={
  collector_id:"iran-primary",
  stream_id:"stream-1",
  sequence:77,
  observed_at:1790272800,
  accepted_at:1790272802,
  body_sha256:"a".repeat(64),
  row_count:4267,
};

const msg=snapshotNotificationV1(meta as any);
assert.deepStrictEqual(msg,{
  protocol:"stock-hunter-live-v1",
  type:"snapshot_available",
  observed_at:1790272800,
  accepted_at:1790272802,
  sequence:77,
  row_count:4267,
  body_sha256:"a".repeat(64),
  collector_id:"iran-primary",
});

const encoded=JSON.stringify(msg);
assert.ok(encoded.length<512, "WebSocket notification must remain metadata-only");
assert.equal(encoded.includes("rows"), false, "notification must not contain market rows");

console.log("cloud-websocket-notification-contract: PASS");
