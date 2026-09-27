-- Stock Hunter 4.1.7 FK covering-index hardening.
-- Performance-only DDL. No row/state mutation and no lifecycle/routing behavior change.

create index if not exists stock_hunter_activation_auth_consumptions_review_idx_v417
on private.stock_hunter_activation_authorization_consumptions_v417(review_id);

create index if not exists stock_hunter_release_pin_manifest_attestation_idx_v417
on private.stock_hunter_release_pin_manifests_v417(component_attestation_id);

create index if not exists stock_hunter_release_pin_manifest_proposal_idx_v417
on private.stock_hunter_release_pin_manifests_v417(proposal_id);

create index if not exists stock_hunter_release_pin_manifest_review_idx_v417
on private.stock_hunter_release_pin_manifests_v417(activation_review_id);
