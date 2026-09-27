package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

const version = "4.2.0-forecast-audit"
const historyDepth = 120
const defaultSymbol = "شپاکسا"
const defaultIns = "11622051128546106"
const defaultAnchor = "20260921" // 1405/06/30
const defaultTarget = "20260924" // 1405/07/02 (Thu; non-trading)

type apiResponse struct {
	ClosingPriceDaily []apiCandle `json:"closingPriceDaily"`
}

type apiCandle struct {
	DEven          int64   `json:"dEven"`
	PriceFirst     float64 `json:"priceFirst"`
	PriceMax       float64 `json:"priceMax"`
	PriceMin       float64 `json:"priceMin"`
	PClosing       float64 `json:"pClosing"`
	PDrCotVal      float64 `json:"pDrCotVal"`
	QTotTran5J     float64 `json:"qTotTran5J"`
	PriceYesterday float64 `json:"priceYesterday"`
}

type Candle struct {
	Date      string  `json:"date"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	Yesterday float64 `json:"yesterday"`
}

type Point struct {
	Horizon int     `json:"horizon"`
	Center  float64 `json:"center"`
	Low     float64 `json:"low"`
	High    float64 `json:"high"`
}

type Forecast struct {
	Key       string  `json:"key"`
	Name      string  `json:"name"`
	OK        bool    `json:"ok"`
	Direction string  `json:"direction,omitempty"`
	Points    []Point `json:"points,omitempty"`
	Detail    string  `json:"detail,omitempty"`
}

type Evaluation struct {
	Model           string  `json:"model"`
	Direction       string  `json:"direction"`
	Center          float64 `json:"center"`
	Low             float64 `json:"low"`
	High            float64 `json:"high"`
	Actual          float64 `json:"actual"`
	APEPct          float64 `json:"ape_pct"`
	RangeCovered    bool    `json:"range_covered"`
	ActualDirection string  `json:"actual_direction"`
	DirectionOK     bool    `json:"direction_ok"`
}

type Report struct {
	Version             string       `json:"version"`
	Symbol              string       `json:"symbol"`
	InsCode             string       `json:"ins_code"`
	Source              string       `json:"source"`
	AnchorDate          string       `json:"anchor_date"`
	AnchorClose         float64      `json:"anchor_close"`
	RequestedTargetDate string       `json:"requested_target_date"`
	TargetTradingDate   string       `json:"target_trading_date"`
	TargetWasTradingDay bool         `json:"target_was_trading_day"`
	TargetPolicy        string       `json:"target_policy"`
	HorizonSessions     int          `json:"horizon_sessions"`
	ActualClose         float64      `json:"actual_close"`
	BaselineAPEPct      float64      `json:"baseline_ape_pct"`
	ActualDirection     string       `json:"actual_direction"`
	TrainingCandles     int          `json:"training_candles"`
	CorporateActionWarn bool         `json:"corporate_action_warning"`
	Evaluations         []Evaluation `json:"evaluations"`
	GeneratedAt         string       `json:"generated_at"`
}

func clamp(v, a, b float64) float64 { return math.Max(a, math.Min(b, v)) }

func avg(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	s := 0.0
	for _, x := range v {
		s += x
	}
	return s / float64(len(v))
}

func stdev(v []float64) float64 {
	if len(v) < 2 {
		return 0
	}
	m := avg(v)
	s := 0.0
	for _, x := range v {
		d := x - m
		s += d * d
	}
	return math.Sqrt(s / float64(len(v)))
}

func linSlope(v []float64) float64 {
	n := len(v)
	if n < 2 {
		return 0
	}
	sx, sy, sxy, sxx := 0.0, 0.0, 0.0, 0.0
	for i, y := range v {
		x := float64(i)
		sx += x
		sy += y
		sxy += x * y
		sxx += x * x
	}
	den := float64(n)*sxx - sx*sx
	if den == 0 {
		return 0
	}
	return (float64(n)*sxy - sx*sy) / den
}

func emaSeries(v []float64, n int) []float64 {
	if len(v) == 0 {
		return nil
	}
	k := 2.0 / float64(n+1)
	out := make([]float64, len(v))
	out[0] = v[0]
	for i := 1; i < len(v); i++ {
		out[i] = v[i]*k + out[i-1]*(1-k)
	}
	return out
}

func midHL(a []Candle, p int) float64 {
	s := a[len(a)-p:]
	hi, lo := s[0].High, s[0].Low
	for _, z := range s[1:] {
		if z.High > hi {
			hi = z.High
		}
		if z.Low < lo {
			lo = z.Low
		}
	}
	return (hi + lo) / 2
}

func atr(a []Candle, p int) float64 {
	if len(a) < p+1 {
		return 0
	}
	sum := 0.0
	for i := len(a) - p; i < len(a); i++ {
		q := a[i]
		prev := a[i-1].Close
		tr := math.Max(q.High-q.Low, math.Max(math.Abs(q.High-prev), math.Abs(q.Low-prev)))
		sum += tr
	}
	return sum / float64(p)
}

func points(p, drift, bandBase float64, bandFn func(int) float64) []Point {
	out := make([]Point, 10)
	for i := 0; i < 10; i++ {
		d := i + 1
		center := math.Max(1, p+drift*float64(d))
		band := bandBase * bandFn(d)
		out[i] = Point{d, center, math.Max(1, center-band), center + band}
	}
	return out
}

func fcIchimoku(a []Candle) Forecast {
	f := Forecast{Key: "ichi", Name: "Ichimoku"}
	if len(a) < 52 {
		f.Detail = "need >=52 daily candles"
		return f
	}
	ten := midHL(a, 9)
	kij := midHL(a, 26)
	sa := (ten + kij) / 2
	sb := midHL(a, 52)
	p := a[len(a)-1].Close
	top := math.Max(sa, sb)
	bot := math.Min(sa, sb)
	A := atr(a, 14)
	if A == 0 {
		A = p * .02
	}
	trend := clamp((ten-kij)/math.Max(A, 1), -2, 2)
	cloud := 0.0
	if p > top {
		cloud = .55
	} else if p < bot {
		cloud = -.55
	}
	drift := (trend*.18 + cloud*.22) * A
	dir := "خنثی"
	if drift > A*.05 {
		dir = "صعودی"
	} else if drift < -A*.05 {
		dir = "نزولی"
	}
	f.OK = true
	f.Direction = dir
	f.Points = points(p, drift, A, func(d int) float64 { return .42 * math.Sqrt(float64(d)) })
	f.Detail = fmt.Sprintf("tenkan=%.2f kijun=%.2f cloud=%.2f..%.2f atr=%.2f", ten, kij, bot, top, A)
	return f
}

func fcGann(a []Candle) Forecast {
	f := Forecast{Key: "gann", Name: "Gann"}
	if len(a) < 20 {
		f.Detail = "need >=20 daily candles"
		return f
	}
	s := a[len(a)-20:]
	H, L := s[0].High, s[0].Low
	cl := make([]float64, len(s))
	for i, z := range s {
		if z.High > H {
			H = z.High
		}
		if z.Low < L {
			L = z.Low
		}
		cl[i] = z.Close
	}
	step := (H - L) / 8
	p := a[len(a)-1].Close
	A := atr(a, 14)
	if A == 0 {
		A = p * .02
	}
	slope := clamp(linSlope(cl), -1.5*A, 1.5*A)
	levels := make([]float64, 9)
	for i := range levels {
		levels[i] = L + float64(i)*step
	}
	above := H
	for _, v := range levels {
		if v >= p {
			above = v
			break
		}
	}
	below := L
	for i := len(levels) - 1; i >= 0; i-- {
		if levels[i] <= p {
			below = levels[i]
			break
		}
	}
	target := 0.0
	if slope >= 0 {
		target = math.Min(H+step, above+step)
	} else {
		target = math.Max(math.Max(1, L-step), below-step)
	}
	dir := "خنثی"
	if slope > A*.03 {
		dir = "صعودی"
	} else if slope < -A*.03 {
		dir = "نزولی"
	}
	out := make([]Point, 10)
	for i := 0; i < 10; i++ {
		d := i + 1
		progress := float64(d) / 10
		center := math.Max(1, p+slope*.55*float64(d)+(target-p)*.45*progress)
		band := A * .38 * math.Sqrt(float64(d))
		out[i] = Point{d, center, math.Max(1, center-band), center + band}
	}
	f.OK = true
	f.Direction = dir
	f.Points = out
	f.Detail = fmt.Sprintf("range=%.2f..%.2f slope=%.4f target=%.2f atr=%.2f", L, H, slope, target, A)
	return f
}

func fcBollinger(a []Candle) Forecast {
	f := Forecast{Key: "boll", Name: "Bollinger"}
	if len(a) < 20 {
		f.Detail = "need >=20 daily candles"
		return f
	}
	s := a[len(a)-20:]
	cl := make([]float64, 20)
	for i, z := range s {
		cl[i] = z.Close
	}
	p := a[len(a)-1].Close
	m := avg(cl)
	sd := stdev(cl)
	A := atr(a, 14)
	if A == 0 {
		A = p * .02
	}
	slope := linSlope(cl[len(cl)-10:])
	z := 0.0
	if sd != 0 {
		z = (p - m) / (2 * sd)
	}
	meanRevert := -z * sd * .08
	drift := clamp(slope*.55+meanRevert, -.8*A, .8*A)
	dir := "خنثی"
	if drift > A*.04 {
		dir = "صعودی"
	} else if drift < -A*.04 {
		dir = "نزولی"
	}
	baseBand := math.Max(sd, A*.75)
	out := make([]Point, 10)
	for i := 0; i < 10; i++ {
		d := i + 1
		center := math.Max(1, p+drift*float64(d))
		band := baseBand * (.55 + .12*math.Sqrt(float64(d)))
		out[i] = Point{d, center, math.Max(1, center-band), center + band}
	}
	f.OK = true
	f.Direction = dir
	f.Points = out
	f.Detail = fmt.Sprintf("ma20=%.2f sd=%.2f slope10=%.4f atr=%.2f", m, sd, slope, A)
	return f
}

func fcMACD(a []Candle) Forecast {
	f := Forecast{Key: "macd", Name: "MACD/EMA"}
	if len(a) < 35 {
		f.Detail = "need >=35 daily candles"
		return f
	}
	cl := make([]float64, len(a))
	for i, z := range a {
		cl[i] = z.Close
	}
	e12 := emaSeries(cl, 12)
	e26 := emaSeries(cl, 26)
	macd := make([]float64, len(cl))
	for i := range cl {
		macd[i] = e12[i] - e26[i]
	}
	sig := emaSeries(macd, 9)
	m := macd[len(macd)-1]
	s := sig[len(sig)-1]
	hist := m - s
	p := cl[len(cl)-1]
	A := atr(a, 14)
	if A == 0 {
		A = p * .02
	}
	priceSlope := linSlope(cl[len(cl)-12:])
	impulse := clamp(hist/math.Max(A, 1), -1.5, 1.5) * A * .18
	drift := clamp(priceSlope*.6+impulse, -A, A)
	dir := "خنثی"
	if m > s && hist > 0 {
		dir = "صعودی"
	} else if m < s && hist < 0 {
		dir = "نزولی"
	}
	f.OK = true
	f.Direction = dir
	f.Points = points(p, drift, A, func(d int) float64 { return .36 * math.Sqrt(float64(d)) })
	f.Detail = fmt.Sprintf("macd=%.4f signal=%.4f hist=%.4f slope12=%.4f atr=%.2f", m, s, hist, priceSlope, A)
	return f
}

func fcOBV(a []Candle) Forecast {
	f := Forecast{Key: "obv", Name: "OBV volume-price"}
	if len(a) < 20 {
		f.Detail = "need >=20 daily candles"
		return f
	}
	start := 0
	if len(a) > 30 {
		start = len(a) - 30
	}
	s := a[start:]
	cl := make([]float64, len(s))
	vol := make([]float64, len(s))
	for i, z := range s {
		cl[i] = z.Close
		vol[i] = z.Volume
	}
	avStart := 0
	if len(vol) > 20 {
		avStart = len(vol) - 20
	}
	av := avg(vol[avStart:])
	if av <= 0 {
		f.Detail = "insufficient volume"
		return f
	}
	obv := make([]float64, len(s))
	for i := 1; i < len(s); i++ {
		d := s[i].Close - s[i-1].Close
		obv[i] = obv[i-1]
		if d > 0 {
			obv[i] += vol[i]
		} else if d < 0 {
			obv[i] -= vol[i]
		}
	}
	osStart := 0
	if len(obv) > 20 {
		osStart = len(obv) - 20
	}
	csStart := 0
	if len(cl) > 20 {
		csStart = len(cl) - 20
	}
	obvSlope := linSlope(obv[osStart:])
	vb := clamp(obvSlope/av, -2, 2)
	ps := linSlope(cl[csStart:])
	p := a[len(a)-1].Close
	A := atr(a, 14)
	if A == 0 {
		A = p * .02
	}
	drift := clamp(ps*.55+A*.12*vb, -.9*A, .9*A)
	dir := "خنثی"
	if vb > .15 && ps >= 0 {
		dir = "صعودی"
	} else if vb < -.15 && ps <= 0 {
		dir = "نزولی"
	}
	f.OK = true
	f.Direction = dir
	f.Points = points(p, drift, A, func(d int) float64 { return .40 * math.Sqrt(float64(d)) })
	f.Detail = fmt.Sprintf("obvSlopeNorm=%.4f priceSlope20=%.4f avgVol20=%.0f atr=%.2f", vb, ps, av, A)
	return f
}

func forecasts(a []Candle) []Forecast {
	return []Forecast{fcIchimoku(a), fcGann(a), fcBollinger(a), fcMACD(a), fcOBV(a)}
}

func fetchHistory(ins string) ([]Candle, error) {
	u := fmt.Sprintf("https://cdn.tsetmc.com/api/ClosingPrice/GetClosingPriceDailyList/%s/%d", ins, historyDepth)
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "StockHunterForecastAudit/"+version)
	req.Header.Set("Accept", "application/json,text/plain,*/*")
	c := &http.Client{Timeout: 25 * time.Second}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("TSETMC HTTP %d", resp.StatusCode)
	}
	var ar apiResponse
	if err = json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return nil, err
	}
	out := make([]Candle, 0, len(ar.ClosingPriceDaily))
	for _, z := range ar.ClosingPriceDaily {
		date := fmt.Sprintf("%08d", z.DEven)
		close := z.PClosing
		if close <= 0 {
			close = z.PDrCotVal
		}
		if len(date) == 8 && z.PriceMax > 0 && z.PriceMin > 0 && close > 0 {
			out = append(out, Candle{date, z.PriceFirst, z.PriceMax, z.PriceMin, close, z.QTotTran5J, z.PriceYesterday})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	if len(out) == 0 {
		return nil, errors.New("no valid TSETMC daily rows")
	}
	return out, nil
}

func indexDate(a []Candle, date string) int {
	for i, z := range a {
		if z.Date == date {
			return i
		}
	}
	return -1
}

func chooseTarget(a []Candle, requested, policy string) (idx int, exact bool, error error) {
	if i := indexDate(a, requested); i >= 0 {
		return i, true, nil
	}
	if policy == "exact" {
		return -1, false, fmt.Errorf("target %s is not a trading row", requested)
	}
	if policy == "previous" {
		best := -1
		for i, z := range a {
			if z.Date < requested {
				best = i
			} else {
				break
			}
		}
		if best >= 0 {
			return best, false, nil
		}
	}
	if policy == "next" {
		for i, z := range a {
			if z.Date > requested {
				return i, false, nil
			}
		}
	}
	return -1, false, fmt.Errorf("cannot resolve target %s with policy=%s", requested, policy)
}

func actualDir(anchor, actual float64) string {
	r := actual/anchor - 1
	if r > .005 {
		return "صعودی"
	}
	if r < -.005 {
		return "نزولی"
	}
	return "خنثی"
}

func corpWarn(a []Candle) bool {
	for i := 1; i < len(a); i++ {
		prev := a[i-1].Close
		py := a[i].Yesterday
		if py > 0 && prev > 0 && math.Abs(py/prev-1) > .08 {
			return true
		}
		if a[i].Open > 0 && prev > 0 && math.Abs(a[i].Open/prev-1) > .30 {
			return true
		}
	}
	return false
}

func buildReport(hist []Candle, symbol, ins, anchorDate, targetDate, policy string) (Report, error) {
	ai := indexDate(hist, anchorDate)
	if ai < 0 {
		return Report{}, fmt.Errorf("anchor %s not found in fetched %d rows", anchorDate, len(hist))
	}
	ti, exact, err := chooseTarget(hist, targetDate, policy)
	if err != nil {
		return Report{}, err
	}
	if ti <= ai {
		return Report{}, fmt.Errorf("resolved target %s must be after anchor %s", hist[ti].Date, anchorDate)
	}
	h := ti - ai
	if h > 10 {
		return Report{}, fmt.Errorf("target is %d trading sessions after anchor; current forecast horizon is 10", h)
	}
	start := 0
	if ai+1 > historyDepth {
		start = ai + 1 - historyDepth
	}
	train := append([]Candle(nil), hist[start:ai+1]...)
	anchor := hist[ai].Close
	actual := hist[ti].Close
	adir := actualDir(anchor, actual)
	ev := []Evaluation{}
	for _, f := range forecasts(train) {
		if !f.OK || len(f.Points) < h {
			continue
		}
		p := f.Points[h-1]
		ape := math.Abs(p.Center-actual) / actual * 100
		ev = append(ev, Evaluation{f.Name, f.Direction, p.Center, p.Low, p.High, actual, ape, actual >= p.Low && actual <= p.High, adir, f.Direction == adir})
	}
	return Report{Version: version, Symbol: symbol, InsCode: ins, Source: "TSETMC ClosingPriceDailyList / 120", AnchorDate: anchorDate, AnchorClose: anchor, RequestedTargetDate: targetDate, TargetTradingDate: hist[ti].Date, TargetWasTradingDay: exact, TargetPolicy: policy, HorizonSessions: h, ActualClose: actual, BaselineAPEPct: math.Abs(anchor-actual) / actual * 100, ActualDirection: adir, TrainingCandles: len(train), CorporateActionWarn: corpWarn(train), Evaluations: ev, GeneratedAt: time.Now().UTC().Format(time.RFC3339)}, nil
}

func safeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			return '_'
		}
		return r
	}, s)
	return strings.TrimSpace(s)
}

func printReport(r Report) {
	fmt.Printf("Stock Hunter Forecast Audit %s\n", r.Version)
	fmt.Printf("symbol=%s ins=%s source=%s\n", r.Symbol, r.InsCode, r.Source)
	fmt.Printf("anchor=%s close=%.0f training=%d candles\n", r.AnchorDate, r.AnchorClose, r.TrainingCandles)
	if !r.TargetWasTradingDay {
		fmt.Printf("NOTE requested target %s is NON-TRADING / no exact candle; policy=%s -> using trading date %s\n", r.RequestedTargetDate, r.TargetPolicy, r.TargetTradingDate)
	}
	fmt.Printf("target=%s actual_close=%.0f horizon=%d sessions actual_direction=%s baseline_APE=%.3f%%\n", r.TargetTradingDate, r.ActualClose, r.HorizonSessions, r.ActualDirection, r.BaselineAPEPct)
	if r.CorporateActionWarn {
		fmt.Println("WARNING possible corporate-action discontinuity inside training window")
	}
	fmt.Println("MODEL              DIR        CENTER      LOW       HIGH      APE%    IN_RANGE  DIR_OK")
	for _, e := range r.Evaluations {
		fmt.Printf("%-18s %-10s %9.0f %9.0f %9.0f %7.3f   %-7v   %v\n", e.Model, e.Direction, e.Center, e.Low, e.High, e.APEPct, e.RangeCovered, e.DirectionOK)
	}
}

func synthetic() []Candle {
	a := make([]Candle, 0, 140)
	base := 1000.0
	start, _ := time.Parse("20060102", "20260101")
	for i := 0; i < 140; i++ {
		d := start.AddDate(0, 0, i)
		c := base + float64(i)*2 + math.Sin(float64(i)/5)*15
		a = append(a, Candle{Date: d.Format("20060102"), Open: c - 2, High: c + 8, Low: c - 9, Close: c, Volume: 1e6 + float64(i)*1000, Yesterday: func() float64 {
			if i == 0 {
				return c
			}
			return a[i-1].Close
		}()})
	}
	return a
}

func selfTest() error {
	a := synthetic()
	train := a[:120]
	fs := forecasts(train)
	if len(fs) != 5 {
		return errors.New("forecast count")
	}
	for _, f := range fs {
		if !f.OK || len(f.Points) != 10 {
			return fmt.Errorf("%s not ready", f.Name)
		}
	}
	b := append([]Candle(nil), train...)
	b = append(b, Candle{Date: "20990101", Open: 1, High: 999999, Low: 1, Close: 999999, Volume: 1})
	fs2 := forecasts(b[:120])
	for i := range fs {
		if math.Abs(fs[i].Points[9].Center-fs2[i].Points[9].Center) > 1e-9 {
			return errors.New("lookahead invariance")
		}
	}
	fmt.Println("SELFTEST PASS", version, "models=5 no-lookahead=PASS")
	return nil
}

func main() {
	symbol := flag.String("symbol", defaultSymbol, "symbol label")
	ins := flag.String("ins", defaultIns, "TSETMC instrument code")
	anchor := flag.String("anchor", defaultAnchor, "anchor date YYYYMMDD (default 1405/06/30)")
	target := flag.String("target", defaultTarget, "requested target date YYYYMMDD (default 1405/07/02)")
	policy := flag.String("target-policy", "previous", "for non-trading target: previous|next|exact")
	self := flag.Bool("self-test", false, "run built-in deterministic tests")
	flag.Parse()
	if *self {
		if err := selfTest(); err != nil {
			fmt.Fprintln(os.Stderr, "SELFTEST FAIL", err)
			os.Exit(2)
		}
		return
	}
	if *policy != "previous" && *policy != "next" && *policy != "exact" {
		fmt.Fprintln(os.Stderr, "invalid --target-policy")
		os.Exit(2)
	}
	hist, err := fetchHistory(*ins)
	if err != nil {
		fmt.Fprintln(os.Stderr, "TSETMC FETCH ERROR:", err)
		os.Exit(3)
	}
	r, err := buildReport(hist, *symbol, *ins, *anchor, *target, *policy)
	if err != nil {
		fmt.Fprintln(os.Stderr, "AUDIT ERROR:", err)
		os.Exit(4)
	}
	printReport(r)
	name := fmt.Sprintf("forecast_audit_%s_%s_to_%s.json", safeName(*symbol), *anchor, r.TargetTradingDate)
	raw, _ := json.MarshalIndent(r, "", "  ")
	if err = os.WriteFile(name, raw, 0644); err != nil {
		fmt.Fprintln(os.Stderr, "WARN report file:", err)
	} else {
		fmt.Println("JSON report:", name)
	}
}
