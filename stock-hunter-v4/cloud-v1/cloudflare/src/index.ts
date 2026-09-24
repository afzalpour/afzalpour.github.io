export interface Env {
  MARKET_COORDINATOR: DurableObjectNamespace;
  MARKET_LATEST: R2Bucket;
  COLLECTOR_KEYS_JSON: string;
  PUBLIC_ORIGIN?: string;
  INGEST_MAX_SKEW_SECONDS?: string;
}

const PROTOCOL = "stock-hunter-iran-ingest-v1";
const DEFAULT_PUBLIC_ORIGIN = "https://afzalpour.github.io";

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.PUBLIC_ORIGIN || DEFAULT_PUBLIC_ORIGIN;
  if (origin && origin === allowed) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return {};
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) throw new Error(`missing_header:${name}`);
  return value;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const output = new Uint8Array(value.length / 2);
  for (let i = 0; i < output.length; i++) {
    output[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return output;
}

async function sha256Hex(body: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", body));
}

async function verifyHmac(
  secret: string,
  canonical: string,
  signatureHex: string,
): Promise<boolean> {
  const signature = fromHex(signatureHex);
  if (!signature || signature.byteLength !== 32) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(canonical),
  );
}

async function ungzip(body: ArrayBuffer): Promise<ArrayBuffer> {
  const input = new Blob([body]).stream();
  const output = input.pipeThrough(new DecompressionStream("gzip"));
  return new Response(output).arrayBuffer();
}

function collectorSecret(env: Env, collectorId: string): string | null {
  try {
    const map = JSON.parse(env.COLLECTOR_KEYS_JSON || "{}") as Record<string, unknown>;
    const value = map[collectorId];
    return typeof value === "string" && value.length >= 16 ? value : null;
  } catch {
    return null;
  }
}

async function verifyIngest(request: Request, env: Env) {
  const protocol = requiredHeader(request, "X-SH-Protocol");
  const collectorId = requiredHeader(request, "X-SH-Collector");
  const streamId = requiredHeader(request, "X-SH-Stream");
  const sequenceRaw = requiredHeader(request, "X-SH-Sequence");
  const timestampRaw = requiredHeader(request, "X-SH-Timestamp");
  const nonce = requiredHeader(request, "X-SH-Nonce");
  const signature = requiredHeader(request, "X-SH-Signature").toLowerCase();
  const encoding = requiredHeader(request, "X-SH-Encoding");

  if (protocol !== PROTOCOL) throw new Error("protocol_mismatch");
  if (encoding !== "gzip") throw new Error("encoding_mismatch");
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(collectorId)) throw new Error("collector_invalid");
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(streamId)) throw new Error("stream_invalid");
  if (!/^[A-Za-z0-9._:-]{8,256}$/.test(nonce)) throw new Error("nonce_invalid");
  if (!/^\d{1,20}$/.test(sequenceRaw)) throw new Error("sequence_invalid");
  if (!/^\d{10}$/.test(timestampRaw)) throw new Error("timestamp_invalid");

  const sequence = Number(sequenceRaw);
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("sequence_invalid");
  if (!Number.isSafeInteger(timestamp)) throw new Error("timestamp_invalid");

  const maxSkew = Math.max(30, Number(env.INGEST_MAX_SKEW_SECONDS || "180"));
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxSkew) throw new Error("timestamp_stale");

  const secret = collectorSecret(env, collectorId);
  if (!secret) throw new Error("collector_unknown");

  const rawBody = await request.arrayBuffer();
  if (rawBody.byteLength < 20 || rawBody.byteLength > 20 * 1024 * 1024) {
    throw new Error("body_size_invalid");
  }
  const bodyHash = await sha256Hex(rawBody);
  const canonical =
    `v1\n${collectorId}\n${streamId}\n${sequence}\n${timestamp}\n${nonce}\n${bodyHash}`;
  if (!(await verifyHmac(secret, canonical, signature))) {
    throw new Error("signature_invalid");
  }

  let payload: any;
  try {
    const inflated = await ungzip(rawBody);
    payload = JSON.parse(new TextDecoder().decode(inflated));
  } catch {
    throw new Error("payload_invalid");
  }

  if (
    payload?.protocol !== PROTOCOL ||
    payload?.collector_id !== collectorId ||
    payload?.stream_id !== streamId ||
    Number(payload?.sequence) !== sequence
  ) {
    throw new Error("signed_identity_mismatch");
  }

  const observedAt = Number(payload?.observed_at);
  if (!Number.isSafeInteger(observedAt) || observedAt <= 0) {
    throw new Error("observed_at_invalid");
  }
  if (!Array.isArray(payload?.rows)) throw new Error("rows_invalid");

  return {
    protocol,
    collectorId,
    streamId,
    sequence,
    timestamp,
    nonce,
    bodyHash,
    observedAt,
    rawBody,
    rowCount: payload.rows.length,
  };
}

