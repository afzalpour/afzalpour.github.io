# Stock Hunter — Regime-Aware Adaptive Model Report

Date: 2026-09-16

## Scope

This stage extends the earlier six-window model-affinity study to 18 minimally overlapping point-in-time anchors per symbol: 20, 40, ..., 360 trading sessions back. Forecast horizon remains 10 sessions.

Symbols: عیار، وبملت، فولاد، خودرو، دعبید، شپنا، کگل، اخابر، حکشتی، شستا.
Models: Ichimoku, Gann, Bollinger, MACD, OBV.

Raw cases: 180. Clean cases after corporate-action exclusion: 176.

Point-in-time market regimes were detected without future information:
- صعودی: 51
- نزولی: 22
- رنج/خنثی: 40
- پرنوسان: 63

Regime logic uses current/trailing realized volatility, EMA20/EMA60, and trailing 20-session momentum. No future return is used to classify the regime.

## Global 176-case results

| Model | Mean APE | Median APE | Direction accuracy | Winner count | Beat baseline |
|---|---:|---:|---:|---:|---:|
| Ichimoku | 12.3164% | 10.2920% | 49.43% | 34 | 59/176 |
| Gann | 9.3295% | 8.2853% | 47.16% | 23 | 77/176 |
| Bollinger | **8.3303%** | **6.7880%** | 36.93% | **71** | **87/176** |
| MACD | 9.5010% | 8.2417% | **54.55%** | 32 | 79/176 |
| OBV | 9.3063% | 8.2063% | 42.61% | 16 | 75/176 |
| No-change Baseline | **8.1479%** | 6.8875% | — | — | — |
| Median of five | 9.2329% | — | — | — | — |

Bollinger is the strongest of the five models for point-price APE, but the no-change baseline still has a lower global mean APE. Therefore none of these five models should yet be promoted to a standalone primary price predictor.

## Regime-level conclusions

### Range / neutral
n=40. Baseline mean APE = 6.3433%. No model beats the baseline globally. OBV and Gann are the closest.

### Bullish
n=51. Baseline = 7.0088%; Bollinger = 7.0682%, almost tied but slightly worse. MACD has the strongest directional accuracy in this regime (60.78%).

### Bearish
n=22. Baseline = 10.7578%; Bollinger = **10.2942%**, with 13/22 baseline beats. This is one of the few regimes where one model has a small global mean-price edge. MACD has the best direction accuracy (63.64%).

### High volatility
n=63. Baseline = 9.3043%; Bollinger = 9.5011%. No model beats the baseline globally on mean point-price error.

## Symbol-level 18-window descriptive affinity

| Symbol | Best model among five | Mean APE | Runner-up | Notes |
|---|---|---:|---|---|
| عیار | Bollinger | 6.7957% | OBV | Better among models, but not a permanent routing rule |
| وبملت | Bollinger | 8.8464% | MACD | regime dependence becomes important |
| فولاد | Bollinger | 6.9460% | Gann | relative-best only; baseline remains hard to beat |
| خودرو | Bollinger | 9.1881% | MACD | earlier OBV affinity did not persist over longer history |
| دعبید | Bollinger | 6.9206% | MACD | strong regime-specific behavior |
| شپنا | Gann | 10.3224% | OBV | overall winner unstable; high-vol regime is more informative |
| کگل | Bollinger | 8.4988% | MACD | bearish regime is the interesting cell |
| اخابر | Bollinger | 7.8832% | OBV | strongest evidence is adaptive rather than one permanent model |
| حکشتی | Bollinger | 8.7141% | MACD | bullish regime materially changes result |
| شستا | Gann | 8.0284% | Bollinger | bullish regime favors Gann/MACD pair |

The expansion from six to eighteen windows changed several apparent affinities. This is direct evidence that permanent one-symbol/one-model assignment is vulnerable to overfitting.

## Walk-forward adaptive selection

A strict point-in-time selector was tested. For every evaluation date, a prior forecast was eligible for training only if its target date had already occurred before the current anchor date. Thus future outcomes could not leak into model selection.

Out-of-sample adaptive cases: 136.

| Method | Mean APE | Median APE | Direction accuracy | Beat baseline |
|---|---:|---:|---:|---:|
| Adaptive hard selector | 9.1074% | 8.1777% | 38.24% | 49.26% |
| Adaptive weighted ensemble | **8.9092%** | 8.1308% | **52.94%** | 47.79% |
| Baseline-aware gate | **8.8563%** | — | — | — |
| No-change baseline | **8.3257%** | — | — | — |
| Median of five | 9.1765% | — | — | — |

