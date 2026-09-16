#!/usr/bin/env python3
import csv,json,statistics,sys
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
from urllib.parse import quote
from urllib.request import Request,urlopen
import backtest_5models_v415 as b

def fetch_tv(symbol, kind):
    market='fund' if kind=='fund' else 'stock'
    url=f'https://www.shakhesban.com/api/tv/bars?market={quote(market)}&symbol={quote(symbol)}&res=D'
    req=Request(url,headers={'User-Agent':b.UA,'Accept':'application/json,text/plain,*/*','Referer':f'https://www.shakhesban.com/markets/{market}/{quote(symbol)}/charts'})
    with urlopen(req,timeout=15) as r:
        j=json.loads(r.read().decode('utf-8','ignore'))
    if j.get('s')!='ok': raise RuntimeError(f"tv api status={j.get('s')}")
    ts=j.get('t') or []; oo=j.get('o') or []; hh=j.get('h') or []; ll=j.get('l') or []; cc=j.get('c') or []; vv=j.get('v') or []
    n=min(map(len,[ts,oo,hh,ll,cc,vv])) if ts else 0
    out=[]
    for i in range(n):
        try:
            t=float(ts[i]); row={'date':datetime.fromtimestamp(t,timezone.utc).strftime('%Y%m%d'),'open':float(oo[i]),'high':float(hh[i]),'low':float(ll[i]),'close':float(cc[i]),'volume':float(vv[i]),'py':0.0}
            if row['high']>0 and row['low']>0 and row['close']>0: out.append(row)
        except Exception: pass
    out.sort(key=lambda r:r['date'])
    if len(out)<90: raise RuntimeError(f'tv api returned only {len(out)} daily rows')
    return out

def eval_symbol(symbol,meta,hist):
    ins,sector,kind=meta; latest_i=len(hist)-1; anchor_i=latest_i-20; target_i=anchor_i+10
    train=hist[:anchor_i+1]; anchor=hist[anchor_i]['close']; actual=hist[target_i]['close']; adir=b.actual_dir(anchor,actual)
    row={'symbol':symbol,'sector':sector,'source':'Shakhesban-tv','anchor_date':hist[anchor_i]['date'],'target_date':hist[target_i]['date'],'anchor':anchor,'actual':actual,'actual_dir':adir,'corp_action':b.corp_action_flag(hist,anchor_i)}; preds=[]
    for name,f in b.FUNCS.items():
        z=f(train); pred,mdir=z if z else (None,None); err=abs(pred-actual)/actual*100 if pred else None; ok=(mdir==adir) if mdir else None
        row[name]={'pred':pred,'dir':mdir,'ape':err,'dir_ok':ok}
        if pred: preds.append(pred)
    row['Baseline']={'pred':anchor,'ape':abs(anchor-actual)/actual*100}
    med=statistics.median(preds) if preds else None; row['Median5']={'pred':med,'ape':abs(med-actual)/actual*100 if med else None}
    return row

def main():
    histories={}; errors={}
    with ThreadPoolExecutor(max_workers=10) as ex:
        fs={ex.submit(fetch_tv,sym,meta[2]):sym for sym,meta in b.SYMBOLS.items()}
        for f in as_completed(fs):
            sym=fs[f]
            try:
                histories[sym]=f.result(); print(f'OK {sym}: {len(histories[sym])} daily rows',file=sys.stderr)
            except Exception as e:
                errors[sym]=str(e); print(f'ERROR {sym}: {e}',file=sys.stderr)
    results=[eval_symbol(sym,b.SYMBOLS[sym],histories[sym]) for sym in b.SYMBOLS if sym in histories]
    if len(results)<10: raise SystemExit(f'Need 10 successful symbols; got {len(results)}. Errors={errors}')
    summary={}
    for name in b.MODELS+['Baseline','Median5']:
        es=[r[name]['ape'] for r in results if r.get(name,{}).get('ape') is not None]
        summary[name]={'mean_ape':b.avg(es),'median_ape':statistics.median(es),'n':len(es)}
        if name in b.MODELS:
            oks=[r[name]['dir_ok'] for r in results if r[name]['dir_ok'] is not None]
            summary[name]['direction_accuracy']=100*sum(bool(x) for x in oks)/len(oks)
            summary[name]['winner_count']=sum(1 for r in results if r[name]['ape']==min(r[m]['ape'] for m in b.MODELS if r[m]['ape'] is not None))
    print('=== SUMMARY JSON ==='); print(json.dumps(summary,ensure_ascii=False,indent=2)); print('=== PER SYMBOL CSV ===')
    hdr=['symbol','sector','source','anchor_date','target_date','anchor','actual','actual_dir','corp_action']
    for m in b.MODELS: hdr += [m+'_pred',m+'_dir',m+'_ape',m+'_dir_ok']
    hdr += ['Baseline_ape','Median5_pred','Median5_ape']
    w=csv.writer(sys.stdout); w.writerow(hdr)
    for r in results:
        vals=[r[k] for k in hdr[:9]]
        for m in b.MODELS:
            z=r[m]; vals += [round(z['pred'],4) if z['pred'] else '',z['dir'],round(z['ape'],4) if z['ape'] is not None else '',z['dir_ok']]
        vals += [round(r['Baseline']['ape'],4),round(r['Median5']['pred'],4),round(r['Median5']['ape'],4)]; w.writerow(vals)

if __name__=='__main__': main()
