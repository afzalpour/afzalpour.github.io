#!/usr/bin/env python3
import csv, io, json, math, re, statistics, sys, time
from html import unescape
from urllib.parse import quote
from urllib.request import Request, urlopen

SYMBOLS = {
    'عیار': ('34144395039913458','صندوق طلا','fund'),
    'وبملت': ('778253364357513','بانکی','stock'),
    'فولاد': ('46348559193224090','فولاد','stock'),
    'خودرو': ('65883838195688438','خودرو','stock'),
    'دعبید': ('49054891736433700','دارویی','stock'),
    'شپنا': ('7745894403636165','پالایشی','stock'),
    'کگل': ('35700344742885862','معدنی','stock'),
    'اخابر': ('22811176775480091','مخابرات','stock'),
    'حکشتی': ('60610861509165508','حمل‌ونقل','stock'),
    'شستا': ('2400322364771558','هلدینگ','stock'),
}
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36'
MODELS=['Ichimoku','Gann','Bollinger','MACD','OBV']

def fetch_json(url, timeout=25):
    req=Request(url,headers={'User-Agent':UA,'Accept':'application/json,text/plain,*/*'})
    with urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))

def fetch_text(url, timeout=25):
    req=Request(url,headers={'User-Agent':UA,'Accept':'text/html,*/*'})
    with urlopen(req,timeout=timeout) as r:
        return r.read().decode('utf-8','ignore')

def num(s):
    if s is None: return 0.0
    s=str(s).replace(',','').replace('٬','').strip()
    m=re.search(r'-?\d+(?:\.\d+)?',s)
    return float(m.group(0)) if m else 0.0

def volume_num(s):
    x=num(s)
    if 'میلیارد' in s: x*=1e9
    elif 'میلیون' in s: x*=1e6
    elif 'هزار' in s: x*=1e3
    return x

def fetch_tsetmc(ins):
    url=f'https://cdn.tsetmc.com/api/ClosingPrice/GetClosingPriceDailyList/{ins}/0'
    j=fetch_json(url)
    arr=j.get('closingPriceDaily') or []
    out=[]
    for z in arr:
        d=str(z.get('dEven') or '')
        close=float(z.get('pClosing') or z.get('pDrCotVal') or 0)
        hi=float(z.get('priceMax') or 0); lo=float(z.get('priceMin') or 0)
        op=float(z.get('priceFirst') or 0); vol=float(z.get('qTotTran5J') or 0)
        py=float(z.get('priceYesterday') or 0)
        if d and close>0 and hi>0 and lo>0:
            out.append({'date':d,'open':op,'high':hi,'low':lo,'close':close,'volume':vol,'py':py})
    out.sort(key=lambda r:r['date'])
    return out

def strip_tags(s):
    return unescape(re.sub('<[^>]+>',' ',s)).replace('\xa0',' ')

def fetch_shakhesban(symbol, kind, pages=5):
    market='fund' if kind=='fund' else 'stock'
    rows={}
    for page in range(1,pages+1):
        url=f'https://www.shakhesban.com/markets/{market}/{quote(symbol)}/history?page={page}'
        html=fetch_text(url)
        text=strip_tags(html)
        # Server-rendered rows remain in order; parse labeled cells between dates.
        chunks=re.split(r'تاریخ\s*:',text)[1:]
        for ch in chunks:
            date_m=re.search(r'\s*(\d{4}/\d{2}/\d{2})',ch)
            if not date_m: continue
            def g(label):
                m=re.search(label+r'\s*:\s*([\d,٬.]+)',ch)
                return num(m.group(1)) if m else 0.0
            vm=re.search(r'حجم\s*:\s*([\d,٬.]+\s*(?:میلیون|میلیارد|هزار)?)',ch)
            r={'date':date_m.group(1),'open':g('بازگشایی'),'low':g('کمترین'),'high':g('بیشترین'),'close':g('پایانی'),'volume':volume_num(vm.group(1)) if vm else 0.0,'py':0.0}
            if r['close']>0 and r['high']>0 and r['low']>0: rows[r['date']]=r
        time.sleep(.2)
    out=sorted(rows.values(),key=lambda r:r['date'])
    return out

def clamp(v,a,b): return max(a,min(b,v))
def avg(v): return sum(v)/len(v) if v else 0.0
def stdev(v):
    if len(v)<2:return 0.0
    m=avg(v); return math.sqrt(sum((x-m)**2 for x in v)/len(v))
