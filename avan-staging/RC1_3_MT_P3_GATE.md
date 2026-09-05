# RC1.3-MT-P3 — Controlled Support Access Gate

## Platform Admin
1. Hard refresh Staging; PWA cache must be v40.
2. Open `مدیریت سامانه آوان`.
3. For a test Company, start Support with 15 minutes and a clear reason.
4. A read-only Support box appears with expiry and reason.
5. Open Support Viewer. It must show only predefined read-only resources.
6. No create/edit/delete/post/reverse/upload/download-private-file action exists.
7. Revoke the session; Viewer must stop working immediately.

## Company Admin visibility
1. As Owner/Manager of that Company open `تنظیمات`.
2. `دسترسی پشتیبانی آوان` card must show session history and active session details.
3. Owner/Manager can immediately revoke an active Support session.
4. Accountant/Viewer must not get Company-admin support controls.

## Security boundaries
- Platform Admin does not become a `workspace_member`.
- Ordinary tenant RLS remains closed to Platform Admin unless they independently have Company membership.
- Support access uses a dedicated session and dedicated read-only RPC.
- Session is actor-bound, reason-required, 5–60 minutes, expires automatically, and is revocable.
- Archived Tenant cannot receive a new Support session.
- Every support session create/read/revoke is platform-audited; create/revoke is also visible in Company audit.

## PASS phrase
`Gate RC1.3-MT-P3 پاس شد`
