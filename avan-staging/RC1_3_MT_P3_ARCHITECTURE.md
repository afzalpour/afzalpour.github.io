# RC1.3-MT-P3 Architecture

Controlled Support Access is a fourth, temporary authorization context and is **not** Company membership.

- Platform Admin remains outside `workspace_members`.
- A support session is actor-bound, tenant-bound, reason-required, read-only and expires in 5–60 minutes.
- Ordinary Company RLS is unchanged and does not grant Platform Admin tenant access.
- Support reads pass only through `platform_support_read` and a private SECURITY DEFINER implementation.
- Resources are allowlisted and column-reduced. No raw private file path, OCR text, mutation, posting or reversal endpoint is exposed.
- Every support read is Platform Audit logged.
- Session create/revoke is logged both in Platform Audit and Company Audit.
- Owner/Manager can view session history and revoke an active session immediately.
- Public wrappers are SECURITY INVOKER and anon execute is revoked.
