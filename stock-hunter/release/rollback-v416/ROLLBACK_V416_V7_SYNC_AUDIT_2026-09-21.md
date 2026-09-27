# Stock Hunter — 4.1.6 Rollback Package v7 Sync Audit

DATE: 2026-09-21
STATUS: LIVE_SYNC_PASS
SCOPE: recovery identity only

The production Champion capture backend was explicitly upgraded to deployment v7 to enforce per-row source freshness <=180 seconds before prospective evaluation.

Current live identity:
- slug: `stock-hunter-capture-v416`
- deployment version: 7
- verify_jwt: false
- bundle SHA-256: `49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740`
- auth contract: `VAULT_HMAC_NONCE_V2`
- per-row freshness gate: `updated_at >= now - 180 seconds`

Repository sync:
- preserved rollback source is exact capture-v416 v7 source;
- future final-freeze rollback metadata pins deployment version 7 and the v7 hash;
- final-release verification contracts check v7 identity and the per-row freshness tokens;
- v4.1.7 capture remains dark and unchanged; the dark derivation contract normalizes only this explicitly approved v416 freshness delta.

Safety:
- no final-freeze invocation
- no release manifest or authorization
- no routing transition
- no challenger traffic
- Hunt formulas/thresholds unchanged

Live SQL sync and post-sync verification are appended after application.


## Live closure

Applied the repository-defined targeted SQL through the live database connection.

Verified live function:
- `private.freeze_stock_hunter_release_v417(bigint,bigint,text)`
- rollback capture deployment version: 7
- rollback capture SHA-256: `49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740`
- rollback auth contract: `VAULT_HMAC_NONCE_V2`

Post-sync safety:
- routing: `CHAMPION_ONLY`
- challenger traffic: 0%
- kill switch: ON
- state_version: 1
- activation_review_id: null
- release manifests: 0
- freeze authorizations: 0
- rollback archives: 0

No release freeze function invocation was performed.
