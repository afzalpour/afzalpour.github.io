#!/usr/bin/env python3
import json, math, os, ssl, time, urllib.parse, urllib.request
from datetime import datetime, timezone

BASE='https://old.tsetmc.com/tsev2/data/'
INGEST='https://summnepwuziwulzvpcms.supabase.co/functions/v1/stock-hunter-ingest-v4'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0'
HEADERS={'User-Agent':UA,'Accept':'text/plain,*/*','Referer':'https://www.tsetmc.com/'}
TRANS=str.maketrans('يك','یک')

def f(v, default=0.0):
    try: return float(str(v).replace(',',''))
    except: return default

def clamp(x,a,b): return max(a,min(b,x))
def pct(x,y): return (x/y-1)*100 if y else 0.0
def logistic(x): return 1/(1+math.exp(-x))

def get_text(path, timeout=20):
    req=urllib.request.Request(BASE+path,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=timeout,context=ssl.create_default_context()) as r:
        return r.read().decode('utf-8','ignore').translate(TRANS)

def parse_price(row):
    p=row.split(',')
    if len(p)<23: return None
    p += ['']*(26-len(p))
    keys=['id','isin','symbol','company_name','heven','pf','closing_price','last_price','tno','volume','value','low_price','high_price','yesterday_price','eps','base_vol','visitcount','flow','cs','max_allowed','min_allowed','z','yval','predtran','buyop','cgrvalcot']
    d=dict(zip(keys,p[:26]))
    for k in ['heven','pf','closing_price','last_price','tno','volume','value','low_price','high_price','yesterday_price','eps','base_vol','visitcount','flow','max_allowed','min_allowed','z','predtran','buyop']:
        d[k]=f(d[k])
    d['id']=str(d['id']); d['symbol']=str(d['symbol']).strip(); d['company_name']=str(d['company_name']).strip()
    return d

def parse_bl(rows):
    out={}
    for row in rows.split(';'):
        if not row: continue
        p=row.split(',')
        if len(p)<8: continue
        ins,num,zo,zd,pd,po,qd,qo=p[:8]
        try: num=int(num)
        except: continue
        out.setdefault(str(ins),{})[num]={'zo':f(zo),'zd':f(zd),'pd':f(pd),'po':f(po),'qd':f(qd),'qo':f(qo)}
    return out

def market_init():
    text=get_text('MarketWatchInit.aspx?h=0&r=0',30)
    parts=text.split('@')
    if len(parts)!=5: raise RuntimeError('MarketWatchInit invalid response')
    _, market_state, price_rows, bl_rows, refid=parts
    prices={}
    for row in price_rows.split(';'):
        if not row: continue
        d=parse_price(row)
        if d and d['id'] and d['symbol']: prices[d['id']]=d
    return prices, parse_bl(bl_rows), int(float(refid or 0)), market_state

