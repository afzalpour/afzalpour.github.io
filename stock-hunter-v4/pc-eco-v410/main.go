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
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

const version = "4.1.0-pc-eco"
const baseURL = "https://old.tsetmc.com/tsev2/data/"
const ingestURL = "https://summnepwuziwulzvpcms.supabase.co/functions/v1/stock-hunter-pc-ingest-v410"
const siteURL = "https://afzalpour.github.io/stock-hunter-v4/"

var embeddedKey string

var httpClient = &http.Client{Timeout: 25 * time.Second}

type Price struct {
	ID, Symbol, Company                          string
	HEven, PF, Closing, Last, TNO, Volume, Value float64
	Low, High, Yesterday, EPS, BaseVol, Visit    float64
	Flow, MaxAllowed, MinAllowed, Z              float64
}
type Level struct{ Zo, Zd, Pd, Po, Qd, Qo float64 }
type Snap struct {
	T int64 `json:"t"`
	Last float64 `json:"last"`
	Volume float64 `json:"volume"`
	BuyDepth float64 `json:"buyDepth"`
	SellDepth float64 `json:"sellDepth"`
}
type State struct{ Snaps []Snap }
type Row map[string]any
type Feed struct {
	Prices map[string]*Price
	Best map[string]map[int]Level
	RefID int64
	MarketState string
	HEven int64
	ClientRatio map[string]float64
	LastClient time.Time
}
func num(s string) float64 { s=strings.ReplaceAll(strings.TrimSpace(s),",",""); if s==""{return 0}; v,_:=strconv.ParseFloat(s,64); return v }
func clamp(v,a,b float64) float64 { if v<a{return a}; if v>b{return b}; return v }
func pct(a,b float64) float64 { if b==0{return 0}; return (a/b-1)*100 }
func logistic(x float64) float64 { return 1/(1+math.Exp(-x)) }
func fetchText(path string)(string,error){
	req,_:=http.NewRequest("GET",baseURL+path,nil)
	req.Header.Set("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockHunterPCEco/4.1.0")
	req.Header.Set("Accept","text/plain,*/*")
	req.Header.Set("Referer","https://www.tsetmc.com/")
	resp,err:=httpClient.Do(req); if err!=nil{return "",err}; defer resp.Body.Close()
	if resp.StatusCode<200||resp.StatusCode>=300{return "",fmt.Errorf("HTTP %d",resp.StatusCode)}
	b,err:=io.ReadAll(io.LimitReader(resp.Body,32<<20)); if err!=nil{return "",err}
	return strings.NewReplacer("ي","ی","ك","ک").Replace(string(b)),nil
}
func parsePrice(row string)*Price{
	p:=strings.Split(row,","); if len(p)<23{return nil}; for len(p)<26{p=append(p,"")}
	if strings.TrimSpace(p[0])==""||strings.TrimSpace(p[2])==""{return nil}
	return &Price{ID:strings.TrimSpace(p[0]),Symbol:strings.TrimSpace(p[2]),Company:strings.TrimSpace(p[3]),HEven:num(p[4]),PF:num(p[5]),Closing:num(p[6]),Last:num(p[7]),TNO:num(p[8]),Volume:num(p[9]),Value:num(p[10]),Low:num(p[11]),High:num(p[12]),Yesterday:num(p[13]),EPS:num(p[14]),BaseVol:num(p[15]),Visit:num(p[16]),Flow:num(p[17]),MaxAllowed:num(p[19]),MinAllowed:num(p[20]),Z:num(p[21])}
}
func parseBL(text string)map[string]map[int]Level{
	out:=map[string]map[int]Level{}
	for _,row:=range strings.Split(text,";"){if row==""{continue};p:=strings.Split(row,",");if len(p)<8{continue};n,_:=strconv.Atoi(p[1]);if n<1{continue};if out[p[0]]==nil{out[p[0]]=map[int]Level{}};out[p[0]][n]=Level{num(p[2]),num(p[3]),num(p[4]),num(p[5]),num(p[6]),num(p[7])}}
	return out
}
func(f *Feed)Init()error{
	text,err:=fetchText("MarketWatchInit.aspx?h=0&r=0");if err!=nil{return err};parts:=strings.Split(text,"@");if len(parts)!=5{return errors.New("MarketWatchInit invalid")}
	prices:=map[string]*Price{};for _,row:=range strings.Split(parts[2],";"){if x:=parsePrice(row);x!=nil{prices[x.ID]=x}}
	ref,_:=strconv.ParseInt(strings.Split(parts[4],".")[0],10,64);f.Prices=prices;f.Best=parseBL(parts[3]);f.RefID=ref;f.MarketState=parts[1]
	var h float64;for _,p:=range prices{if p.HEven>h{h=p.HEven}};f.HEven=int64(h);return f.RefreshClients()
}
func(f *Feed)Plus()error{
	h:=5*(f.HEven/5);r:=25*(f.RefID/25);text,err:=fetchText(fmt.Sprintf("MarketWatchPlus.aspx?h=%d&r=%d",h,r));if err!=nil{return err};parts:=strings.Split(text,"@");if len(parts)!=5{return errors.New("MarketWatchPlus invalid")}
	for _,row:=range strings.Split(parts[2],";"){if row==""{continue};p:=strings.Split(row,",");if len(p)==10{x:=f.Prices[p[0]];if x==nil{continue};x.HEven=num(p[1]);x.PF=num(p[2]);x.Closing=num(p[3]);x.Last=num(p[4]);x.TNO=num(p[5]);x.Volume=num(p[6]);x.Value=num(p[7]);x.Low=num(p[8]);x.High=num(p[9]);if int64(x.HEven)>f.HEven{f.HEven=int64(x.HEven)}}else if len(p)>=23{if x:=parsePrice(row);x!=nil{f.Prices[x.ID]=x}}}
	nb:=parseBL(parts[3]);for id,levels:=range nb{if f.Best[id]==nil{f.Best[id]=map[int]Level{}};for n,l:=range levels{f.Best[id][n]=l}}
	if v,err:=strconv.ParseInt(strings.Split(parts[4],".")[0],10,64);err==nil&&v>0{f.RefID=v};f.MarketState=parts[1];if time.Since(f.LastClient)>=120*time.Second{_=f.RefreshClients()};return nil
}
func(f *Feed)RefreshClients()error{
	text,err:=fetchText("ClientTypeAll.aspx");if err!=nil{return err};out:=map[string]float64{}
	for _,row:=range strings.Split(text,";"){p:=strings.Split(row,",");if len(p)<9{continue};nbc,nbv,nsc,nsv:=num(p[1]),num(p[3]),num(p[5]),num(p[7]);if nbc>0&&nsc>0&&nsv>0{out[p[0]]=(nbv/nbc)/(nsv/nsc)}}
	f.ClientRatio=out;f.LastClient=time.Now();return nil
}
func buildRow(p *Price,levels map[int]Level,real float64,st *State,now int64)Row{
	var buyDepth,sellDepth float64;for i:=1;i<=5;i++{l:=levels[i];buyDepth+=l.Qd;sellDepth+=l.Qo};l1:=levels[1];bid,ask,bq,sq:=l1.Pd,l1.Po,l1.Qd,l1.Qo
	sellQ:=0.0;if ask>0&&p.MinAllowed>0&&math.Abs(ask-p.MinAllowed)/math.Max(p.MinAllowed,1)<.001{sellQ=sq};buyQ:=0.0;if bid>0&&p.MaxAllowed>0&&math.Abs(bid-p.MaxAllowed)/math.Max(p.MaxAllowed,1)<.001{buyQ=bq}
	cur:=Snap{now,p.Last,p.Volume,buyDepth,sellDepth};snaps:=append(st.Snaps,cur);if len(snaps)>12{snaps=snaps[len(snaps)-12:]};st.Snaps=snaps
	var qi,ofi,bidStack,askPull,pv,tradeAccel float64;if buyDepth+sellDepth>0{qi=clamp((buyDepth-sellDepth)/(buyDepth+sellDepth),-1,1)}
	if len(snaps)>=2{old:=snaps[len(snaps)-2];dt:=float64(now-old.T);if dt<1{dt=1};db:=buyDepth-old.BuyDepth;ds:=sellDepth-old.SellDepth;den:=math.Abs(db)+math.Abs(ds)+math.Max(buyDepth+sellDepth,1)*.08;ofi=clamp((db-ds)/den,-1,1);if old.BuyDepth>0{bidStack=clamp((buyDepth-old.BuyDepth)/old.BuyDepth*100,-100,300)};if old.SellDepth>0{askPull=clamp((old.SellDepth-sellDepth)/old.SellDepth*100,-100,100)};if old.Last>0{pv=pct(p.Last,old.Last)*(15/dt)}}
	if len(snaps)>=4{first:=snaps[len(snaps)-4];mid:=snaps[len(snaps)-2];last:=snaps[len(snaps)-1];dt1:=math.Max(1,float64(mid.T-first.T));dt2:=math.Max(1,float64(last.T-mid.T));r1:=math.Max(0,mid.Volume-first.Volume)/dt1;r2:=math.Max(0,last.Volume-mid.Volume)/dt2;if r1>0{tradeAccel=clamp((r2/r1-1)*100,-100,500)}else if r2>0{tradeAccel=100}}
	dr:=0.0;if sellDepth>0{dr=buyDepth/sellDepth}else if buyDepth>0{dr=9.9};micro:=0.0;if bid>0&&ask>0&&(bq+sq)>0{micro=(ask*bq+bid*sq)/(bq+sq)}
	day:=pct(p.Last,p.Yesterday);mom:=day-pct(p.Closing,p.Yesterday);recovery:=0.0;if p.High>p.Low{recovery=clamp((p.Last-p.Low)/(p.High-p.Low)*100,0,100)};rvol:=0.0;if p.BaseVol>0{rvol=p.Volume/p.BaseVol}
	order:=clamp(50+qi*45+ofi*35+math.Log(math.Max(.15,dr))*15,0,100);impulse:=clamp(50+pv*90+tradeAccel*.20+math.Max(0,bidStack)*.12+math.Max(0,askPull)*.15,0,100);flow:=clamp(45+math.Min(real,3)*12+math.Min(rvol,3)*9,0,100);fast:=clamp(.42*order+.38*impulse+.20*flow,0,100);risk:=clamp(50-qi*18-ofi*14+math.Max(0,-mom)*8,5,95);cont:=clamp(.45*flow+.35*order+.20*clamp(50+mom*15,0,100),0,100);entry:=choose(ask,p.Last,p.Closing)
	return Row{"id":p.ID,"symbol":p.Symbol,"company_name":p.Company,"state":strconv.FormatFloat(p.Flow,'f',-1,64),"last_price":p.Last,"closing_price":p.Closing,"yesterday_price":p.Yesterday,"low_price":p.Low,"high_price":p.High,"min_allowed":p.MinAllowed,"max_allowed":p.MaxAllowed,"volume":p.Volume,"value":p.Value,"buy_depth":buyDepth,"sell_depth":sellDepth,"best_bid":bid,"best_ask":ask,"sell_queue":sellQ,"buy_queue":buyQ,"fast_score":fast,"fast_probability":clamp(logistic((fast-58)/11)*100,1,99),"signal_accel":clamp(fast-50,-100,100),"continuation_score":cont,"prob_2d":clamp(logistic((cont-risk*.35-38)/12)*100,2,98),"prob_3d":clamp(logistic((cont-risk*.45-43)/13)*100,2,97),"risk_score":risk,"qi":qi,"ofi":ofi,"bid_stack_15s":bidStack,"ask_pull_15s":askPull,"daily_rvol":rvol,"rsi_5m":0,"ema9_5m":0,"ema21_5m":0,"vwap":func()float64{if p.Volume>0{return p.Value/p.Volume};return 0}(),"atr_5m":0,"technical_score":7.5,"microprice":micro,"absorption":45,"cancellation_ratio":0,"price_velocity":pv,"trade_accel":tradeAccel,"recovery":recovery,"depth_ratio":dr,"queue_decay":askPull,"momentum":mom,"real_flow_ratio":real,"hunt_state":"رصد","decision":"تحت نظر","entry_price":entry,"entry_low":entry*.996,"entry_high":entry*1.002,"stop_loss":entry*.975,"target_1":entry*1.04,"target_2":entry*1.055,"target_3":entry*1.07,"risk_reward":1.6,"reason":"PC Eco bridge; final Hunt 4.1.6 is browser-side","snapshots":snaps,"candles":[]any{},"raw_json":map[string]any{"source":"old.tsetmc.com bulk","version":version,"flow":p.Flow}}
}
func choose(vs ...float64)float64{for _,v:=range vs{if v>0{return v}};return 0}
func gzipJSON(v any)([]byte,error){raw,err:=json.Marshal(v);if err!=nil{return nil,err};var b bytes.Buffer;zw,_:=gzip.NewWriterLevel(&b,gzip.BestSpeed);if _,err=zw.Write(raw);err!=nil{return nil,err};if err=zw.Close();err!=nil{return nil,err};return b.Bytes(),nil}
func upload(rows []Row)(map[string]any,int,error){payload:=map[string]any{"rows":rows,"agent_version":version,"message":"low-bandwidth gzip pc bridge"};body,err:=gzipJSON(payload);if err!=nil{return nil,0,err};req,_:=http.NewRequest("POST",ingestURL,bytes.NewReader(body));req.Header.Set("Content-Type","application/json");req.Header.Set("Content-Encoding","gzip");req.Header.Set("X-PC-Key",embeddedKey);req.Header.Set("User-Agent","StockHunterPCEco/"+version);resp,err:=httpClient.Do(req);if err!=nil{return nil,len(body),err};defer resp.Body.Close();rb,_:=io.ReadAll(io.LimitReader(resp.Body,1<<20));var out map[string]any;_=json.Unmarshal(rb,&out);if resp.StatusCode<200||resp.StatusCode>=300{return out,len(body),fmt.Errorf("upload HTTP %d: %s",resp.StatusCode,string(rb))};return out,len(body),nil}
func tehranNow()time.Time{loc,err:=time.LoadLocation("Asia/Tehran");if err!=nil{return time.Now().UTC().Add(3*time.Hour+30*time.Minute)};return time.Now().In(loc)}
func marketWindow()bool{t:=tehranNow();wd:=t.Weekday();if wd==time.Thursday||wd==time.Friday{return false};m:=t.Hour()*60+t.Minute();return m>=8*60+15&&m<=17*60+10}
func openSite(){if runtime.GOOS=="windows"{_=exec.Command("rundll32","url.dll,FileProtocolHandler",siteURL).Start()}}
func selfTest()error{if version!="4.1.0-pc-eco"{return errors.New("version")};if ingestURL==""{return errors.New("ingest")};if len(embeddedKey)<20{return errors.New("embedded credential missing")};fmt.Println("SELFTEST PASS",version);return nil}
func main(){
	runtime.GOMAXPROCS(2)
	if len(os.Args)>1&&os.Args[1]=="--self-test"{if err:=selfTest();err!=nil{fmt.Println("SELFTEST FAIL",err);os.Exit(2)};return}
	fmt.Println("Stock Hunter PC Eco Bridge",version);fmt.Println("Low-bandwidth mode: MarketWatch 30s / ClientType 120s / gzip upload");fmt.Println("Keep this window open during market hours. Ctrl+C exits.")
	if len(embeddedKey)<20{fmt.Println("ERROR: delivery credential missing");os.Exit(3)}
	feed:=&Feed{};states:=map[string]*State{};initialized:=false;opened:=false
	for{
		if !marketWindow(){fmt.Println(time.Now().Format("15:04:05"),"market window closed; sleeping 60s");initialized=false;time.Sleep(60*time.Second);continue}
		started:=time.Now();var err error;if !initialized{err=feed.Init();initialized=err==nil}else{err=feed.Plus();if err!=nil{initialized=false}}
		if err!=nil{fmt.Println(time.Now().Format("15:04:05"),"TSETMC error:",err);time.Sleep(15*time.Second);continue}
		now:=time.Now().Unix();rows:=make([]Row,0,240);for id,p:=range feed.Prices{flow:=int(p.Flow);if flow!=1&&flow!=2&&flow!=4{continue};st:=states[id];if st==nil{st=&State{};states[id]=st};rows=append(rows,buildRow(p,feed.Best[id],feed.ClientRatio[id],st,now))}
		sort.Slice(rows,func(i,j int)bool{return rows[i]["fast_score"].(float64)>rows[j]["fast_score"].(float64)});if len(rows)>220{rows=rows[:220]}
		out,n,err:=upload(rows);if err!=nil{fmt.Println(time.Now().Format("15:04:05"),"UPLOAD ERROR:",err)}else{fmt.Printf("%s OK rows=%d gzip=%d KB server=%v\n",time.Now().Format("15:04:05"),len(rows),(n+1023)/1024,out);if !opened{openSite();opened=true}}
		elapsed:=time.Since(started);if elapsed<30*time.Second{time.Sleep(30*time.Second-elapsed)}
	}
}