async function marketStub(env: Env): Promise<DurableObjectStub> {
  const id = env.MARKET_COORDINATOR.idFromName("canonical-market");
  return env.MARKET_COORDINATOR.get(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === "POST" && url.pathname === "/v1/ingest") {
      try {
        const verified = await verifyIngest(request, env);
        const stub = await marketStub(env);
        return stub.fetch("https://market.internal/ingest", {
          method: "POST",
          headers: {
            "X-Internal-Verified": "1",
            "X-SH-Collector": verified.collectorId,
            "X-SH-Stream": verified.streamId,
            "X-SH-Sequence": String(verified.sequence),
            "X-SH-Observed-At": String(verified.observedAt),
            "X-SH-Body-SHA256": verified.bodyHash,
            "X-SH-Row-Count": String(verified.rowCount),
          },
          body: verified.rawBody,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "ingest_rejected";
        const status =
          message === "collector_unknown" || message === "signature_invalid" ? 401 : 400;
        return json({ error: message }, status);
      }
    }

    if (request.method === "GET" && url.pathname === "/v1/latest") {
      const stub = await marketStub(env);
      const response = await stub.fetch("https://market.internal/latest");
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(request, env))) {
        headers.set(key, String(value));
      }
      return new Response(response.body, { status: response.status, headers });
    }

    if (request.method === "GET" && url.pathname === "/v1/health") {
      const stub = await marketStub(env);
      const response = await stub.fetch("https://market.internal/health");
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(request, env))) {
        headers.set(key, String(value));
      }
      return new Response(response.body, { status: response.status, headers });
    }

    return json({ error: "not_found" }, 404, corsHeaders(request, env));
  },
};

type LatestMeta = {
  collector_id: string;
  stream_id: string;
  sequence: number;
  observed_at: number;
  accepted_at: number;
  body_sha256: string;
  row_count: number;
};

export class MarketCoordinator {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/ingest") {
      if (request.headers.get("X-Internal-Verified") !== "1") {
        return json({ error: "internal_auth_required" }, 401);
      }

      const collectorId = requiredHeader(request, "X-SH-Collector");
      const streamId = requiredHeader(request, "X-SH-Stream");
      const sequence = Number(requiredHeader(request, "X-SH-Sequence"));
      const observedAt = Number(requiredHeader(request, "X-SH-Observed-At"));
      const bodyHash = requiredHeader(request, "X-SH-Body-SHA256");
      const rowCount = Number(requiredHeader(request, "X-SH-Row-Count"));

      const seqKey = `seq:${collectorId}:${streamId}`;
      const lastSequence = (await this.state.storage.get<number>(seqKey)) || 0;
      if (sequence <= lastSequence) {
        return json(
          { error: "sequence_replay", last_sequence: lastSequence },
          409,
        );
      }

      const body = await request.arrayBuffer();
      const acceptedAt = Math.floor(Date.now() / 1000);
      const meta: LatestMeta = {
        collector_id: collectorId,
        stream_id: streamId,
        sequence,
        observed_at: observedAt,
        accepted_at: acceptedAt,
        body_sha256: bodyHash,
        row_count: rowCount,
      };

      await this.env.MARKET_LATEST.put("live/latest.json.gz", body, {
        httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
        customMetadata: {
          collector_id: collectorId,
          stream_id: streamId,
          sequence: String(sequence),
          observed_at: String(observedAt),
          accepted_at: String(acceptedAt),
          body_sha256: bodyHash,
          row_count: String(rowCount),
        },
      });

      await this.state.storage.put({
        [seqKey]: sequence,
        latest_meta: meta,
      });

      return json({ ok: true, accepted: meta });
    }

    if (request.method === "GET" && url.pathname === "/latest") {
      const object = await this.env.MARKET_LATEST.get("live/latest.json.gz");
      if (!object) return json({ error: "no_market_snapshot" }, 404);
      const headers = new Headers();
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Content-Encoding", "gzip");
      headers.set("Cache-Control", "no-store");
      const meta = await this.state.storage.get<LatestMeta>("latest_meta");
      if (meta) {
        headers.set("X-SH-Observed-At", String(meta.observed_at));
        headers.set("X-SH-Accepted-At", String(meta.accepted_at));
        headers.set("X-SH-Sequence", String(meta.sequence));
      }
      return new Response(object.body, { status: 200, headers });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const meta = await this.state.storage.get<LatestMeta>("latest_meta");
      if (!meta) return json({ status: "empty" }, 200);
      const now = Math.floor(Date.now() / 1000);
      const ageSeconds = Math.max(0, now - meta.observed_at);
      return json({
        status: ageSeconds <= 180 ? "fresh" : "stale",
        age_seconds: ageSeconds,
        latest: meta,
      });
    }

    return json({ error: "not_found" }, 404);
  }
}
