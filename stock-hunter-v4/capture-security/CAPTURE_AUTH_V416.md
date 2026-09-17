# Stock Hunter 4.1.6 Capture Authentication Contract

CAPTURE_AUTH_CONTRACT: VAULT_SECRET_SERVICE_ROLE_ONLY

## Scope

This contract covers the deployed Supabase Edge Function `stock-hunter-capture-v416` in project `summnepwuziwulzvpcms`.

The function intentionally has `verify_jwt = false` because capture is not a browser/user-JWT endpoint. Capture authorization is a dedicated service secret boundary implemented in the function body and backed by Supabase Vault.

## Required request boundary

1. `?parity=1` is GET-only and returns only deterministic parity fixtures. It must not claim a capture lease or scan market rows.
2. The capture path is POST-only.
3. A POST must include `X-Stock-Hunter-Capture-Token`.
4. The first privileged database operation on the capture path must be validation through `public.stock_hunter_validate_capture_token_v416(text)`.
5. Validation must fail closed on missing, short, wrong, or unavailable Vault credentials.
6. Only after successful validation may the function call `claim_stock_hunter_capture_v416()`, read the integrated market dataset, or write Hunt/shadow outcomes.
7. A generic `Authorization` bearer token, publishable/anon credential, or other Supabase credential must never substitute for the dedicated capture token.

## Vault and database boundary

The capture token value is not stored in source control. The validator reads the named secret `stock_hunter_capture_token_v416` through `vault.decrypted_secrets` inside a `SECURITY DEFINER` SQL function with an empty `search_path`.

`EXECUTE` on the validator, lease claim, and capture finish functions is restricted to `service_role` (plus the owning `postgres` role). `PUBLIC`, `anon`, and `authenticated` must not have execute privilege.

`public.stock_hunter_capture_state_v416` has RLS enabled and is not granted DML access to `anon` or `authenticated`.

## Live audit snapshot — 2026-09-17

- Edge Function status: ACTIVE, version 5.
- Edge Function `verify_jwt`: false, intentionally paired with the custom Vault-backed service-secret check.
- Vault secret metadata exists for `stock_hunter_capture_token_v416`; its value was not read or exported during the audit.
- `anon`: cannot validate, claim, or finish capture.
- `authenticated`: cannot validate, claim, or finish capture.
- `service_role`: can validate, claim, and finish capture.
- Capture state table: RLS enabled; no anon/authenticated DML grant.
- Supabase Security Advisor: no Capture-related security finding at audit time.

## CI regression boundary

`.github/workflows/stock-hunter-hunt-parity-check.yml` must prove against the deployed endpoint that:

- missing capture token => HTTP 401 + `unauthorized`;
- wrong capture token => HTTP 401 + `unauthorized`;
- bearer-only credential => HTTP 401 + `unauthorized`;
- GET on base capture endpoint => HTTP 405 + `method-not-allowed`;
- POST on `?parity=1` => HTTP 405 + `method-not-allowed`;
- GET parity output still exactly matches the frozen browser fixtures.

## Deployment rule

Do not replace this dedicated capture-secret boundary with a public key, browser-exposed key, or a hard-coded repository secret. If the Edge Function is redeployed with `verify_jwt = false`, custom authentication must remain in place and the regression workflow must pass before promotion.