The adaptive ensemble materially improves direction accuracy relative to hard selection, but still does not beat the no-change baseline globally on mean point-price APE. The baseline-aware gate correctly abstains frequently; it used a forecasting model in only about 30.9% of OOS cases.

Strongest OOS symbol observations:
- اخابر: adaptive ensemble mean APE 6.4694% vs baseline 8.9097%; direction accuracy 71.43%; beat-baseline rate 71.43%.
- شپنا: adaptive ensemble mean APE 10.5951% vs baseline 11.6939%; direction accuracy 71.43%; beat-baseline rate 71.43%.
- عیار: the baseline-aware gate effectively abstained rather than forcing a weak model, illustrating that “no model edge” is a valid output.

## Symbol × regime model affinity

The key finding is that model skill is conditional on both the symbol and the contemporaneous regime.

### Strong descriptive cells

| Symbol | Regime | Preferred model | n | Model mean APE | Baseline mean APE | Edge vs baseline | Beats baseline |
|---|---|---|---:|---:|---:|---:|---:|
| وبملت | پرنوسان | Bollinger | 8 | **7.0069%** | 7.8473% | **+10.71%** | 6/8 |
| خودرو | رنج/خنثی | MACD | 7 | **6.4691%** | 8.3233% | **+22.28%** | 5/7 |
| دعبید | رنج/خنثی | OBV | 5 | **1.4957%** | 3.7755% | **+60.38%** | 3/5 |
| حکشتی | صعودی | Bollinger | 6 | **2.6639%** | 3.1146% | **+14.47%** | 4/6 |

These are descriptive research signals, not production rules. Sample sizes remain small, and close competitors must be retained when differences are marginal.

### Medium / noteworthy cells

- عیار × صعودی → Bollinger: n=9; 5.1854% vs baseline 5.2711%; only a very small edge. No support for a permanent `عیار = Ichimoku` rule.
- شپنا × پرنوسان → Ichimoku/Gann pair: Ichimoku 8.5890% vs baseline 11.1878%, with 83.33% directional accuracy; Gann is nearly tied on mean APE and beats baseline more often. This favors an ensemble/pair, not hard routing.
- کگل × نزولی → Bollinger: n=4; 7.0129% vs baseline 9.8589%; 4/4 baseline beats, but sample too small for a strong label.
- اخابر × رنج/خنثی → OBV/Gann near-tie; both materially better than baseline in this small cell.
- اخابر × صعودی → Bollinger; اخابر × نزولی → Bollinger; اخابر × پرنوسان → Gann/OBV near-tie. This is a strong example of regime-dependent routing rather than one permanent model.
- شستا × صعودی → Gann/MACD pair; Gann has marginally better price APE, while MACD has very strong direction accuracy.
- دعبید × پرنوسان → Bollinger shows a moderate edge.

### Important negative result: فولاد

Bollinger is the relative best of the five models for فولاد overall, but in none of the four regimes does its mean APE clearly beat the no-change baseline. Therefore `فولاد = Bollinger` should **not** be operationalized as a permanent rule.

## Scientific interpretation

The evidence supports:

`model skill = f(symbol, market regime, objective, sample size)`

It does not support:

`one symbol = one permanent model`

The production architecture should therefore eventually use conditional skill priors with shrinkage:

`global skill + asset/sector skill + regime skill + symbol skill + symbol×regime skill`

Small-sample symbol/regime estimates must be shrunk toward sector/global evidence. If no model has a validated edge, the correct system output is abstention / no-confidence rather than forced selection.

## Most important methodological conclusion

The no-change baseline remains extremely hard to beat for a 10-session exact price forecast. Therefore exact future price should not be the main optimization target of Stock Hunter.

The next research stage should switch to the trading decision itself:

**“If entry occurs now, is Target 1 reached before Stop Loss within the defined horizon?”**

This should be evaluated with Triple-Barrier-style labels (target / stop / timeout), using only point-in-time data and purged walk-forward validation. The five technical models should be treated as expert features/signals rather than five competing final price forecasts.

Only after sufficient out-of-sample decision labels exist should a calibrated probability of success be exposed in the production UI.

## Production status

No production routing weights, UI decision logic, or symbol-specific hard-coded model assignments were changed as a result of this research stage. All changes remain in the research layer pending stronger out-of-sample validation.
