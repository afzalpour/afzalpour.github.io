# RC1.3-MT-P3 Backend Verification

- Platform Admin with zero membership in test Company:
  - ordinary `accounts` RLS rows = 0
  - dedicated Support RPC returned `read_only=true`
  - limited Support rows = 10
  - Platform revoke = true
  - session active after revoke = false
- Company Owner test:
  - active support session visible = 1
  - Company Owner revoke = true
  - session active after Company revoke = false
- All tests were transaction-scoped and rolled back.
- Active test support sessions after verification = 0.
- Public P3 wrappers with SECURITY DEFINER = 0.
- anon executable P3 wrappers = 0.
- authenticated executable P3 wrappers = 6.
- Advisor: new private support-session table is RLS-enabled with no direct browser policy/grant by design; existing SECURITY DEFINER backlog and leaked-password warning remain separate backlog.
