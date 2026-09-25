package main

import (
	"testing"
	"time"
)

func TestMarketWindow(t *testing.T) {
	tests := []struct {
		name string
		t    time.Time
		want bool
	}{
		{"Saturday open", time.Date(2026, 9, 26, 9, 0, 0, 0, tehran), true},
		{"Friday closed", time.Date(2026, 9, 25, 9, 0, 0, 0, tehran), false},
		{"before", time.Date(2026, 9, 26, 8, 19, 0, 0, 0, tehran), false},
		{"start", time.Date(2026, 9, 26, 8, 20, 0, 0, 0, tehran), true},
		{"end", time.Date(2026, 9, 26, 17, 5, 0, 0, 0, tehran), true},
		{"after", time.Date(2026, 9, 26, 17, 6, 0, 0, 0, tehran), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isMarketWindow(tt.t); got != tt.want {
				t.Fatalf("got %v want %v", got, tt.want)
			}
		})
	}
}
