# Stock Hunter 4.1.7 — Auth Platform Configuration Blockers

DATE: 2026-09-20
STATUS: PLATFORM_BLOCKED / ENGINEERING_PATH_VERIFIED

## Site URL / Redirect allow-list

Hosted Supabase documentation confirms that Site URL and additional Redirect URLs are hosted Auth configuration. They can be changed in Dashboard or through the Management API Auth config endpoint:

`PATCH /v1/projects/{ref}/config/auth`

The existing repository workflow:
`.github/workflows/stock-hunter-auth-url-config-fix.yml`

already implements a Management API route, but its verified run `35455470843` failed at `Require Supabase management token`. The actual PATCH step was skipped because repository secret `SUPABASE_ACCESS_TOKEN` was unavailable.

Current connected Supabase tooling exposes database/project/Edge/advisor operations but does not expose hosted Auth config mutation. The project service-role/secret key is not a Management API access token and must not be substituted.

Result: Site URL/redirect correction is blocked on either:
1. a legitimate Supabase Management API access token being connected to the workflow; or
2. a human Dashboard configuration change.

## Leaked Password Protection

Current Supabase password-security documentation states that leaked-password protection is available on the Pro plan and above.

The current project previously returned the platform error:
`Branching is supported only on the Pro plan or above`
when an isolated branch was requested. Therefore the currently available project plan does not satisfy the Pro-only feature requirement observed for Leaked Password Protection.

Security Advisor continues to report:
`auth_leaked_password_protection` — WARN.

Result: this setting cannot be closed on the current project plan without a plan capability change.

## Impact / boundaries

These platform blockers do not invalidate the already-passed deployed browser login/Preferences/Watchlist/Admin-isolation/logout smoke.

They do block declaring the complete Auth/Profile release gate final because:
- password-recovery/public redirect behavior has not been safely verified against the correct hosted redirect configuration;
- leaked-password protection remains unavailable/disabled.

No workaround should weaken redirect validation or emulate HIBP checks in browser code.
