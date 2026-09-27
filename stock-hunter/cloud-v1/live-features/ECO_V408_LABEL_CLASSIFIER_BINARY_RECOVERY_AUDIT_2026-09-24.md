# Stock Hunter Eco v4.0.8 Label Classifier Binary Recovery Audit

Date: 2026-09-24  
Status: EXACT ARTIFACT RECOVERY / SOURCE-EQUIVALENT PORT  
Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

## Purpose

Close the previously unresolved provenance of the descriptive `asset_type` and `market` labels used by the Eco v4.0.8 full-Universe bridge.

This recovery changes no Hunt formula, threshold, Objective, routing, lifecycle, OOS, or promotion policy.

## Canonical artifact

Recovered from Project Library:

`/نرم افزار شکار سهم/Stock_Hunter_Eco_v4.0.8.zip`

Hashes:

- ZIP SHA-256: `0d6ed1bbd11398f79a4568acd4d4f6f920d1f7fb985382a938be5408654c1139`
- EXE SHA-256: `0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`

The executable reports:

- Go `1.23.2`
- module `stock_hunter_v4`
- Windows amd64
- `-trimpath=true`

These hashes match the previously recorded v4.0.8 package/executable identities.

## Recovery method

The PE symbol table is stripped, but Go 1.23 `pclntab` remains embedded in `.rdata`.

The Go 1.23 pcHeader was located at file offset `0x3f97e0` and parsed using the current runtime layout:

- magic `0xfffffff1`
- `nfunc=6335`
- text start `0x401000`

Recovered function ranges:

- `main.inferAssetType`: `0x6b7660..0x6b7920`
- `main.assetTypeFromYVal`: `0x6b8e60..0x6b8fa0`
- `main.(*EcoApp).fetchFullUniverse`: `0x6b7f60..0x6b8e60`

The market mapping is inlined inside `fetchFullUniverse`, around `0x6b8913..0x6b898a`.

String constants and branches were decoded directly from the canonical executable.

## Exact recovered asset type rules

### YVal fallback

After `strings.TrimSpace`:

- `300` -> `سهام`
- `301` -> `حق تقدم`
- `303`, `305`, `306` -> `صندوق`
- `400`, `403`, `404` -> `اوراق بدهی`
- otherwise -> empty fallback

### inferAssetType

The caller passes already-trimmed symbol/company values and the YVal fallback.

The function creates:

`symbol + " " + company_name`

then replaces every U+200C ZWNJ with a normal space.

Decision order:

1. text contains `اختیار` OR symbol starts with `ض` -> `اختیار معامله`
2. symbol starts with one of `اخزا`, `اراد`, `گام`, `افاد`, `تسه` -> `اوراق بدهی`
3. text contains `درآمد ثابت` or `درآمدثابت` -> `صندوق درآمد ثابت`
4. text contains `صندوق` -> `صندوق`
5. non-empty YVal fallback -> fallback
6. otherwise -> `سهام`

## Exact recovered market rules

The Eco bridge derives `market` from raw TSETMC `flow`:

- `1` -> `بورس`
- `2` -> `فرابورس`
- `4` -> `بازار پایه`
- `6` -> `بورس کالا`
- `7` -> `بورس انرژی`
- otherwise -> `بازار سرمایه`

## Cloud consequence

The Iran collector already parses raw `yval`, but v1 payload serialization omitted it. This recovery adds `yval` to the signed point-in-time payload.

Cloud label derivation is now performed deterministically from:

- `symbol`
- `company_name`
- `yval`
- `flow`

The old externally supplied `asset_type` / `market` labels are no longer required for provenance.

Therefore:

`asset_type_market_derivation_provenance_unresolved`

is closed.

The remaining full Frozen Hunt live-input blocker is still:

`integrated_view_provenance_unresolved`

because the authoritative SQL/dependencies of `public.stock_hunter_integrated_v1` have not yet been recovered.

## Safety

- Production `index.html` is not switched by this recovery.
- `frozen_hunt_input_ready` remains `false`.
- Frozen Hunt 4.1.6 is unchanged.
- No inferred integrated field is fabricated or defaulted.
