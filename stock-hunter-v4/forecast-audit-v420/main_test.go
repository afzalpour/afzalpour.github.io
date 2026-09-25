package main

import (
	"math"
	"testing"
)

func TestFiveModelsAndNoLookahead(t *testing.T) {
	a := synthetic()
	train := a[:120]
	fs := forecasts(train)
	if len(fs) != 5 {
		t.Fatalf("got %d models", len(fs))
	}
	for _, f := range fs {
		if !f.OK || len(f.Points) != 10 {
			t.Fatalf("%s not ready", f.Name)
		}
	}
	base := make([]float64, 5)
	for i, f := range fs {
		base[i] = f.Points[9].Center
	}
	future := append([]Candle(nil), train...)
	future = append(future, Candle{Date: "20990101", Open: 1, High: 999999, Low: 1, Close: 999999, Volume: 9e9})
	fs2 := forecasts(future[:120])
	for i := range fs2 {
		if math.Abs(fs2[i].Points[9].Center-base[i]) > 1e-9 {
			t.Fatalf("lookahead changed %s", fs2[i].Name)
		}
	}
}

func TestTargetResolutionGap(t *testing.T) {
	a := []Candle{
		{Date: "20260921", High: 10, Low: 8, Close: 9},
		{Date: "20260922", High: 11, Low: 9, Close: 10},
		{Date: "20260923", High: 12, Low: 10, Close: 11},
		{Date: "20260926", High: 13, Low: 11, Close: 12},
	}
	i, exact, err := chooseTarget(a, "20260924", "previous")
	if err != nil || exact || i != 2 {
		t.Fatalf("i=%d exact=%v err=%v", i, exact, err)
	}
}
