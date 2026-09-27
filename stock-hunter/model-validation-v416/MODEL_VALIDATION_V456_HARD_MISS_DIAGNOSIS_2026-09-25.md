# Stock Hunter Model Validation v4.5.6 — Hard-Miss Diagnosis Repair

Date: 2026-09-25
Engine: `4.1.6-hunt-v2`
Historical diagnostic day: `2026-09-23`

## Evidence from the real v4.5.5 JSON

- eligible 948
- BestLimits 948
- TradeParsed 684
- temporal-reliable 114
- temporal-unreliable 570
- ground-truth labels 1316
- 35 phase-consistent Hard-Miss symbol/objective findings

Full-file analysis of the 684 parsed symbols found:
- `grouped=true`: 644 symbols, only 75 temporal-reliable; median volume coverage ~0.682
- `grouped=false`: 40 symbols, 39 temporal-reliable; median volume coverage 1.000
- among the 570 temporal-unreliable symbols:
  - 558 fail only the >=98% volume gate,
  - 11 fail volume plus OHLC/last agreement,
  - 1 fails only OHLC/last agreement.
- 569/570 unreliable cases use `grouped=true`.

This means the dominant G1 failure is historical evidence completeness, not a demonstrated Hunt-formula failure.

## Asset-universe defect found in v4.5.5 diagnostic

The exact recovered Eco v4.0.8 classifier labels any symbol beginning with `ض` as `اختیار معامله`.
Frozen Hunt excludes option instruments.

17 of the 35 phase-consistent Hard-Miss findings begin with `ض`, so v4.5.5 incorrectly counted them against Hunt because its early eligibility predicate did not carry the recovered Eco label into the model-quality universe.

## v4.5.6 repair

- applies recovered Eco v4.0.8 asset labels before model-quality scoring and ground-truth counting;
- excludes options/debt/fixed-income instruments consistently with Frozen Hunt;
- adds persistent Hard-Miss diagnostics for the remaining eligible findings;
- for each persistent miss reports the best optimistic pre-cross envelope and dominant blocker:
  - SCORE_LT_58
  - TODAY_LT_64
  - EVIDENCE/DYNAMIC_EVIDENCE
  - FEASIBILITY
  - RISK
  - DYNAMIC_NOT_READY
  - other hard gate/conjunction.
- does not change any Frozen Hunt formula, weight, threshold, objective or production routing;
- does not download TradeHistory or BestLimits.

Package SHA-256:
`6b6bb4850ecbe9a3c1d802435783d534e2410aca3b010c7e20bfeb9fca2125f6`

Local verification:
- `go test ./...`: PASS
- Windows amd64 build: PASS
- ZIP integrity: PASS

## Scientific interpretation

Even after this repair, exact historical backtest remains impossible because PIT realFlow, integrated-view fields and some legacy feed-derived inputs are not historically proven. v4.5.6 is a gross-error / binding-gate diagnostic only.
