# Stock Hunter agent instructions

Before modifying anything under this directory:
1. Read `PROJECT_CANONICAL_ARCHITECTURE.md`.
2. Read `NEW_CHAT_BOOTSTRAP.md`.
3. Verify current GitHub main and, for lifecycle/data work, live Supabase state.
4. Preserve the frozen 4.1.6 champion and Action Now → Radar → Universe UX contract.
5. Never change Hunt formulas, thresholds, lifecycle gates, capture provenance, activation state, or frozen visual identity unless the user explicitly authorizes that exact class of change.
6. Update `PROJECT_CANONICAL_ARCHITECTURE.md` whenever an approved architecture change is implemented.

7. For any Auth, profile, role, user-management, RLS, or admin-console work, read `AUTH_PROFILE_V417_ARCHITECTURE.md` first and preserve its owner-admin and least-privilege rules.

8. Continuity trigger: `ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE`. When present, read `CURRENT_HANDOFF.md` and follow its NEXT ACTION after verifying live state; never ask the user to reconstruct prior chats.

8. Continuity keyword `SHIKAR-417-CONTINUE-CANONICAL` means: reload canonical architecture, latest audits, GitHub main, and live Supabase state before any mutation.
