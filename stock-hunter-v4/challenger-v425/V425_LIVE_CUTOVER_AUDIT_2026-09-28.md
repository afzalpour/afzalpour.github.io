# Stock Hunter 4.2.5 — Live Cutover / Shadow Audit — 2026-09-28

Status: DELIVERY_BACKEND_REGISTERED / LOCAL_EXECUTION_PENDING

## Champion safety
- Production Champion remains `4.1.6-hunt-v2`.
- Production routing remains `CHAMPION_ONLY`, Challenger traffic `0%`, kill switch engaged.
- No Champion formula, threshold, state or Action Now/Radar eligibility was changed.

## Secure Windows delivery
- Source commit used for delivery artifact: `122bfab688a9c437f9c253e68e2b6eac6114d108`.
- Delivery artifact: `Stock_Hunter_PC_Eco_Bridge_v4.2.5.exe`.
- EXE SHA-256: `e61b52f065bc26e2ac781dd9efb8c6b2e5db8a501e912270ce0be3681f83e4e4`.
- Registered v4.2.5 device-key SHA-256: `e1d7d45b571ab181891429b7f895478c3218a7583db82ae5e6f1f22185519b3d`.
- Plaintext device credential is embedded only inside the sealed executable and is never committed or emitted as a sidecar.
- Legacy v4.1.1 digest remains accepted temporarily for zero-downtime migration.
- Live ingest `stock-hunter-pc-ingest-v410` was deployed as version 9 with dual-digest acceptance.
- A future delivery artifact is not automatically authorized merely because it was built; its digest must be registered before use.

## Cloud shadow credential repair
The first v4.2.5 cloud-shadow push run failed at the credential preflight because the GitHub environment did not provide the S3-compatible `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` pair.

The repaired workflow supports the bounded Cloudflare account API-token path:
- Cloudflare R2 REST API is used for prefix/list operations.
- Wrangler `r2 object get/put --remote` is used for object transfers.
- No R2 S3 access-key pair is required by the repaired workflow.
- Raw-pack and v4.2.5 shadow workflows use the same credential model.

## Cutover proof still required
Local deployment cannot be asserted from repository/backend work alone. Cutover is complete only after the owner runs the delivered EXE and live health reports:
- `agent_version = 4.2.5-pc-eco-challenger-features`;
- `source = pc-eco-bridge-v425`;
- `challenger_feature_version_v425 = 4.2.5-challenger-features-v1` appears on live rows;
- first-three-level readiness becomes non-zero;
- RVOL maturity remains expected to require at least three prior observed sessions.

Until that proof, production remains on the legacy local feed process even though Backend acceptance and Shadow tooling are ready.
