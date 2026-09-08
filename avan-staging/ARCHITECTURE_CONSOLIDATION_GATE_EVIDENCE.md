# AC-1 — Frontend Architecture Consolidation Gate Evidence

Status: **ENGINEERING PASS / STAGING READY**  
Date: **2026-09-08**  
Governing ADR: `docs/adr/0016-modular-runtime-no-monkey-patching.md`

## Objective

Reduce patch-on-patch runtime coupling without a risky rewrite. The migration follows the existing Strangler Pattern in `docs/architecture/AVAN_MIGRATION_MAP_V1.md`.

## Runtime composition

Added:
- `src/core/runtime/operation-pipeline.js`

Properties:
- named middleware ids;
- deterministic priority/order;
- single-call `next()` guard;
- inspectable attachment/snapshot state;
- raw/base operation access for controlled compatibility fallbacks;
- migration mode remains compatible with legacy modules while new direct overwrites are blocked by CI policy.

Migrated direct client extensions include:
- Company/workspace projection in `src/infrastructure/supabase/avan-cloud-bootstrap.js`;
- `rc11-user-preferences.js`;
- `rc14-invoice-inventory-ui.js`;
- `rc14-purchase-receipt-and-inventory-polish.js`;
- RC1.5 Tax bridge.

## UI lifecycle consolidation

Added:
- `src/ui/runtime/lifecycle.js`

Purpose:
- provide a transitional central DOM lifecycle for page/modal/form enhancement;
- reduce one-off body-wide observer patterns;
- give new modules an explicit shared integration point.

Legacy observers are not deleted blindly. They are migrated feature-by-feature only when behavior is covered by tests/regression evidence.

## Pure/domain extraction

Added:
- `src/domains/tax/vat-calculator.js`
- `src/application/tax/tax-service.js`
- `src/ui/tax/tax-workspace.js`

VAT arithmetic is now testable independently of DOM/Supabase.

## Automated quality gate

Added:
- `avan-staging/package.json`
- `tests/operation-pipeline.spec.mjs`
- `tests/vat-calculator.spec.mjs`
- `scripts/architecture-audit.mjs`
- `.github/workflows/avan-frontend-architecture.yml`

Latest successful workflow run:
- run `34184751258`
- job `quality` = `success`

Checks passed:
- JavaScript syntax for new core and migrated compatibility modules;
- Operation Pipeline unit test;
- VAT calculator unit test;
- Architecture audit.

## Audit baseline after consolidation

- `app.js`: 108,245 bytes.
- `index.html`: 7,872 bytes.
- Direct client method overwrites: `1` total.
- Explicitly quarantined legacy overwrites: `1`.
- Unauthorized direct client overwrites: **`0`**.
- MutationObserver occurrences: `32`.
- Body-wide observers: `9`.

The sole direct overwrite is in:
- `rc14-catalog-settlement-v60.js`

It is intentionally quarantined as an exact-count allowlist entry because an attempted mechanical rewrite of this large financial compatibility module produced a Syntax failure that CI correctly blocked. The file was restored byte-for-byte from the known-good RC1.5-C branch before proceeding.

The quarantine is not permission for further patching:
- any new direct `C.rpc/select/insert/update/remove` overwrite fails the Architecture Gate;
- if the settlement file gains another overwrite, the exact-count allowlist also fails;
- the settlement bridge will be migrated during the integrated Tax + Settlement work, where final-total/VAT semantics can be regression-tested together.

## PWA / Service Worker

Staging Service Worker was advanced to the next cache generation and includes the new architecture/tax module assets. Production Service Worker/root remains untouched until Live Gate and promotion.

## Production safety

- No Production root frontend file was changed by this gate.
- No financial data migration was performed by the architecture refactor.
- Ledger/RLS/Company boundary/Posted immutability remain unchanged.
- Backend performance hardening was additive/index-only plus removal of a semantically duplicate SELECT policy.

## Gate conclusion

AC-1 is **Engineering PASS**.

The architecture is not declared fully migrated: remaining legacy observers and the single quarantined settlement bridge are measurable debt with explicit future removal gates. New development must use the modular runtime contract and may not add new monkey patches.
