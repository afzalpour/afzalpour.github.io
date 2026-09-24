# Stock Hunter Iran Collector Protocol v1

Protocol ID: `stock-hunter-iran-ingest-v1`

This protocol transports market facts from an Iran-egress collector to the cloud ingest gateway. It carries **no Hunt decision authority**.

## Headers

Required:
- `X-SH-Protocol: stock-hunter-iran-ingest-v1`
- `X-SH-Collector: <collector-id>`
- `X-SH-Stream: <stream-id>`
- `X-SH-Sequence: <uint64>`
- `X-SH-Timestamp: <unix-seconds>`
- `X-SH-Nonce: <random-token>`
- `X-SH-Signature: <lowercase-hex-hmac-sha256>`
- `X-SH-Encoding: gzip`
- `Content-Type: application/octet-stream`

The HTTP body is a gzip-compressed UTF-8 JSON document.

## Canonical signature

Compute SHA-256 over the exact transmitted body bytes and lowercase-hex encode it.

Build this UTF-8 string exactly:

```text
v1
<collector-id>
<stream-id>
<sequence>
<timestamp>
<nonce>
<body-sha256-hex>
```

Then:

```text
signature = hex(HMAC-SHA256(secret, canonical-string))
```

No trailing newline is included.

## Payload

```json
{
  "protocol": "stock-hunter-iran-ingest-v1",
  "collector_id": "iran-primary",
  "stream_id": "persistent-random-id",
  "sequence": 123,
  "observed_at": 1790272800,
  "source": {
    "name": "TSETMC",
    "transport": "MarketWatchInit+MarketWatchPlus",
    "refid": 123456,
    "market_state": "..."
  },
  "rows": []
}
```

Each row contains point-in-time market facts only. Derived Hunt decisions are prohibited at the collector layer.

Recommended row fields:
- instrument identity: `id`, `isin`, `symbol`, `company_name`;
- source time: `heven`;
- prices: `closing_price`, `last_price`, `low_price`, `high_price`, `yesterday_price`, `min_allowed`, `max_allowed`;
- activity: `tno`, `volume`, `value`, `flow`;
- five BestLimits levels with prices, quantities, and order counts;
- raw ClientType intraday counters when available.

Do not replace quantities with order counts. Do not backfill absent fields from future data.

## Validation

Cloud must reject:
- protocol mismatch;
- unknown collector;
- timestamp outside configured freshness window;
- malformed sequence;
- invalid HMAC;
- body hash mismatch;
- collector/stream/sequence values in body that disagree with signed headers;
- sequence not strictly greater than the last accepted sequence for the same collector+stream.

A newly provisioned collector may use a new `stream_id` and restart sequence from 1. Stream IDs must be random/persistent per installation.

## Spool semantics

Collector may persist failed outbound payloads in a bounded local spool.

Rules:
- body keeps its original `observed_at` and sequence;
- on replay, use a fresh transport timestamp and fresh nonce;
- replay in sequence order;
- flush backlog before sending newer live sequence values for the same stream;
- enforce byte and age caps;
- if eviction is required, emit an explicit local data-loss marker and cloud freshness must remain fail-closed.

## Fixed interoperability vector

Secret:

```text
test-secret
```

Exact body bytes:

```text
{"hello":"world"}
```

Body SHA-256:

```text
93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588
```

Canonical fields:
- collector: `collector-test`
- stream: `stream-test`
- sequence: `42`
- timestamp: `1790272800`
- nonce: `nonce-abc`

Canonical string:

```text
v1
collector-test
stream-test
42
1790272800
nonce-abc
93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588
```

Expected signature for that exact vector is generated and asserted by the Python and Node self-tests in this branch.
