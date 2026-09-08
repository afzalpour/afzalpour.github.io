# RC1.5-C.1.2 Gate Evidence

Status: ENGINEERING PASS / LIVE PASS PENDING

## Live issues addressed
- Persian-only settings copy: health storage text, logo upload helper, and e-invoice gate note.
- Native English file chooser hidden behind a stable Persian file control.
- Restored custom report builder by fixing the async Lifecycle surface-replacement race.
- Inventory custom-report sources remain: کالاها، موجودی انبار، گردش کالا.
- Platform tax center: authorized platform admins can edit draft tax rules; published rules remain immutable; publish remains platform-owner only.
- Staging PWA cache bumped to `avan-staging-rc1-v70-c1-2`.

## Backend verification
- `platform_admin_update_tax_rule` is SECURITY INVOKER at the public boundary and authenticated-only.
- Private implementation requires an active platform admin and rejects non-draft rules with `TAX_RULE_IMMUTABLE_AFTER_PUBLISH`.
- Active-rule immutability rehearsal passed.
- Temporary C1.2 tax test rules retained: 0.
- `custom_reports`: anon privileges = 0; authenticated privileges limited to SELECT/INSERT/UPDATE/DELETE under existing RLS.
- Authenticated inventory report rehearsal after hardening returned 5 inventory item rows for a member workspace.

## Frontend regression coverage
- Lifecycle unit test covers core surface replacement while an async handler is running.
- Persian localization unit test covers the exact health, logo-helper, e-invoice, and mixed-language audit strings reported in Live testing.
- Production root runtime is unchanged.
