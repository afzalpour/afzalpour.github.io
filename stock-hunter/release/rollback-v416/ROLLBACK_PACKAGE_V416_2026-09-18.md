# Stock Hunter 4.1.6 Rollback Package

ARCHIVE_DATE: 2026-09-18
SECURITY_REFRESH_DATE: 2026-09-21
STATUS: PRESERVED / DO_NOT_RETIRE_BEFORE_FINAL_417_FREEZE
PURPOSE: operational rollback target for the 4.1.7 release train

## Runtime identity

- stable release: 4.1.6
- engine: 4.1.6-hunt-v2
- dashboard label/assets: 4.1.6
- pre-final source commit: b550ac2dddf297d2436493f4e7384a166dbdf1dd
- index.html blob: bb2ca00e0f7f08601f26daf5b9837f52c3a9c33f
- app-hunt-v416.js blob: b4e71668d6470d47dc49d3dd5945cbe7a5a8bf77
- sw.js blob: 59b79a3385a756fdd6d5aae1f2b3d8f88a4fd52c
- service worker cache: shikar-sahm-v4.1.6-r12

## Capture backend

- slug: stock-hunter-capture-v416
- live deployment version after freshness/security refresh: 7
- deployment bundle sha256: 49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740
- verify_jwt: false
- authentication contract: VAULT_HMAC_NONCE_V2
- archived source: stock-hunter-v4/release/rollback-v416/stock-hunter-capture-v416/index.ts

The archived function source is the exact hardened v7 source. It rejects the legacy static capture-token header and requires timestamp + nonce + HMAC-SHA256 validation through the private replay-resistant validator. No HMAC key or privileged credential is archived.

## Rollback semantics

Rollback does not require a database downgrade. The 4.1.7 control-plane and audit schema may remain installed while runtime routing returns to the 4.1.6 champion path.

Do not delete or retire this package merely because a 4.1.7 manifest is PREPARED. It becomes the archived previous-stable package only in the same transaction that changes the 4.1.7 release manifest from PREPARED to FROZEN after real post-activation stabilization and separate manual authorization.

The final database archive records this same package identity and preserves the pre-freeze activation status snapshot.


## Per-row freshness refresh — 2026-09-21

The preserved rollback capture source now matches live capture-v416 deployment v7:
- deployment version: 7
- bundle SHA-256: 49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740
- HMAC timestamp + nonce authorization unchanged
- per-row prospective freshness: source `updated_at` must be within 180 seconds before evaluation
- Hunt formulas and thresholds unchanged
