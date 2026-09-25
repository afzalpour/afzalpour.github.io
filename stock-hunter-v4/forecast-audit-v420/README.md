# Stock Hunter Forecast Audit v4.2.0

Purpose: point-in-time, no-lookahead validation of the five numeric scenarios shown by Stock Hunter:

- Ichimoku
- Gann
- Bollinger
- MACD/EMA
- OBV volume-price

The equations are a direct Go port of the current `app-forecast.js` formulas. Frozen Hunt `4.1.6-hunt-v2` is not changed.

## Default Shpaksa audit

For one-click use, run `RUN_SHPAKSA_BACKTEST.cmd`. The Windows build defaults to:

- symbol: `شپاکسا`
- TSETMC instrument code: `11622051128546106`
- anchor: `20260921` = 1405/06/30
- requested target: `20260924` = 1405/07/02

1405/07/02 is Thursday and therefore has no normal Tehran equity trading candle. The default target policy is `previous`, so the audit explicitly reports the date as non-trading and compares against the previous real session.

## Metrics

- `APE%`: absolute percentage error of model center vs actual close.
- `IN_RANGE`: actual close fell inside the model interval.
- `DIR_OK`: model direction matched actual direction using the research +/-0.5% neutral band.
- `baseline_APE`: no-change forecast error.

## Point-in-time rules

- Fetch depth matches the production UI: 120 TSETMC daily candles.
- Forecast training data is truncated at the anchor date.
- Future candles are never passed into forecast equations.
- Tests include explicit lookahead-invariance coverage.
- Corporate-action discontinuities are flagged.

## Usage

Default:

`Stock_Hunter_Forecast_Audit_v4.2.0.exe`

Another symbol:

`Stock_Hunter_Forecast_Audit_v4.2.0.exe --symbol فولاد --ins 46348559193224090 --anchor 20260921 --target 20260923`

Require exact target trading date:

`--target-policy exact`

Use first session after a non-trading target:

`--target-policy next`

Self-test:

`Stock_Hunter_Forecast_Audit_v4.2.0.exe --self-test`

The tool writes a JSON evidence file in the working directory. The runner keeps the console window open so the result can be copied.
