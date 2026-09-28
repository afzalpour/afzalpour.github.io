package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const version = "4.2.5-pc-eco-challenger-features"
const featureVersion = "4.2.5-challenger-features-v1"
const baseURL = "https://old.tsetmc.com/tsev2/data/"
const ingestURL = "https://summnepwuziwulzvpcms.supabase.co/functions/v1/stock-hunter-pc-ingest-v410"
const siteURL = "https://afzalpour.github.io/stock-hunter/"

var embeddedKey string

var httpClient = &http.Client{Timeout: 25 * time.Second}

type Price struct {
	ID, Symbol, Company                           string
	HEven, PF, Closing, Last, TNO, Volume, Value float64
	Low, High, Yesterday, EPS, BaseVol, Visit     float64
	Flow, MaxAllowed, MinAllowed, Z               float64
}

type Level struct{ Zo, Zd, Pd, Po, Qd, Qo float64 }

type Snap struct {
	T         int64   `json:"t"`
	Last      float64 `json:"last"`
	Volume    float64 `json:"volume"`
	BuyDepth  float64 `json:"buyDepth"`
	SellDepth float64 `json:"sellDepth"`
}

type BookLevelSnap struct {
	BidP float64
	BidQ float64
	AskP float64
	AskQ float64
}

type BookSnap struct {
	T      int64
	Volume float64
	Levels [3]BookLevelSnap
}

type State struct {
	Snaps []Snap
	Books []BookSnap
}

type Row map[string]any

type Feed struct {
	Prices      map[string]*Price
	Best        map[string]map[int]Level
	RefID       int64
	MarketState string
	HEven       int64
	ClientRatio map[string]float64
	LastClient  time.Time
}

type VolumeProfile struct {
	Version   int                           `json:"version"`
	TradeDate string                        `json:"trade_date"`
	Baseline  map[string]map[string]float64 `json:"baseline"`
	Counts    map[string]map[string]int     `json:"counts"`
	Today     map[string]map[string]float64 `json:"today"`
	path      string
	dirty     bool
	lastSave  time.Time
}

