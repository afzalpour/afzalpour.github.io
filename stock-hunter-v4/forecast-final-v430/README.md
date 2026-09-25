# Stock Hunter Forecast Final v4.3.0

This is the evidence-gated final forecast build derived from the 2026-09-25 v4.2.1 batch validation.

## Evidence used

- 90 requested cases
- 88 completed
- 70 clean cases after discontinuity quarantine
- 68 clean cases with at least one model forecast
- 3 independent anchor windows
- 5 unchanged technical models: Ichimoku, Gann, Bollinger, MACD/EMA, OBV volume-price

## Final validation conclusion

No individual model has statistically confirmed superiority over the no-change baseline in the current evidence set.

The best individual mean APE is MACD/EMA at about 3.212%, but its multiple-testing-adjusted p-value remains about 0.633.

Several research ensembles improved in-sample error, but they failed the latest-window walk-forward stress test. They are therefore rejected from the final production output.

The latest anchor-window baseline mean APE was about 3.209%, while the best individual model in that holdout window was Bollinger at about 3.279%, so the holdout did not confirm an edge.

## Production-safe behavior

The five model forecasts remain visible as diagnostics.

The program emits:

- `FINAL FORECAST GATE: NO_EDGE`
- `final_forecast_enabled=false`
- evidence counts and validation verdict

It does **not** promote a combined center price or combined direction until stronger independent evidence exists.

This does not change Frozen Hunt `4.1.6-hunt-v2` and does not alter Hunt ranking, Action Now, Radar, or market-feed routing.

## Why this is final for the current evidence

Tuning a winning ensemble on these same three adjacent windows would overfit the validation set. The final build therefore preserves information while preventing an unvalidated forecast from being presented as reliable.
