# Stock Hunter — Integrated v4.1.0 Provenance Recovery Audit

Date: 2026-09-24  
Status: ECO LABEL RECOVERED / INTEGRATED SQL STILL FAIL-CLOSED  
Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

## Purpose

Recover the exact production provenance required before the cloud runtime may claim complete Frozen Hunt 4.1.6 live parity.

This audit does **not** authorize any scoring, threshold, objective, routing, lifecycle, or promotion change.

## Sources inspected

1. Git history around the original 4.1.0 integrated-engine release.
2. Current committed `app-integrated-v410.js` / methodology history.
3. Current committed `app-session-v413.js`.
4. Current parity-approved capture source / generated Frozen Hunt runtime.
5. Live Supabase Edge Function source fetched through the management plane while PostgreSQL itself remained unavailable.
6. Supabase migration metadata attempt — failed because PostgreSQL still returns `ECONNREFUSED :5432`.
7. Canonical Project Library Eco v4.0.8 ZIP/EXE artifact, recovered and reverse-audited by Go 1.23 pclntab + x86-64 assembly.

## Recovered: integrated-engine documented formulas

Git commit `7e4772bf86cc50e15c59d7369824fff609362a3e` documents the 4.1.0 methodology.

Recovered documented formulas/rules include:

### Flow expert

```text
FlowScore =
clip(
  50
  + 22 * ln(max(RealFlowRatio, 0.10))
  + 18 * OFI
  + 10 * clip(RVOL - 1, -1, 2),
  0, 100
)
```

Integrated weight: 18%.

### Trend expert

```text
TrendScore =
clip(
  0.75 * TechnicalScore / 15 * 100
  + EMAconfirm
  + VWAPconfirm
  + RSIconfirm,
  0, 100
)
```

Documented confirmations:
- EMA confirmation: +10
- VWAP confirmation: +8
- RSI in 40..72: +7

Integrated weight: 14%.

### Momentum expert

```text
MomentumScore = clip(50 + 18 * clip(Momentum, -2, 2), 0, 100)
```

Integrated weight: 8%.

### Integrated score

```text
IntegratedScore =
clip(
  0.38 * Fast
  + 0.22 * Continuation
  + 0.18 * Flow
  + 0.14 * Trend
  + 0.08 * Momentum
  - 0.28 * Risk
  + RegimeAdjustment,
  0, 100
)
```

### Documented risk gate

Blocked when any documented critical condition applies, including:
- invalid price/volume;
- `RiskScore >= 72`;
- `CancellationRatio >= 90` together with `Absorption < 12`.

The methodology also states that data older than 10 minutes downgrades the final decision to confirmation/wait behavior.

### Documented final-decision thresholds

- Strong entry: integrated score >= 67, at least 4 positive experts, risk <= 45, confidence >= 65.
- Initial entry: integrated score >= 57, at least 3 positive experts, risk <= 55, confidence >= 55.
- Wait for confirmation: integrated score >= 47 or meaningful expert disagreement or stale (>10m) data.
- Watch: score 39..47 without stronger entry conditions.
- No entry: low score or active Risk Gate.

### Documented confidence

```text
DirectionAgreement = max(PositiveExperts, NegativeExperts) / 5 * 100
Separation        = min(100, 2 * abs(IntegratedScore - 50))
Confidence        = 0.45 * DirectionAgreement
                  + 0.35 * DataQuality
                  + 0.20 * Separation
```

Confidence labels:
- >=72 high
- >=55 and <72 medium
- <55 low

## Recovered: exact session logic

Session provenance is **not missing**.

Exact browser session logic is committed in:

`app-session-v413.js`

and the frozen server/capture scorer contains the equivalent asset-session gate. The cloud generated Frozen Hunt runtime is mechanically derived from the reviewed capture source.

Therefore:

`session_logic_provenance = EXACT / RECOVERED`

Do not classify the session clock/rules as unresolved.

## Recovered: frozen Hunt consumption of integrated fields

Frozen Hunt 4.1.6 consumes integrated inputs conditionally:

- if `integratedEligible` is true, continuation combines legacy continuation + trend + flow + momentum;
- market context consumes `marketRegime` and `marketBreadth`;
- otherwise continuation falls back to the base continuation score.

Therefore silently forcing `integratedEligible=false`, zeroing integrated fields, or inventing a market regime would change the frozen scorer input and is prohibited for an exact parity claim.

## Still unresolved: exact SQL view implementation

The authoritative 4.1.0 UI explicitly states that integrated fields were calculated centrally by:

`public.stock_hunter_integrated_v1`

The SQL definition is not present in the located Git history.

The following exact implementation details remain unproven:
- exact `integrated_eligible` predicate;
- exact market-regime classifier thresholds;
- exact breadth population/filter and aggregation;
- exact `RegimeAdjustment` mapping;
- exact `DataQuality` formula;
- any SQL rounding / NULL / fallback semantics;
- exact gate ordering/string semantics;
- exact final decision implementation details beyond the documented methodology.

The methodology is strong reconstruction evidence, but it is **not a substitute for the original SQL definition** when claiming exact production parity.

Required recovery target:

```sql
select pg_get_viewdef(
  'public.stock_hunter_integrated_v1'::regclass,
  true
);
```

plus definitions of any dependent functions/views.

## Recovered: exact Eco v4.0.8 asset_type / market label derivation

The canonical Library artifact was recovered:

- ZIP SHA-256: `0d6ed1bbd11398f79a4568acd4d4f6f920d1f7fb985382a938be5408654c1139`
- EXE SHA-256: `0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`

The stripped PE retains Go 1.23 pclntab. Exact function ranges and the inlined market switch were recovered from the executable.

Source-equivalent port:

`recovered-eco-labels-v408.ts`

The classifier uses raw `symbol`, `company_name`, `yval`, and `flow`. The Iran collector now includes the already-parsed raw `yval` string in its signed payload.

Detailed binary audit:

`ECO_V408_LABEL_CLASSIFIER_BINARY_RECOVERY_AUDIT_2026-09-24.md`

Therefore:

`asset_type_market_derivation_provenance_unresolved`

is closed.

## Fail-closed conclusion

Cloud base signal features remain valid engineering/staging output.

Full live Frozen Hunt input readiness remains:

`false`

with blocker:
1. `integrated_view_provenance_unresolved`

No production cloud scoring/cutover may remove these blockers based only on inference.

## Next legitimate recovery paths

1. Infrastructure recovery of Supabase long enough to extract the exact integrated view/dependency definitions.
2. Search any retained migration/export evidence for the authoritative integrated SQL while Supabase remains unavailable.
3. If the exact integrated source cannot be recovered, a separately versioned reconstructed/challenger integrated layer may be built and validated, but it must never be silently labelled Frozen 4.1.6 parity.
