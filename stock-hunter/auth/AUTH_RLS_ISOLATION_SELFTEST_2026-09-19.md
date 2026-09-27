# Auth/RLS Isolation Self-Test — 2026-09-19

Status: PASS

Test id: 5f88fd6f-be0c-40f3-9339-738697f6a55d

The self-test created two temporary real Supabase Auth users, obtained two real user sessions/JWTs, executed browser-equivalent REST and Edge Function requests, then deleted both users.

PASS assertions:
- own profile read
- own watchlist create
- cross-user profile read blocked
- cross-user profile update blocked
- cross-user watchlist read blocked
- forged watchlist insert as another user blocked
- self role escalation blocked
- normal user Admin API access blocked
- suspended account blocked by RLS even with already-issued JWT
- distinct users and real sessions created
- cleanup successful

Cleanup verification: zero temporary test users remain.

The self-test control token was one-time, stored in Vault, and the control row is disabled after execution.
