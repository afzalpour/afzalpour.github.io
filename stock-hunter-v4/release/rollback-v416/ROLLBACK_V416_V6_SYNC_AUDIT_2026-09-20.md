# Stock Hunter — 4.1.6 Rollback Package v6 Sync Audit

DATE: 2026-09-20
STATUS: PREPARED / LIVE_FUNCTION_SYNC_PENDING
SCOPE: recovery identity only

## Finding

The preserved 4.1.6 rollback package still referenced the pre-HMAC capture-v416 deployment v5 even though the frozen production Champion now runs the hardened capture-v416 deployment v6.

Live Champion capture identity verified through Supabase Management:
- slug: `stock-hunter-capture-v416`
- status: ACTIVE
- deployment version: 6
- verify_jwt: false
- bundle SHA-256: `b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af`
- auth contract: `VAULT_HMAC_NONCE_V2`

The live source is byte-identical to `stock-hunter-v4/capture-security/stock-hunter-capture-v416/index.ts`.

## Repair

This change:
- refreshes the archived rollback Edge source to the exact current v6 Champion source;
- refreshes the future rollback archive identity in final-release SQL to capture v6 + current SHA-256 + HMAC/nonce auth contract;
- strengthens the final-release verifier to check rollback deployment version and auth contract;
- updates final-release CI assertions to reject the legacy static-token validator in the archived rollback source;
- updates release audit text so future operators do not freeze 4.1.7 with a stale 4.1.6 rollback identity;
- adds a targeted idempotent function-definition migration for the live final-freeze function.

## Safety

No invocation of the final-freeze function is performed.
No release manifest, authorization, release freeze, activation review, routing transition or challenger traffic is created.
No 4.1.6 scoring formula, threshold, model, capture provenance rule or prospective lifecycle gate is changed.

4.1.6 remains the frozen production Champion.
4.1.7 remains fail-closed until the canonical statistical lifecycle permits advancement.
