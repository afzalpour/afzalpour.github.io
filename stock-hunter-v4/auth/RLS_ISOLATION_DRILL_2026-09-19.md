# Auth RLS Isolation Drill — 2026-09-19

Status: PASS at database authenticated-role/RLS layer.
Release-grade real-session two-user test: still pending.

## Cross-identity isolation
The drill used PostgreSQL role `authenticated` with controlled `request.jwt.claim.sub` identities.

An owner-owned temporary Watchlist fixture was created through normal authenticated RLS.

A distinct simulated authenticated identity observed:
- owner Profile rows: 0;
- owner Role rows: 0;
- owner Watchlist rows: 0;
- UPDATE owner Watchlist: 0 rows;
- DELETE owner Watchlist: 0 rows.

The owner identity still saw the unchanged fixture.
Fixture cleanup completed and 0 fixture rows remained.

## Suspended-account access
Inside a transaction, the owner profile was temporarily marked `suspended`, then the request identity was switched to the owner's authenticated UID.

Observed:
- own Profile rows visible: 0;
- own Role rows visible: 0;
- own Preferences rows visible: 0.

The transaction was rolled back. The live owner account remained active.

## Interpretation
This proves the database RLS predicates fail closed for cross-identity access and suspended-account access.

It does NOT replace the final real-session test requirement:
- create at least two distinct non-owner Supabase Auth accounts;
- obtain genuine user sessions;
- repeat read/update/delete negative tests through the public Data API;
- execute admin negative authorization;
- exercise suspend/reactivate and verify Auth sign-in/refresh behavior.