def lin_slope(vals):
    n=len(vals)
    if n<2:return 0.0
    sx=sum(range(n)); sy=sum(vals); sxy=sum(i*v for i,v in enumerate(vals)); sxx=sum(i*i for i in range(n)); den=n*sxx-sx*sx
    return (n*sxy-sx*sy)/den if den else 0.0
def ema_series(vals,n):
    if not vals:return []
    k=2/(n+1); out=[vals[0]]
    for v in vals[1:]: out.append(v*k+out[-1]*(1-k))
    return out
def mid_hl(a,p):
    s=a[-p:]; return (max(z['high'] for z in s)+min(z['low'] for z in s))/2
def atr(a,p=14):
    if len(a)<p+1:return None
    vals=[]
    for i in range(len(a)-p,len(a)):
        q=a[i]; prev=a[i-1]['close']; vals.append(max(q['high']-q['low'],abs(q['high']-prev),abs(q['low']-prev)))
    return avg(vals)

def fc_ichi(a):
    if len(a)<52:return None
    ten=mid_hl(a,9); kij=mid_hl(a,26); sa=(ten+kij)/2; sb=mid_hl(a,52); p=a[-1]['close']; top=max(sa,sb); bot=min(sa,sb); A=atr(a) or p*.02
    trend=clamp((ten-kij)/(A or 1),-2,2); cloud=.55 if p>top else (-.55 if p<bot else 0); drift=(trend*.18+cloud*.22)*A
    center=max(1,p+drift*10); direction='صعودی' if drift>A*.05 else ('نزولی' if drift<-A*.05 else 'خنثی')
    return center,direction

def fc_gann(a):
    if len(a)<20:return None
    s=a[-20:]; H=max(z['high'] for z in s); L=min(z['low'] for z in s); step=(H-L)/8; p=a[-1]['close']; A=atr(a) or p*.02; slope=clamp(lin_slope([z['close'] for z in s]),-1.5*A,1.5*A)
    levels=[L+i*step for i in range(9)]; above=next((v for v in levels if v>=p),H); below=next((v for v in reversed(levels) if v<=p),L)
    target=min(H+step,above+step) if slope>=0 else max(max(1,L-step),below-step)
    center=max(1,p+slope*.55*10+(target-p)*.45); direction='صعودی' if slope>A*.03 else ('نزولی' if slope<-A*.03 else 'خنثی')
    return center,direction

def fc_boll(a):
    if len(a)<20:return None
    closes=[z['close'] for z in a[-20:]]; p=a[-1]['close']; m=avg(closes); sd=stdev(closes); A=atr(a) or p*.02; slope=lin_slope(closes[-10:]); z=(p-m)/(2*sd) if sd else 0; mean_revert=-z*sd*.08; drift=clamp(slope*.55+mean_revert,-.8*A,.8*A)
    center=max(1,p+drift*10); direction='صعودی' if drift>A*.04 else ('نزولی' if drift<-A*.04 else 'خنثی')
    return center,direction

def fc_macd(a):
    if len(a)<35:return None
    closes=[z['close'] for z in a]; e12=ema_series(closes,12); e26=ema_series(closes,26); macd=[e12[i]-e26[i] for i in range(len(closes))]; sig=ema_series(macd,9); m=macd[-1]; s=sig[-1]; hist=m-s; p=closes[-1]; A=atr(a) or p*.02; price_slope=lin_slope(closes[-12:]); impulse=clamp(hist/(A or 1),-1.5,1.5)*A*.18; drift=clamp(price_slope*.6+impulse,-A,A)
    center=max(1,p+drift*10); direction='صعودی' if (m>s and hist>0) else ('نزولی' if (m<s and hist<0) else 'خنثی')
    return center,direction

def fc_obv(a):
    if len(a)<20:return None
    s=a[-30:]; closes=[z['close'] for z in s]; vols=[z['volume'] for z in s]; av=avg(vols[-20:])
    if av<=0:return None
    obv=[0.0]
    for i in range(1,len(s)):
        d=s[i]['close']-s[i-1]['close']; obv.append(obv[-1]+(vols[i] if d>0 else (-vols[i] if d<0 else 0)))
    os=lin_slope(obv[-20:]); vb=clamp(os/av,-2,2); ps=lin_slope(closes[-20:]); p=a[-1]['close']; A=atr(a) or p*.02; drift=clamp(ps*.55+A*.12*vb,-.9*A,.9*A)
    center=max(1,p+drift*10); direction='صعودی' if vb>.15 and ps>=0 else ('نزولی' if vb<-.15 and ps<=0 else 'خنثی')
    return center,direction

