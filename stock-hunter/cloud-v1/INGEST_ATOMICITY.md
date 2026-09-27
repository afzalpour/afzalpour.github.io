# Stock Hunter Cloud v1 — Ingest Atomicity Contract

Date: 2026-09-24  
Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

## Problem closed

Durable Object JavaScript can interleave requests while awaiting external I/O such as R2. A read of the last sequence followed by an R2 write followed by a sequence write was therefore not sufficient as a future multi-collector ordering proof.

## Contract

The canonical Market Coordinator now claims a short-lived global ingest lease in Durable Object transactional storage **before** external R2 I/O.

The transaction:
- rejects a sequence already committed for that collector+stream;
- rejects concurrent ingest while another fresh global lease exists;
- allows recovery from a stale lease after 300 seconds;
- decides whether the incoming snapshot is allowed to replace live latest state.

While a lease is active, another collector receives `409 ingest_busy` and its collector transport spools/retries rather than racing the live object.

After R2 work:
- successful ingest commits its per-stream sequence and releases the lease transactionally;
- a failed live R2 write releases the lease and returns 503 so the same sequence can be retried;
- a stale-but-valid snapshot may be archived and have its own stream sequence committed, but it cannot regress `live/latest` or `latest_meta`;
- identical same-timestamp snapshots do not rewrite live latest;
- same-timestamp corrected/different content may replace latest.

## Crash semantics

The lease is durable. If an invocation dies after claiming it, subsequent ingest is temporarily fail-closed. After the 300-second lease expires, a retry may recover. This prefers a short data delay over accepting out-of-order live state.

## Archive interaction

The global ingest lease also serializes access to the small archive budget ledger, so two collector streams cannot independently read the same pre-update budget and exceed the daily archive limit.

## Safety

No Hunt formula, threshold, objective, session rule, routing or lifecycle state is changed by this contract.
