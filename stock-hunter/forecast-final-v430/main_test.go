package main

import "testing"

func TestEvidenceGateIsClosed(t *testing.T) {
	e := evidenceSummary()
	if e.Verdict != "NO_STATISTICALLY_CONFIRMED_EDGE" { t.Fatalf("verdict=%s", e.Verdict) }
	if e.CleanCases != 70 || e.ForecastableCleanCases != 68 || e.IndependentAnchorWindows != 3 {
		t.Fatalf("unexpected evidence counts: %+v", e)
	}
	if e.BestIndividualAdjustedP <= 0.05 {
		t.Fatalf("gate must remain closed; adjusted p=%f", e.BestIndividualAdjustedP)
	}
	if e.LatestWindowBestModelMeanAPE <= e.LatestWindowBaselineMeanAPE {
		t.Fatalf("latest holdout unexpectedly beats baseline")
	}
}

func TestFiveModelsStillPresent(t *testing.T) {
	a := synthetic()
	fs := forecasts(a[:120])
	if len(fs) != 5 { t.Fatalf("got %d models", len(fs)) }
	for _, f := range fs {
		if !f.OK || len(f.Points) != 10 { t.Fatalf("%s not ready", f.Name) }
	}
}
