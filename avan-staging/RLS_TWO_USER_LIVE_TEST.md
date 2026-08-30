# Avan Core 1.0 RC1 — RLS two-user live test

This is the only RC test that must be executed against the real Supabase project with two independent authenticated sessions.

## Session A — main user
1. Open `/avan-staging/` in a normal/private window and log in as User A.
2. Settings → Core Health: confirm `Workspace قابل مشاهده = 1`.
3. Create a non-system account named `RLS-A-ONLY` under a suitable parent.
4. Confirm it appears for User A.

## Session B — second user
1. Open a separate Incognito/Private window that does not share the first session.
2. Create/sign in as User B using a different email.
3. Let Avan bootstrap its own workspace.
4. Settings → Core Health must show `Workspace قابل مشاهده = 1`.
5. Search Accounts: `RLS-A-ONLY` must NOT exist.
6. Create another account named `RLS-B-ONLY`.
7. Create one small Draft journal in User B's workspace.

## Return to Session A
1. Refresh User A.
2. `RLS-B-ONLY` must NOT exist.
3. User B's Draft must NOT appear in Journal.
4. Settings → Core Health must still show `Workspace قابل مشاهده = 1`.

## PASS criteria
- User A sees only A's workspace/data.
- User B sees only B's workspace/data.
- Neither user's distinctive account nor Draft appears in the other session.
- Both sessions show exactly 1 visible workspace.

If any cross-visibility occurs, stop release: RLS is a P0 blocker.