def market_plus(prices,best,heven,refid):
    h=5*(int(heven)//5); r=25*(int(refid)//25)
    text=get_text(f'MarketWatchPlus.aspx?h={h}&r={r}',20)
    parts=text.split('@')
    if len(parts)!=5: raise RuntimeError('MarketWatchPlus invalid response')
    _, state, inst, bl, newref=parts
    for row in inst.split(';'):
        if not row: continue
        p=row.split(',')
        if len(p)==10:
            ins=p[0]
            if ins in prices:
                keys=['id','heven','pf','closing_price','last_price','tno','volume','value','low_price','high_price']
                for k,v in zip(keys,p): prices[ins][k]=str(v) if k=='id' else f(v)
        elif len(p)>=23:
            d=parse_price(row)
            if d: prices[d['id']]=d
    nb=parse_bl(bl)
    for ins,levels in nb.items(): best.setdefault(ins,{}).update(levels)
    return int(float(newref or refid)), state

def client_types():
    try: text=get_text('ClientTypeAll.aspx',20)
    except Exception: return {}
    out={}
    for row in text.split(';'):
        if not row: continue
        p=row.split(',')
        if len(p)<9: continue
        ins=p[0]; vals=[f(x) for x in p[1:9]]
        nbc,lbc,nbv,lbv,nsc,lsc,nsv,lsv=vals
        ratio=((nbv/nbc)/(nsv/nsc)) if nbc>0 and nsc>0 and nsv>0 else 0
        out[ins]=ratio
    return out

def ema(vals,p):
    if len(vals)<p: return 0
    x=sum(vals[:p])/p; k=2/(p+1)
    for z in vals[p:]: x=z*k+x*(1-k)
    return x

def rsi(vals,p=14):
    if len(vals)<p+1: return 0
    gain=loss=0
    for i in range(len(vals)-p,len(vals)):
        d=vals[i]-vals[i-1]
        if d>0: gain+=d
        else: loss-=d
    if loss==0: return 100 if gain else 50
    rs=(gain/p)/(loss/p); return 100-100/(1+rs)

def atr(cs,p=14):
    if len(cs)<p+1: return 0
    s=0
    for i in range(len(cs)-p,len(cs)):
        pc=cs[i-1]['close']; c=cs[i]
        s+=max(c['high']-c['low'],abs(c['high']-pc),abs(c['low']-pc))
    return s/p

def update_candle(old,last,vol,prevvol,now):
    out=[dict(x) for x in old]; bucket=now-now%(5*60); dv=max(0,vol-prevvol)
    if not out or out[-1]['t']!=bucket: out.append({'t':bucket,'open':last,'high':last,'low':last,'close':last,'volume':dv})
    else:
        c=out[-1]; c['high']=max(c['high'],last); c['low']=min(c['low'] or last,last); c['close']=last; c['volume']+=dv
    return out[-48:]

def tech(cs,last,value,volume,momentum):
    closes=[x['close'] for x in cs if x.get('close')]
    R=rsi(closes); e9=ema(closes,9); e21=ema(closes,21); A=atr(cs); vw=value/volume if volume and value else 0
    rv=0
    if len(cs)>=7:
        av=sum(x['volume'] for x in cs[-7:-1])/6
        if av>0: rv=cs[-1]['volume']/av
    av=raw=0
    if vw:
        av+=4; d=pct(last,vw); raw += 4 if .15<=d<=2.5 else 2.8 if d>=0 else 1.5 if d>-.4 else 0
    if R:
        av+=3; raw += 3 if 38<=R<=62 else 2 if 62<R<=72 else 2.2 if R>=30 and momentum>0 else .2 if R>78 else .8
    if e21:
        av+=4; raw += 4 if e9>e21 else 1.5 if last>e9 else .4
    if rv:
        av+=4; raw += 4 if rv>=2 else 3.2 if rv>=1.4 else 2.2 if rv>=1.05 else .8
    return {'rsi_5m':R,'ema9_5m':e9,'ema21_5m':e21,'vwap':vw,'daily_rvol':rv,'atr_5m':A,'technical_score':clamp(raw/av*15,0,15) if av>=7 else 7.5}

def make_row(p,levels,real,now):
    lv=[levels.get(i,{}) for i in range(1,6)]
    buy_depth=sum(x.get('qd',0) for x in lv); sell_depth=sum(x.get('qo',0) for x in lv)
    l1=lv[0] if lv else {}; bid=l1.get('pd',0); ask=l1.get('po',0); bq=l1.get('qd',0); sq=l1.get('qo',0)
    return {'id':p['id'],'symbol':p['symbol'],'company_name':p['company_name'],'state':'','last_price':p['last_price'],'closing_price':p['closing_price'],'yesterday_price':p['yesterday_price'],'low_price':p['low_price'],'high_price':p['high_price'],'min_allowed':p['min_allowed'],'max_allowed':p['max_allowed'],'volume':p['volume'],'value':p['value'],'buy_depth':buy_depth,'sell_depth':sell_depth,'best_bid':bid,'best_ask':ask,'_bq':bq,'_sq':sq,'sell_queue':sq if ask and abs(ask-p['min_allowed'])/max(p['min_allowed'],1)<.001 else 0,'buy_queue':bq if bid and abs(bid-p['max_allowed'])/max(p['max_allowed'],1)<.001 else 0,'real_flow_ratio':real}

def score(x,prev,now):
    ps=prev.get('snapshots',[]) if prev else []; old=ps[-1] if ps else None; older=ps[-2] if len(ps)>1 else None
    cur={'t':now,'last':x['last_price'],'volume':x['volume'],'buyDepth':x['buy_depth'],'sellDepth':x['sell_depth'],'bid':x['best_bid'],'ask':x['best_ask'],'bq':x['_bq'],'sq':x['_sq'],'sellQueue':x['sell_queue'],'buyQueue':x['buy_queue']}; snaps=(ps+[cur])[-12:]; dt=max(1,now-old['t']) if old else 30
    qi=clamp((cur['buyDepth']-cur['sellDepth'])/(cur['buyDepth']+cur['sellDepth']),-1,1) if cur['buyDepth']+cur['sellDepth'] else 0
    bs=clamp((cur['buyDepth']-old['buyDepth'])/old['buyDepth']*100,-100,300) if old and old['buyDepth'] else 0
    pull=clamp((old['sellDepth']-cur['sellDepth'])/old['sellDepth']*100,-100,100) if old and old['sellDepth'] else 0
    if old:
        db=cur['buyDepth']-old['buyDepth']; ds=cur['sellDepth']-old['sellDepth']; den=abs(db)+abs(ds)+max(cur['buyDepth']+cur['sellDepth'],1)*.08; ofi=clamp((db-ds)/den,-1,1)
    else: ofi=0
    dv=max(0,cur['volume']-old['volume']) if old else 0; pdv=max(0,old['volume']-older['volume']) if old and older else 0; pdt=max(1,old['t']-older['t']) if old and older else dt; rate=dv/dt; pr=pdv/pdt; ta=clamp((rate/pr-1)*100,-100,500) if pr else (100 if rate else 0)
    pv=pct(cur['last'],old['last'])*(15/dt) if old and old['last'] else 0
    removed=max(max(0,old['sellQueue']-cur['sellQueue']) if old else 0,(max(0,old['sellDepth']-cur['sellDepth']) if old else 0)*.45); absorption=clamp(dv/removed*100,0,100) if removed else 0; cancel=clamp(100-absorption,0,100) if removed else 0; qd=clamp((old['sellQueue']-cur['sellQueue'])/old['sellQueue']*100,-100,100) if old and old['sellQueue'] else 0; dr=cur['buyDepth']/cur['sellDepth'] if cur['sellDepth'] else (9.9 if cur['buyDepth'] else 0); micro=(cur['ask']*cur['bq']+cur['bid']*cur['sq'])/(cur['bq']+cur['sq']) if cur['bid'] and cur['ask'] and cur['bq']+cur['sq'] else 0
    last=x['last_price']; y=x['yesterday_price']; close=x['closing_price']; lo=x['low_price'] or x['min_allowed']; hi=x['high_price'] or x['max_allowed']; mom=pct(last,y)-pct(close,y); rec=clamp((last-lo)/(hi-lo)*100,0,100) if hi>lo else 0
    cs=update_candle(prev.get('candles',[]) if prev else [],last,x['volume'],prev.get('volume',0) if prev else 0,now); t=tech(cs,last,x['value'],x['volume'],mom)
    Q=clamp(qi+.15,0,1)*18; O=clamp(ofi+.15,0,1)*18; D=clamp((qd if qd>0 else pull*.55)/100,0,1)*16; B=clamp(bs/100,0,1)*12; M=clamp(pct(micro,last)/.6+.5,0,1)*8 if micro and last else 0; T=clamp((ta+20)/220,0,1)*10; P=clamp((pv+.05)/.7,0,1)*8; A=clamp(absorption/70,0,1)*6; RC=clamp(rec/75,0,1)*4
    fast=clamp(Q+O+D+B+M+T+P+A+RC,0,100)
    if not x['volume']: fast*=.35
    if cancel>80 and absorption<15: fast*=.78
    accel=clamp(fast-f(prev.get('fast_score',0)),-100,100) if prev else 0; fp=clamp(logistic((fast-58)/11)*100,1,99)
    cont=clamp((rec-25)/65,0,1)*22+clamp((mom+.5)/3,0,1)*18+clamp(t['technical_score']/15,0,1)*18+clamp((t['daily_rvol']-.7)/2.3,0,1)*16+clamp(qi+.2,0,1)*14+clamp((x['real_flow_ratio']-.7)/2.3,0,1)*12; cont=clamp(cont,0,100)
    risk=20+clamp(cancel/100,0,1)*28+clamp((-qi-.1)/.9,0,1)*18+clamp((-ofi-.1)/.9,0,1)*12+(12 if t['rsi_5m']>78 else 0)+(10 if mom<-1 else 0)-(8 if absorption>45 else 0)-(6 if x['real_flow_ratio']>1.7 else 0); risk=clamp(risk,0,100)
    p2=clamp(logistic((cont-risk*.35-38)/12)*100,2,98); p3=clamp(logistic((cont-risk*.45-43)/13)*100,2,97)
    hunt='عادی'
    if fast>=78 and cont>=72 and risk<=42: hunt='شکار ویژه'
    elif fast>=80 or accel>=22: hunt='هشدار فوری'
    elif fast>=65: hunt='شکار زودهنگام'
    elif cont>=68: hunt='مستعد تداوم'
    elif fast>=45 or cont>=50: hunt='رصد'
    decision='نخر'
    if hunt=='شکار ویژه' and risk<=40: decision='خرید قوی'
    elif hunt in ('هشدار فوری','شکار زودهنگام') and risk<=52: decision='ورود اولیه'
    elif hunt in ('مستعد تداوم','رصد'): decision='تحت نظر'
    entry=x['best_ask'] or last or close; rp=.018 if decision=='خرید قوی' else .023 if decision=='ورود اولیه' else .027 if decision=='تحت نظر' else .03
    if t['atr_5m'] and entry: rp=clamp(max(rp*.75,t['atr_5m']/entry*1.1),.012,.04)
    stop=entry*(1-rp); rr=2 if decision=='خرید قوی' else 1.65 if decision=='ورود اولیه' else 1.45; ra=entry-stop
    out={k:v for k,v in x.items() if not k.startswith('_')}; out.update({'fast_score':fast,'fast_probability':fp,'signal_accel':accel,'continuation_score':cont,'prob_2d':p2,'prob_3d':p3,'risk_score':risk,'qi':qi,'ofi':ofi,'bid_stack_15s':bs,'ask_pull_15s':pull,**t,'microprice':micro,'absorption':absorption,'cancellation_ratio':cancel,'price_velocity':pv,'trade_accel':ta,'recovery':rec,'depth_ratio':dr,'queue_decay':qd,'momentum':mom,'hunt_state':hunt,'decision':decision,'entry_price':round(entry),'entry_low':round(entry*.996),'entry_high':round(entry*1.002),'stop_loss':round(stop),'target_1':round(entry+ra*rr),'target_2':round(entry+ra*(rr+.65)),'target_3':round(entry+ra*(rr+1.2)),'risk_reward':rr,'reason':'Fast/Microstructure + Continuation + Risk','snapshots':snaps,'candles':cs,'raw_json':{'source':'old.tsetmc.com/MarketWatchInit+Plus','version':'4.0.1-github-worker','symbol':x['symbol'],'company_name':x['company_name']}}); return out

def oidc_token():
    u=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']; sep='&' if '?' in u else '?'; u+=sep+'audience='+urllib.parse.quote('stock-hunter-v4')
    req=urllib.request.Request(u,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(req,timeout=15) as r: return json.loads(r.read().decode())['value']

def upload(rows):
    tok=oidc_token(); body=json.dumps({'rows':rows},ensure_ascii=False,separators=(',',':')).encode()
    req=urllib.request.Request(INGEST,data=body,method='POST',headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json','User-Agent':UA})
    with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read().decode())

def main():
    event=os.getenv('GITHUB_EVENT_NAME','push'); prices,best,refid,_=market_init(); heven=max([int(v.get('heven',0)) for v in prices.values()] or [0]); clients=client_types(); prev={}; last_ct=time.time(); iterations=2 if event=='push' else 10 if event=='workflow_dispatch' else 99999; started=time.time(); print('init symbols',len(prices),'event',event,flush=True)
    for i in range(iterations):
        now=int(time.time())
        if i>0:
            try: refid,_=market_plus(prices,best,heven,refid)
            except Exception as e: print('plus failed, reinit:',e,flush=True); prices,best,refid,_=market_init()
            heven=max([int(v.get('heven',0)) for v in prices.values()] or [heven])
        if time.time()-last_ct>120: clients=client_types(); last_ct=time.time()
        rows=[]
        for ins,p in prices.items():
            if int(p.get('flow',0) or 0) not in (1,2,4): continue
            x=make_row(p,best.get(ins,{}),clients.get(ins,0),now); row=score(x,prev.get(ins),now); prev[ins]=row; rows.append(row)
        rows.sort(key=lambda r:(r['fast_score'],-r['risk_score']),reverse=True); rows=rows[:180]
        print('upload',upload(rows),flush=True)
        if event=='schedule':
            utc=datetime.now(timezone.utc)
            if utc.hour>9 or (utc.hour==9 and utc.minute>=15): break
            if time.time()-started>4.2*3600: break
        if i+1<iterations: time.sleep(30)

if __name__=='__main__': main()