FUNCS={'Ichimoku':fc_ichi,'Gann':fc_gann,'Bollinger':fc_boll,'MACD':fc_macd,'OBV':fc_obv}

def actual_dir(anchor,target):
    r=target/anchor-1
    return 'صعودی' if r>.005 else ('نزولی' if r<-.005 else 'خنثی')

def corp_action_flag(hist, anchor_i):
    start=max(1,anchor_i-60); end=min(len(hist)-1,anchor_i+10)
    for i in range(start,end+1):
        prev=hist[i-1]['close']; py=hist[i].get('py') or 0
        if py and prev and abs(py/prev-1)>.08:return True
        if prev and hist[i]['open'] and abs(hist[i]['open']/prev-1)>.30:return True
    return False

def main():
    results=[]
    for symbol,(ins,sector,kind) in SYMBOLS.items():
        source='TSETMC'
        try:
            hist=fetch_tsetmc(ins)
            if len(hist)<90: raise RuntimeError(f'only {len(hist)} rows')
        except Exception as e:
            source='Shakhesban'
            print(f'WARN {symbol}: TSETMC failed: {e}; using Shakhesban',file=sys.stderr)
            hist=fetch_shakhesban(symbol,kind,pages=5)
        if len(hist)<75:
            print(f'ERROR {symbol}: insufficient history {len(hist)}',file=sys.stderr); continue
        latest_i=len(hist)-1
        anchor_i=latest_i-20
        target_i=anchor_i+10
        train=hist[:anchor_i+1]
        anchor=hist[anchor_i]['close']; actual=hist[target_i]['close']; adir=actual_dir(anchor,actual)
        row={'symbol':symbol,'sector':sector,'source':source,'anchor_date':hist[anchor_i]['date'],'target_date':hist[target_i]['date'],'anchor':anchor,'actual':actual,'actual_dir':adir,'corp_action':corp_action_flag(hist,anchor_i)}
        preds=[]
        for name,f in FUNCS.items():
            z=f(train)
            if not z: pred,mdir=(None,None)
            else: pred,mdir=z
            err=abs(pred-actual)/actual*100 if pred else None
            ok=(mdir==adir) if mdir else None
            row[name]={'pred':pred,'dir':mdir,'ape':err,'dir_ok':ok}
            if pred:preds.append(pred)
        row['Baseline']={'pred':anchor,'ape':abs(anchor-actual)/actual*100}
        med=statistics.median(preds) if preds else None
        row['Median5']={'pred':med,'ape':abs(med-actual)/actual*100 if med else None}
        results.append(row)
        time.sleep(.3)
    if not results: raise SystemExit('No successful symbols')
    summary={}
    for name in MODELS+['Baseline','Median5']:
        es=[r[name]['ape'] for r in results if r.get(name,{}).get('ape') is not None]
        summary[name]={'mean_ape':avg(es),'median_ape':statistics.median(es),'n':len(es)}
        if name in MODELS:
            oks=[r[name]['dir_ok'] for r in results if r[name]['dir_ok'] is not None]
            summary[name]['direction_accuracy']=100*sum(bool(x) for x in oks)/len(oks) if oks else None
            summary[name]['winner_count']=sum(1 for r in results if r[name]['ape']==min(r[m]['ape'] for m in MODELS if r[m]['ape'] is not None))
    print('\n=== BACKTEST META ===')
    print('Anchor = 20 trading sessions before latest available daily record; target = +10 trading sessions; close=pClosing.')
    print('Actual direction threshold: >+0.5% bullish, <-0.5% bearish, otherwise neutral.')
    print('\n=== SUMMARY JSON ===')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    print('\n=== PER SYMBOL CSV ===')
    hdr=['symbol','sector','source','anchor_date','target_date','anchor','actual','actual_dir','corp_action']
    for m in MODELS: hdr += [m+'_pred',m+'_dir',m+'_ape',m+'_dir_ok']
    hdr += ['Baseline_ape','Median5_pred','Median5_ape']
    w=csv.writer(sys.stdout); w.writerow(hdr)
    for r in results:
        vals=[r[k] for k in hdr[:9]]
        for m in MODELS:
            z=r[m]; vals += [round(z['pred'],4) if z['pred'] else '',z['dir'],round(z['ape'],4) if z['ape'] is not None else '',z['dir_ok']]
        vals += [round(r['Baseline']['ape'],4),round(r['Median5']['pred'],4),round(r['Median5']['ape'],4)]
        w.writerow(vals)

if __name__=='__main__': main()
