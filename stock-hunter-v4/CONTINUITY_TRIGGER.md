# Stock Hunter — Continuity Trigger

Canonical trigger phrase:

> ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE

When this exact phrase appears in a new project chat, do NOT ask the user to restate project history.

Required recovery sequence:
1. Read `PROJECT_CANONICAL_ARCHITECTURE.md`.
2. Read `CURRENT_HANDOFF.md`.
3. Read `NEW_CHAT_BOOTSTRAP.md`.
4. Read `AUTH_PROFILE_V417_ARCHITECTURE.md` for any Auth/Profile/Admin work.
5. Read the latest relevant audit files under `auth/`, `prospective-data/`, `release/`, `oos/`, `promotion/`, and `canary/`.
6. Resolve current GitHub `main` SHA and PR/workflow state.
7. If Supabase is involved, read the Supabase skill, then verify live state before any mutation.
8. Reconcile repository state with live Supabase. If they disagree, stop mutation until the discrepancy is understood.
9. Continue from the `NEXT ACTION` section in `CURRENT_HANDOFF.md`, unless the user gives a newer explicit instruction.

The trigger is a deterministic bootstrap instruction, not a claim of hidden or permanent chat memory.
Repo + live state remain authoritative.
