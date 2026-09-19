# Stock Hunter — Continuity Trigger

Canonical continuation keyword:

`SHIKAR-417-CONTINUE-CANONICAL`

Legacy compatibility alias:

`ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE`

Both forms invoke the same deterministic bootstrap. The canonical keyword is the source of truth.

Required recovery sequence:
1. Read `PROJECT_CANONICAL_ARCHITECTURE.md`.
2. Read `CURRENT_HANDOFF.md`.
3. Read `NEW_CHAT_BOOTSTRAP.md`.
4. Read `AUTH_PROFILE_V417_ARCHITECTURE.md` for Auth/Profile/Admin work.
5. Read the latest relevant audit files.
6. Resolve current GitHub `main` and workflow state.
7. Read the Supabase skill and verify live Supabase state before any Supabase mutation.
8. Reconcile repository state with live state.
9. Continue from `NEXT ACTION` unless the user gives a newer explicit instruction.

This is a repository-backed continuation protocol, not hidden permanent memory.
