'use strict';

// Stock Hunter Forecast Validation Gate v4.3.0
// Evidence remains available programmatically for audit/calibration surfaces.
// Per product UI policy, this evidence is not injected into end-user symbol details.
(function(){
  const evidence=Object.freeze({
    version:'4.3.0-forecast-final-gated',
    calibration:'v4.2.1-90case-20260925',
    requestedCases:90,
    completedCases:88,
    cleanCases:70,
    forecastableCleanCases:68,
    independentAnchorWindows:3,
    bestIndividualModel:'MACD/EMA',
    bestIndividualMeanAPE:3.2116352378331805,
    bestIndividualAdjustedP:0.6329742731731625,
    latestWindowBaselineMeanAPE:3.208835186716304,
    latestWindowBestModel:'Bollinger',
    latestWindowBestModelMeanAPE:3.278945,
    verdict:'NO_STATISTICALLY_CONFIRMED_EDGE',
    finalForecastEnabled:false,
    fibonacciValidationStatus:'PENDING_INDEPENDENT_OOS'
  });
  window.STOCK_HUNTER_FORECAST_VALIDATION_V430=evidence;
})();