func num(s string) float64 {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", "")
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
func clamp(v, a, b float64) float64 {
	if v < a {
		return a
	}
	if v > b {
		return b
	}
	return v
}
func pct(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return (a/b - 1) * 100
}
func logistic(x float64) float64 { return 1 / (1 + math.Exp(-x)) }

func fetchText(path string) (string, error) {
	req, _ := http.NewRequest("GET", baseURL+path, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockHunterPCEco/4.2.5")
	req.Header.Set("Accept", "text/plain,*/*")
	req.Header.Set("Referer", "https://www.tsetmc.com/")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return "", err
	}
	return strings.NewReplacer("ي", "ی", "ك", "ک").Replace(string(b)), nil
}

func parsePrice(row string) *Price {
	p := strings.Split(row, ",")
	if len(p) < 23 {
		return nil
	}
	for len(p) < 26 {
		p = append(p, "")
	}
	if strings.TrimSpace(p[0]) == "" || strings.TrimSpace(p[2]) == "" {
		return nil
	}
	return &Price{
		ID: strings.TrimSpace(p[0]), Symbol: strings.TrimSpace(p[2]), Company: strings.TrimSpace(p[3]),
		HEven: num(p[4]), PF: num(p[5]), Closing: num(p[6]), Last: num(p[7]), TNO: num(p[8]),
		Volume: num(p[9]), Value: num(p[10]), Low: num(p[11]), High: num(p[12]), Yesterday: num(p[13]),
		EPS: num(p[14]), BaseVol: num(p[15]), Visit: num(p[16]), Flow: num(p[17]),
		MaxAllowed: num(p[19]), MinAllowed: num(p[20]), Z: num(p[21]),
	}
}

func parseBL(text string) map[string]map[int]Level {
	out := map[string]map[int]Level{}
	for _, row := range strings.Split(text, ";") {
		if row == "" {
			continue
		}
		p := strings.Split(row, ",")
		if len(p) < 8 {
			continue
		}
		n, _ := strconv.Atoi(p[1])
		if n < 1 {
			continue
		}
		if out[p[0]] == nil {
			out[p[0]] = map[int]Level{}
		}
		out[p[0]][n] = Level{num(p[2]), num(p[3]), num(p[4]), num(p[5]), num(p[6]), num(p[7])}
	}
	return out
}

func (f *Feed) Init() error {
	text, err := fetchText("MarketWatchInit.aspx?h=0&r=0")
	if err != nil {
		return err
	}
	parts := strings.Split(text, "@")
	if len(parts) != 5 {
		return errors.New("MarketWatchInit invalid")
	}
	prices := map[string]*Price{}
	for _, row := range strings.Split(parts[2], ";") {
		if x := parsePrice(row); x != nil {
			prices[x.ID] = x
		}
	}
	ref, _ := strconv.ParseInt(strings.Split(parts[4], ".")[0], 10, 64)
	f.Prices = prices
	f.Best = parseBL(parts[3])
	f.RefID = ref
	f.MarketState = parts[1]
	var h float64
	for _, p := range prices {
		if p.HEven > h {
			h = p.HEven
		}
	}
	f.HEven = int64(h)
	return f.RefreshClients()
}

func (f *Feed) Plus() error {
	h := 5 * (f.HEven / 5)
	r := 25 * (f.RefID / 25)
	text, err := fetchText(fmt.Sprintf("MarketWatchPlus.aspx?h=%d&r=%d", h, r))
	if err != nil {
		return err
	}
	parts := strings.Split(text, "@")
	if len(parts) != 5 {
		return errors.New("MarketWatchPlus invalid")
	}
	for _, row := range strings.Split(parts[2], ";") {
		if row == "" {
			continue
		}
		p := strings.Split(row, ",")
		if len(p) == 10 {
			x := f.Prices[p[0]]
			if x == nil {
				continue
			}
			x.HEven = num(p[1])
			x.PF = num(p[2])
			x.Closing = num(p[3])
			x.Last = num(p[4])
			x.TNO = num(p[5])
			x.Volume = num(p[6])
			x.Value = num(p[7])
			x.Low = num(p[8])
			x.High = num(p[9])
			if int64(x.HEven) > f.HEven {
				f.HEven = int64(x.HEven)
			}
		} else if len(p) >= 23 {
			if x := parsePrice(row); x != nil {
				f.Prices[x.ID] = x
			}
		}
	}
	nb := parseBL(parts[3])
	for id, levels := range nb {
		if f.Best[id] == nil {
			f.Best[id] = map[int]Level{}
		}
		for n, l := range levels {
			f.Best[id][n] = l
		}
	}
	if v, err := strconv.ParseInt(strings.Split(parts[4], ".")[0], 10, 64); err == nil && v > 0 {
		f.RefID = v
	}
	f.MarketState = parts[1]
	if time.Since(f.LastClient) >= 120*time.Second {
		_ = f.RefreshClients()
	}
	return nil
}

func (f *Feed) RefreshClients() error {
	text, err := fetchText("ClientTypeAll.aspx")
	if err != nil {
		return err
	}
	out := map[string]float64{}
	for _, row := range strings.Split(text, ";") {
		p := strings.Split(row, ",")
		if len(p) < 9 {
			continue
		}
		nbc, nbv, nsc, nsv := num(p[1]), num(p[3]), num(p[5]), num(p[7])
		if nbc > 0 && nsc > 0 && nsv > 0 {
			out[p[0]] = (nbv / nbc) / (nsv / nsc)
		}
	}
	f.ClientRatio = out
	f.LastClient = time.Now()
	return nil
}

func currentBook(levels map[int]Level, now int64, volume float64) BookSnap {
	var b BookSnap
	b.T, b.Volume = now, volume
	for i := 0; i < 3; i++ {
		l := levels[i+1]
		b.Levels[i] = BookLevelSnap{BidP: l.Pd, BidQ: l.Qd, AskP: l.Po, AskQ: l.Qo}
	}
	return b
}

func bookReady(b BookSnap) bool {
	for i := 0; i < 3; i++ {
		l := b.Levels[i]
		if l.BidP <= 0 || l.AskP <= 0 || l.BidQ < 0 || l.AskQ < 0 {
			return false
		}
	}
	return true
}

func bookImbalance3(b BookSnap) float64 {
	var buy, sell float64
	for _, l := range b.Levels {
		buy += math.Max(0, l.BidQ)
		sell += math.Max(0, l.AskQ)
	}
	if buy+sell <= 0 {
		return 0
	}
	return clamp((buy-sell)/(buy+sell), -1, 1)
}

func bidEventDelta(old, cur BookLevelSnap) float64 {
	if cur.BidP <= 0 && old.BidP <= 0 {
		return 0
	}
	switch {
	case cur.BidP > old.BidP:
		return math.Max(0, cur.BidQ)
	case cur.BidP == old.BidP:
		return cur.BidQ - old.BidQ
	default:
		return -math.Max(0, old.BidQ)
	}
}

func askEventDelta(old, cur BookLevelSnap) float64 {
	if cur.AskP <= 0 && old.AskP <= 0 {
		return 0
	}
	switch {
	case cur.AskP < old.AskP:
		return math.Max(0, cur.AskQ)
	case cur.AskP == old.AskP:
		return cur.AskQ - old.AskQ
	default:
		return -math.Max(0, old.AskQ)
	}
}

func mlofi3(old, cur BookSnap) float64 {
	var sum float64
	var n int
	for i := 0; i < 3; i++ {
		o, c := old.Levels[i], cur.Levels[i]
		if (o.BidP <= 0 && c.BidP <= 0) || (o.AskP <= 0 && c.AskP <= 0) {
			continue
		}
		den := math.Max(1, (math.Max(0, o.BidQ)+math.Max(0, c.BidQ)+math.Max(0, o.AskQ)+math.Max(0, c.AskQ))/2)
		level := (bidEventDelta(o, c) - askEventDelta(o, c)) / den
		sum += clamp(level, -1, 1)
		n++
	}
	if n == 0 {
		return 0
	}
	return clamp(sum/float64(n), -1, 1)
}

func bookPersistence(books []BookSnap) float64 {
	if len(books) == 0 {
		return 0
	}
	start := 0
	if len(books) > 4 {
		start = len(books) - 4
	}
	var pos, total int
	for _, b := range books[start:] {
		if !bookReady(b) {
			continue
		}
		total++
		if bookImbalance3(b) > 0.05 {
			pos++
		}
	}
	if total == 0 {
		return 0
	}
	return float64(pos) / float64(total)
}

func cancellationProxy(old, cur BookSnap) float64 {
	if !bookReady(old) || !bookReady(cur) {
		return 0
	}
	oldDepth := 0.0
	removed := 0.0
	for side := 0; side < 2; side++ {
		prev := map[float64]float64{}
		next := map[float64]float64{}
		for i := 0; i < 3; i++ {
			if side == 0 {
				if old.Levels[i].BidP > 0 {
					prev[old.Levels[i].BidP] += math.Max(0, old.Levels[i].BidQ)
				}
				if cur.Levels[i].BidP > 0 {
					next[cur.Levels[i].BidP] += math.Max(0, cur.Levels[i].BidQ)
				}
			} else {
				if old.Levels[i].AskP > 0 {
					prev[old.Levels[i].AskP] += math.Max(0, old.Levels[i].AskQ)
				}
				if cur.Levels[i].AskP > 0 {
					next[cur.Levels[i].AskP] += math.Max(0, cur.Levels[i].AskQ)
				}
			}
		}
		for px, q := range prev {
			oldDepth += q
			if q > next[px] {
				removed += q - next[px]
			}
		}
	}
	traded := math.Max(0, cur.Volume-old.Volume)
	unexplained := math.Max(0, removed-traded)
	return clamp(unexplained/math.Max(1, oldDepth), 0, 1)
}

func volumeProfilePath() string {
	root := os.Getenv("LOCALAPPDATA")
	if root == "" {
		if v, err := os.UserCacheDir(); err == nil {
			root = v
		}
	}
	if root == "" {
		root = "."
	}
	return filepath.Join(root, "StockHunterHistorical", "challenger_volume_profile_v425.json")
}

func newVolumeProfile() *VolumeProfile {
	return &VolumeProfile{
		Version: 1, Baseline: map[string]map[string]float64{},
		Counts: map[string]map[string]int{}, Today: map[string]map[string]float64{},
		path: volumeProfilePath(),
	}
}

func loadVolumeProfile() *VolumeProfile {
	v := newVolumeProfile()
	b, err := os.ReadFile(v.path)
	if err != nil {
		return v
	}
	if json.Unmarshal(b, v) != nil || v.Version != 1 {
		return newVolumeProfile()
	}
	v.path = volumeProfilePath()
	if v.Baseline == nil { v.Baseline = map[string]map[string]float64{} }
	if v.Counts == nil { v.Counts = map[string]map[string]int{} }
	if v.Today == nil { v.Today = map[string]map[string]float64{} }
	return v
}

func (v *VolumeProfile) rollDate(date string) bool {
	if date == "" || v.TradeDate == date {
		return false
	}
	if v.TradeDate != "" {
		for id, buckets := range v.Today {
			if v.Baseline[id] == nil { v.Baseline[id] = map[string]float64{} }
			if v.Counts[id] == nil { v.Counts[id] = map[string]int{} }
			for bucket, observed := range buckets {
				if observed <= 0 { continue }
				n := v.Counts[id][bucket]
				old := v.Baseline[id][bucket]
				if n <= 0 || old <= 0 {
					v.Baseline[id][bucket] = observed
					v.Counts[id][bucket] = 1
				} else if n < 20 {
					v.Baseline[id][bucket] = (old*float64(n) + observed) / float64(n+1)
					v.Counts[id][bucket] = n + 1
				} else {
					v.Baseline[id][bucket] = old*0.95 + observed*0.05
					v.Counts[id][bucket] = 20
				}
			}
		}
	}
	v.TradeDate = date
	v.Today = map[string]map[string]float64{}
	v.dirty = true
	return true
}

func (v *VolumeProfile) observe(id string, bucket int, phase float64, volume float64) (float64, int) {
	k := strconv.Itoa(bucket)
	if v.Today[id] == nil { v.Today[id] = map[string]float64{} }
	v.Today[id][k] = math.Max(v.Today[id][k], volume)
	v.dirty = true
	endExpected := 0.0
	count := 0
	if v.Baseline[id] != nil { endExpected = v.Baseline[id][k] }
	if v.Counts[id] != nil { count = v.Counts[id][k] }
	if count < 3 || endExpected <= 0 {
		return 0, count
	}
	phase = clamp(phase, 0, 1)
	expected := endExpected
	prevK := strconv.Itoa(bucket-5)
	prevExpected, prevCount := 0.0, 0
	if v.Baseline[id] != nil { prevExpected = v.Baseline[id][prevK] }
	if v.Counts[id] != nil { prevCount = v.Counts[id][prevK] }
	if prevCount >= 3 && prevExpected > 0 {
		expected = prevExpected + phase*(endExpected-prevExpected)
	} else {
		// First mature bucket of a session: conservative linear ramp to its historical bucket-end volume.
		expected = endExpected * math.Max(.10, phase)
	}
	if expected <= 0 { return 0, count }
	return clamp(volume/expected, 0, 10), count
}

func (v *VolumeProfile) save(force bool) {
	if !v.dirty { return }
	if !force && time.Since(v.lastSave) < 5*time.Minute { return }
	if err := os.MkdirAll(filepath.Dir(v.path), 0755); err != nil { return }
	b, err := json.Marshal(v)
	if err != nil { return }
	tmp := v.path + ".tmp"
	if os.WriteFile(tmp, b, 0644) != nil { return }
	if os.Rename(tmp, v.path) != nil { _ = os.Remove(tmp); return }
	v.lastSave = time.Now()
	v.dirty = false
}

func tehranNow() time.Time {
	loc, err := time.LoadLocation("Asia/Tehran")
	if err != nil {
		return time.Now().UTC().Add(3*time.Hour + 30*time.Minute)
	}
	return time.Now().In(loc)
}
func tehranDate() string { return tehranNow().Format("2006-01-02") }
func tehranBucket5() (int, float64) {
	t := tehranNow()
	m := t.Hour()*60 + t.Minute()
	bucket := (m / 5) * 5
	phase := float64((t.Minute()%5)*60+t.Second()) / 300.0
	return bucket, clamp(phase, 0, 1)
}

func buildRow(p *Price, levels map[int]Level, real float64, st *State, now int64, vp *VolumeProfile, bucket int, bucketPhase float64) Row {
	var buyDepth, sellDepth float64
	for i := 1; i <= 5; i++ {
		l := levels[i]
		buyDepth += l.Qd
		sellDepth += l.Qo
	}
	l1 := levels[1]
	bid, ask, bq, sq := l1.Pd, l1.Po, l1.Qd, l1.Qo
	sellQ := 0.0
	if ask > 0 && p.MinAllowed > 0 && math.Abs(ask-p.MinAllowed)/math.Max(p.MinAllowed, 1) < .001 {
		sellQ = sq
	}
	buyQ := 0.0
	if bid > 0 && p.MaxAllowed > 0 && math.Abs(bid-p.MaxAllowed)/math.Max(p.MaxAllowed, 1) < .001 {
		buyQ = bq
	}

	cur := Snap{now, p.Last, p.Volume, buyDepth, sellDepth}
	snaps := append(st.Snaps, cur)
	if len(snaps) > 12 { snaps = snaps[len(snaps)-12:] }
	st.Snaps = snaps

	book := currentBook(levels, now, p.Volume)
	prevBookReady := len(st.Books) > 0 && bookReady(st.Books[len(st.Books)-1])
	prevBook := BookSnap{}
	if len(st.Books) > 0 { prevBook = st.Books[len(st.Books)-1] }
	st.Books = append(st.Books, book)
	if len(st.Books) > 6 { st.Books = st.Books[len(st.Books)-6:] }

	bookImb3 := bookImbalance3(book)
	mlofi := 0.0
	cancelProxy := 0.0
	if prevBookReady && bookReady(book) {
		mlofi = mlofi3(prevBook, book)
		cancelProxy = cancellationProxy(prevBook, book)
	}
	persistence := bookPersistence(st.Books)
	rvolTOD, rvolSamples := vp.observe(p.ID, bucket, bucketPhase, p.Volume)
	bookLevelsReady := prevBookReady && bookReady(book)

	var qi, ofi, bidStack, askPull, pv, tradeAccel float64
	if buyDepth+sellDepth > 0 { qi = clamp((buyDepth-sellDepth)/(buyDepth+sellDepth), -1, 1) }
	if len(snaps) >= 2 {
		old := snaps[len(snaps)-2]
		dt := float64(now - old.T)
		if dt < 1 { dt = 1 }
		db, ds := buyDepth-old.BuyDepth, sellDepth-old.SellDepth
		den := math.Abs(db) + math.Abs(ds) + math.Max(buyDepth+sellDepth, 1)*.08
		ofi = clamp((db-ds)/den, -1, 1)
		if old.BuyDepth > 0 { bidStack = clamp((buyDepth-old.BuyDepth)/old.BuyDepth*100, -100, 300) }
		if old.SellDepth > 0 { askPull = clamp((old.SellDepth-sellDepth)/old.SellDepth*100, -100, 100) }
		if old.Last > 0 { pv = pct(p.Last, old.Last) * (15 / dt) }
	}
	if len(snaps) >= 4 {
		first, mid, last := snaps[len(snaps)-4], snaps[len(snaps)-2], snaps[len(snaps)-1]
		dt1, dt2 := math.Max(1, float64(mid.T-first.T)), math.Max(1, float64(last.T-mid.T))
		r1, r2 := math.Max(0, mid.Volume-first.Volume)/dt1, math.Max(0, last.Volume-mid.Volume)/dt2
		if r1 > 0 { tradeAccel = clamp((r2/r1-1)*100, -100, 500) } else if r2 > 0 { tradeAccel = 100 }
	}

	dr := 0.0
	if sellDepth > 0 { dr = buyDepth / sellDepth } else if buyDepth > 0 { dr = 9.9 }
	micro := 0.0
	if bid > 0 && ask > 0 && (bq+sq) > 0 { micro = (ask*bq + bid*sq) / (bq + sq) }
	day := pct(p.Last, p.Yesterday)
	mom := day - pct(p.Closing, p.Yesterday)
	recovery := 0.0
	if p.High > p.Low { recovery = clamp((p.Last-p.Low)/(p.High-p.Low)*100, 0, 100) }
	rvol := 0.0
	if p.BaseVol > 0 { rvol = p.Volume / p.BaseVol }

	// Legacy engineering fields remain unchanged for Frozen Hunt 4.1.6.
	order := clamp(50+qi*45+ofi*35+math.Log(math.Max(.15, dr))*15, 0, 100)
	impulse := clamp(50+pv*90+tradeAccel*.20+math.Max(0, bidStack)*.12+math.Max(0, askPull)*.15, 0, 100)
	flow := clamp(45+math.Min(real, 3)*12+math.Min(rvol, 3)*9, 0, 100)
	fast := clamp(.42*order+.38*impulse+.20*flow, 0, 100)
	risk := clamp(50-qi*18-ofi*14+math.Max(0, -mom)*8, 5, 95)
	cont := clamp(.45*flow+.35*order+.20*clamp(50+mom*15, 0, 100), 0, 100)
	entry := choose(ask, p.Last, p.Closing)

	return Row{
		"id": p.ID, "symbol": p.Symbol, "company_name": p.Company, "state": strconv.FormatFloat(p.Flow, 'f', -1, 64),
		"last_price": p.Last, "closing_price": p.Closing, "yesterday_price": p.Yesterday,
		"low_price": p.Low, "high_price": p.High, "min_allowed": p.MinAllowed, "max_allowed": p.MaxAllowed,
		"volume": p.Volume, "value": p.Value, "buy_depth": buyDepth, "sell_depth": sellDepth,
		"best_bid": bid, "best_ask": ask, "sell_queue": sellQ, "buy_queue": buyQ,
		"fast_score": fast, "fast_probability": clamp(logistic((fast-58)/11)*100, 1, 99),
		"signal_accel": clamp(fast-50, -100, 100), "continuation_score": cont,
		"prob_2d": clamp(logistic((cont-risk*.35-38)/12)*100, 2, 98),
		"prob_3d": clamp(logistic((cont-risk*.45-43)/13)*100, 2, 97),
		"risk_score": risk, "qi": qi, "ofi": ofi, "bid_stack_15s": bidStack, "ask_pull_15s": askPull,
		"daily_rvol": rvol, "rsi_5m": 0, "ema9_5m": 0, "ema21_5m": 0,
		"vwap": func() float64 { if p.Volume > 0 { return p.Value / p.Volume }; return 0 }(),
		"atr_5m": 0, "technical_score": 7.5, "microprice": micro, "absorption": 45,
		"cancellation_ratio": 0, "price_velocity": pv, "trade_accel": tradeAccel,
		"recovery": recovery, "depth_ratio": dr, "queue_decay": askPull, "momentum": mom,
		"real_flow_ratio": real, "hunt_state": "رصد", "decision": "تحت نظر",
		"entry_price": entry, "entry_low": entry*.996, "entry_high": entry*1.002,
		"stop_loss": entry*.975, "target_1": entry*1.04, "target_2": entry*1.055, "target_3": entry*1.07,
		"risk_reward": 1.6, "reason": "PC Eco bridge; final Hunt 4.1.6 is browser-side",
		"snapshots": snaps, "candles": []any{},
		"book_imbalance3_v425": bookImb3,
		"mlofi3_v425": mlofi,
		"book_persistence_v425": persistence,
		"cancel_proxy_v425": cancelProxy,
		"rvol_tod_v425": rvolTOD,
		"rvol_tod_samples_v425": rvolSamples,
		"book_levels_ready_v425": bookLevelsReady,
		"challenger_feature_version_v425": featureVersion,
		"raw_json": map[string]any{"source": "old.tsetmc.com bulk", "version": version, "flow": p.Flow},
	}
}

func choose(vs ...float64) float64 {
	for _, v := range vs {
		if v > 0 { return v }
	}
	return 0
}

func gzipJSON(v any) ([]byte, error) {
	raw, err := json.Marshal(v)
	if err != nil { return nil, err }
	var b bytes.Buffer
	zw, _ := gzip.NewWriterLevel(&b, gzip.BestSpeed)
	if _, err = zw.Write(raw); err != nil { return nil, err }
	if err = zw.Close(); err != nil { return nil, err }
	return b.Bytes(), nil
}

func upload(rows []Row, total, batchIndex, batchCount int) (map[string]any, int, error) {
	payload := map[string]any{
		"rows": rows, "agent_version": version,
		"message": "full-universe v425 challenger-feature gzip pc bridge",
		"total_symbols": total, "batch_index": batchIndex, "batch_count": batchCount,
	}
	body, err := gzipJSON(payload)
	if err != nil { return nil, 0, err }
	req, _ := http.NewRequest("POST", ingestURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("X-PC-Key", embeddedKey)
	req.Header.Set("User-Agent", "StockHunterPCEco/"+version)
	resp, err := httpClient.Do(req)
	if err != nil { return nil, len(body), err }
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var out map[string]any
	_ = json.Unmarshal(rb, &out)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return out, len(body), fmt.Errorf("upload HTTP %d: %s", resp.StatusCode, string(rb))
	}
	return out, len(body), nil
}

func marketWindow() bool {
	t := tehranNow()
	wd := t.Weekday()
	if wd == time.Thursday || wd == time.Friday { return false }
	m := t.Hour()*60 + t.Minute()
	return m >= 8*60+15 && m <= 17*60+10
}

func openSite() {
	if runtime.GOOS == "windows" {
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", siteURL).Start()
	}
}

func selfTest() error {
	if version != "4.2.5-pc-eco-challenger-features" { return errors.New("version") }
	if ingestURL == "" { return errors.New("ingest") }
	if featureVersion != "4.2.5-challenger-features-v1" { return errors.New("feature version") }
	return nil
}

func main() {
	runtime.GOMAXPROCS(2)
	if len(os.Args) > 1 && os.Args[1] == "--self-test" {
		if err := selfTest(); err != nil {
			fmt.Println("SELFTEST FAIL", err)
			os.Exit(2)
		}
		fmt.Println("SELFTEST PASS", version)
		return
	}
	if len(embeddedKey) < 20 {
		fmt.Println("ERROR: delivery credential missing")
		os.Exit(3)
	}

	fmt.Println("Stock Hunter PC Eco Bridge", version)
	fmt.Println("Champion 4.1.6 unchanged; Challenger 4.2.5 feature capture enabled.")
	fmt.Println("MarketWatch 30s / ClientType 120s / bounded local time-of-day RVOL profile.")

	feed := &Feed{}
	states := map[string]*State{}
	profile := loadVolumeProfile()
	profile.rollDate(tehranDate())
	profile.save(true)
	initialized, opened := false, false

	for {
		date := tehranDate()
		if profile.rollDate(date) { profile.save(true) }
		if !marketWindow() {
			profile.save(false)
			fmt.Println(time.Now().Format("15:04:05"), "market window closed; sleeping 60s")
			initialized = false
			time.Sleep(60 * time.Second)
			continue
		}

		started := time.Now()
		var err error
		if !initialized {
			err = feed.Init()
			initialized = err == nil
		} else {
			err = feed.Plus()
			if err != nil { initialized = false }
		}
		if err != nil {
			fmt.Println(time.Now().Format("15:04:05"), "TSETMC error:", err)
			time.Sleep(15 * time.Second)
			continue
		}

		now := time.Now().Unix()
		bucket, bucketPhase := tehranBucket5()
		rows := make([]Row, 0, len(feed.Prices))
		for id, p := range feed.Prices {
			flow := int(p.Flow)
			if flow != 1 && flow != 2 && flow != 4 { continue }
			st := states[id]
			if st == nil {
				st = &State{}
				states[id] = st
			}
			rows = append(rows, buildRow(p, feed.Best[id], feed.ClientRatio[id], st, now, profile, bucket, bucketPhase))
		}
		profile.save(false)

		const batchSize = 250
		batchCount := (len(rows) + batchSize - 1) / batchSize
		totalBytes := 0
		ok := true
		var lastOut map[string]any
		for bi := 0; bi < batchCount; bi++ {
			a, b := bi*batchSize, bi*batchSize+batchSize
			if b > len(rows) { b = len(rows) }
			out, n, uerr := upload(rows[a:b], len(rows), bi+1, batchCount)
			totalBytes += n
			lastOut = out
			if uerr != nil {
				fmt.Printf("%s UPLOAD ERROR batch=%d/%d: %v
", time.Now().Format("15:04:05"), bi+1, batchCount, uerr)
				ok = false
				break
			}
		}
		if ok {
			fmt.Printf("%s OK rows=%d batches=%d gzip=%d KB challenger_features=v425 server=%v
",
				time.Now().Format("15:04:05"), len(rows), batchCount, (totalBytes+1023)/1024, lastOut)
			if !opened { openSite(); opened = true }
		}
		elapsed := time.Since(started)
		if elapsed < 30*time.Second { time.Sleep(30*time.Second - elapsed) }
	}
}
