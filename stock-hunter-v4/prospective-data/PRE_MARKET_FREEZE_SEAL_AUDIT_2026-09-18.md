# Stock Hunter Pre-Market Freeze Seal — 2026-09-18

STATUS: LIVE_PASS / FREEZE_ACTIVE
CANONICAL_MAIN_SHA: 4e2739fc5c90d22018a555cb148370cff375d1ae
PROSPECTIVE_START_UTC: 2026-09-19T05:30:00Z
PROSPECTIVE_START_TEHRAN: 2026-09-19 09:00

The pre-market freeze verifier is read-only and fails closed on any drift before the first natural market window.

Live result at 2026-09-18 18:57 Tehran:
- verifier: stock-hunter-pre-market-freeze-seal-v417
- result: PASS
- collection_state: ARMED_AWAITING_FIRST_MARKET_WINDOW
- capture last run/success/error: null/null/null
- Shadow/Hunt/Calibration mature: 0/0/0
- exact active capture jobs: 3
- active capture-v417 cron callers: 0
- exact downstream jobs: 5
- pg_cron scheduler: alive
- pg_net worker: alive
- Vault dependency names present: 2
- activation: CHAMPION_ONLY / 0% / kill switch ON / state_version 1 / no review
- OOS manifest / Promotion / Review / Release pin: 0 / 0 / 0 / 0

No production mutation was performed.

Freeze rule:
NO_MUTATION_UNTIL_FIRST_NATURAL_MARKET_WINDOW

After prospective start this verifier intentionally expires; launch and first-capture incident verifiers become authoritative.
