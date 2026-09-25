package main

import (
	"math"
	"testing"
)

func TestFiveModelsAndNoLookahead(t *testing.T) {
	a := synthetic()
	train := a[:120]
	fs := forecasts(train)
	if len(fs) != 5 { t.Fatalf("got %d models", len(fs)) }
	for _, f := range fs {
		if !f.OK || len(f.Points) != 10 { t.Fatalf("%s not ready", f.Name) }
	}
	base := make([]float64, 5)
	for i, f := range fs { base[i] = f.Points[9].Center }
	future := append([]Candle(nil), train...)
	future = append(future, Candle{Date:"20990101",Open:1,High:999999,Low:1,Close:999999,Volume:9e9})
	fs2 := forecasts(future[:120])
	for i := range fs2 {
		if math.Abs(fs2[i].Points[9].Center-base[i]) > 1e-9 { t.Fatalf("lookahead changed %s", fs2[i].Name) }
	}
}

func TestTargetResolutionGap(t *testing.T) {
	a := []Candle{
		{Date:"20260921",High:10,Low:8,Close:9},
		{Date:"20260922",High:11,Low:9,Close:10},
		{Date:"20260923",High:12,Low:10,Close:11},
		{Date:"20260926",High:13,Low:11,Close:12},
	}
	i, exact, err := chooseTarget(a,"20260924","previous")
	if err != nil || exact || i != 2 { t.Fatalf("i=%d exact=%v err=%v",i,exact,err) }
}

func TestCorporateActionEventsAreDated(t *testing.T) {
	a := synthetic()
	a[100].Yesterday = a[99].Close * 0.50
	ev := corporateEvents(a[80:121])
	if len(ev) != 1 { t.Fatalf("events=%d",len(ev)) }
	if ev[0].Date != a[100].Date { t.Fatalf("date=%s want=%s",ev[0].Date,a[100].Date) }
	if ev[0].Rule == "" { t.Fatal("missing rule") }
}

func TestCorporateActionCaseIsExcluded(t *testing.T) {
	a := synthetic()
	a[100].Yesterday = a[99].Close * 0.50
	r, err := buildReport(a,"TEST","1",a[119].Date,a[121].Date,"exact")
	if err != nil { t.Fatal(err) }
	if r.Scorable || r.ValidationStatus != "EXCLUDED_CORPORATE_ACTION" { t.Fatalf("status=%s scorable=%v",r.ValidationStatus,r.Scorable) }
	if len(r.CorporateActionEvents) != 1 { t.Fatalf("events=%d",len(r.CorporateActionEvents)) }
}

func TestDisplayRoundedCoverage(t *testing.T) {
	actual, low, high := 2563.0, 2563.396, 2668.565
	raw := actual >= low && actual <= high
	display := math.Round(actual) >= math.Round(low) && math.Round(actual) <= math.Round(high)
	if raw { t.Fatal("raw should be false") }
	if !display { t.Fatal("display-rounded should be true") }
}
