# Stock Hunter — Multi-Window Model Affinity Report

Date: 2026-09-16

## Scope

Ten heterogeneous Iranian-market instruments were evaluated at six point-in-time anchors: 20, 40, 60, 80, 100 and 120 trading sessions back. Each forecast used only information available at the anchor and was compared with the actual closing price 10 trading sessions later.

Symbols: عیار، وبملت، فولاد، خودرو، دعبید، شپنا، کگل، اخابر، حکشتی، شستا.

Models: Ichimoku, Gann, Bollinger, MACD, OBV.

Primary numeric metric: APE = absolute percentage error of the day-10 price forecast. A no-change price forecast is used as Baseline.

Total descriptive cases: 60.
Actual direction mix: 40 bullish, 17 bearish, 3 neutral.

## Global 60-case results

| Model | Mean APE | Median APE | Direction accuracy | Winner count | Beat baseline |
|---|---:|---:|---:|---:|---:|
| Ichimoku | 14.6310% | 12.7535% | 50.00% | 11 | 21/60 |
| Gann | 11.7453% | 10.9181% | 48.33% | 5 | 22/60 |
| Bollinger | 10.0770% | 9.2728% | 41.67% | 26 | 30/60 |
| MACD | 10.9898% | 9.7595% | 56.67% | 14 | 29/60 |
| OBV | 11.3715% | 9.6797% | 38.33% | 4 | 24/60 |
| No-change Baseline | 9.8597% | 9.5643% | — | — | — |
| Median of five models | 11.5284% | 9.6797% | — | — | — |

Important: although Bollinger is the best of the five models by mean APE and winner count, the no-change Baseline still has a slightly lower global mean APE than every model.

## Descriptive symbol-model affinity

| Symbol | Descriptive best model | Mean APE | Runner-up | Advantage vs runner-up | Wins | Beats baseline | Affinity label |
|---|---|---:|---|---:|---:|---:|---|
| عیار | Bollinger | 9.4729% | MACD | 9.31% | 2/6 | 2/6 | weak/unclear |
| وبملت | Bollinger | 8.4675% | MACD | 9.07% | 3/6 | 5/6 | medium |
| فولاد | Bollinger | 7.3525% | Gann | 25.32% | 4/6 | 2/6 | weak/unclear |
| خودرو | OBV | 4.5598% | Gann | 13.23% | 2/6 | 4/6 | medium |
| دعبید | MACD | 10.0576% | Bollinger | 3.92% | 2/6 | 3/6 | weak/unclear |
| شپنا | MACD | 10.3839% | OBV | 14.26% | 2/6 | 4/6 | medium |
| کگل | Bollinger | 10.7278% | MACD | 19.36% | 3/6 | 2/6 | weak/unclear |
| اخابر | MACD | 9.3608% | Bollinger | 10.74% | 3/6 | 4/6 | strong descriptive |
| حکشتی | Bollinger | 12.3613% | MACD | 7.06% | 4/6 | 4/6 | medium |
| شستا | Gann | 10.1362% | OBV | 2.32% | 1/6 | 3/6 | weak/unclear |

The affinity labels above are descriptive only. Six partially overlapping windows are not sufficient statistical proof.

### Important counterexample: عیار

The earlier single-window result suggested Ichimoku might fit عیار. Across six windows, that did not persist. Ichimoku mean APE for عیار was 15.7884%, with only 1/6 wins and 2/6 baseline beats. Bollinger had the lowest six-window mean APE at 9.4729%, but even that relationship was classified weak/unclear.

### Important nuance: فولاد

Bollinger was clearly the best of the five models for فولاد by six-window mean APE (7.3525%) and won 4/6 windows. However, it beat the no-change baseline only 2/6 times. Therefore this is evidence of relative superiority among the five models, not evidence that Bollinger is yet a reliable absolute forecasting model for فولاد.

## Walk-forward personalization test

To avoid hindsight bias, model selection was then tested prospectively. For each symbol, windows were ordered oldest to newest. After a minimum of two historical windows, the model with the lowest historical mean APE for that symbol was selected and evaluated on the next unseen window. No future window was allowed to influence selection.

Total out-of-sample personalized cases: 40.

| Metric | Result |
|---|---:|
| Personalized selector mean APE | 11.2717% |
| Personalized selector median APE | 10.0849% |
| No-change baseline mean APE | 9.8806% |
| Median-of-five mean APE | 12.4106% |
| Personalized selector beat-baseline rate | 45.0% |
| Chosen model matched the actual best model | 27.5% |

Conclusion: a naive hard assignment based only on each symbol's prior average model error did **not** beat the no-change baseline out of sample.

## Walk-forward result by symbol

| Symbol | Personalized mean APE | Baseline mean APE | Beat baseline | Selected-model sequence | Interpretation |
|---|---:|---:|---:|---|---|
| عیار | 9.3013% | 6.5792% | 2/4 | MACD → MACD → MACD → Bollinger | not confirmed |
| وبملت | 10.1459% | 8.9641% | 2/4 | MACD → MACD → Bollinger → Bollinger | not confirmed |
| فولاد | 9.4946% | 8.0239% | 2/4 | Bollinger → Gann → Bollinger → Bollinger | not confirmed |
| خودرو | 5.0050% | 5.9339% | 2/4 | OBV → OBV → OBV → OBV | promising persistent candidate |
| دعبید | 11.2602% | 10.1365% | 1/4 | MACD → MACD → MACD → MACD | not confirmed |
| شپنا | 9.4338% | 11.2695% | 3/4 | Bollinger → Bollinger → MACD → MACD | promising adaptive candidate |
| کگل | 14.1622% | 10.9375% | 1/4 | MACD → Bollinger → Bollinger → Bollinger | not confirmed |
| اخابر | 11.6348% | 11.5024% | 2/4 | MACD → MACD → MACD → MACD | descriptive affinity did not confirm OOS |
| حکشتی | 17.7479% | 14.2445% | 1/4 | Bollinger → MACD → Bollinger → MACD | not confirmed |
| شستا | 14.5309% | 11.2142% | 2/4 | Bollinger → Bollinger → OBV → Gann | not confirmed |

## Interpretation

The data supports the existence of symbol/model heterogeneity, but does not support hard-coded permanent routing such as `عیار = Ichimoku` or `فولاد = Bollinger` at this stage.

The more defensible architecture is conditional model skill:

`weight(model) = global skill + asset/sector skill + symbol rolling OOS skill + market-regime skill + data-quality adjustment`

A model should receive extra weight for a symbol only after it repeatedly beats the baseline in independent out-of-sample windows and across more than one market regime.

Current promising research candidates are خودرو↔OBV and شپنا↔adaptive Bollinger/MACD. They are not yet strong enough for production hard-coding.

## Recommended next test

Expand to at least 12–18 non-overlapping or minimally overlapping anchors per symbol, ideally extending to 240–360 sessions where history permits. Stratify results by regime (bullish, bearish, range, high-volatility). Evaluate rolling OOS skill and shrink symbol-specific skill toward sector/global skill when sample size is small.
