# Stock Hunter — New Chat Bootstrap Protocol

Use this at the start of every new project chat before any mutation.

Canonical continuity trigger: `ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE`
If the trigger is supplied, do not ask the user to recap. Read `CURRENT_HANDOFF.md` immediately after the canonical architecture.

1. Read `stock-hunter-v4/PROJECT_CANONICAL_ARCHITECTURE.md`.
2. Read `stock-hunter-v4/CURRENT_HANDOFF.md`.
3. Read the latest relevant audit/handoff files under:
   - `prospective-data/`
   - `release/`
   - `oos/`
   - `promotion/`
   - `canary/`
4. Read current production files from GitHub `main` rather than assuming a prior assistant message is still current.
5. If Supabase is involved, read the Supabase skill and verify live state before action.
6. Confirm:
   - production version / engine;
   - current main SHA;
   - prospective/calibration/OOS state;
   - routing mode, traffic %, kill switch;
   - capture callers;
   - feed freshness.
7. Treat user-approved visual identity and Action Now → Radar → Universe contract as frozen.
8. Do not invent missing architecture from memory. If a required fact is absent from canonical sources, explicitly mark it unknown and verify.
9. After any approved architecture change, update the canonical architecture file in the same change set.

Continuity principle: **repo + live state are authoritative; chat memory is only supplementary.**
