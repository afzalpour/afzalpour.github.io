#!/usr/bin/env python3
import csv,gzip,json,statistics,sys
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.request import Request,urlopen
import backtest_5models_v415 as b

def _req(url,timeout=6):
    req=Request(url,headers={'User-Agent':b.UA,'Accept':'application/json,text/plain,*/*'})
    with urlopen(req,timeout=timeout) as r: return r.read()

def _parse_daily_json(raw):
    j=json.loads(raw.decode('utf-8','ignore')); arr=j.get('closingPriceDaily') or [] ; out=[]
    for z in arr:
        try:
            row={'date':str(z.get('dEven') or ''),'high':float(z.get('priceMax') or 0),'low':float(z.get('priceMin') or 0),'open':float(z.get('priceFirst') or 0),'close':float(z.get('pClosing') or z.get('pDrCotVal') or 0),'volume':float(z.get('qTotTran5J') or 0),'py':float(z.get('priceYesterday') or 0)}
            if row['date'] and row['high']>0 and row['low']>0 and row['close']>0: out.append(row)
        except Exception: pass
    return sorted(out,key=lambda r:r['date'])

def _parse_chart_json(raw):
    j=json.loads(raw.decode('utf-8','ignore')); arr=j.get('closingPriceChartData') or []; out=[]
    for z in arr:
        try:
            date=str(z.get('dEven') or z.get('date') or z.get('time') or z.get('t') or '')
            row={'date':date,'open':float(z.get('priceFirst') or z.get('open') or z.get('o') or 0),'high':float(z.get('priceMax') or z.get('high') or z.get('h') or 0),'low':float(z.get('priceMin') or z.get('low') or z.get('l') or 0),'close':float(z.get('pClosing') or z.get('close') or z.get('c') or z.get('pDrCotVal') or 0),'volume':float(z.get('qTotTran5J') or z.get('volume') or z.get('v') or 0),'py':float(z.get('priceYesterday') or 0)}
            if row['date'] and row['high']>0 and row['low']>0 and row['close']>0: out.append(row)
        except Exception: pass
    return sorted(out,key=lambda r:r['date'])

def fetch_history(ins):
    attempts=[]
    urls=[
      ('cdn10-daily',f'https://cdn10.tsetmc.com/api/ClosingPrice/GetClosingPriceDailyList/{ins}/0',_parse_daily_json),
      ('cdn10-chart',f'https://cdn10.tsetmc.com/api/ClosingPrice/GetChartData/{ins}/D',_parse_chart_json),
      ('cdn-chart',f'https://cdn.tsetmc.com/api/ClosingPrice/GetChartData/{ins}/D',_parse_chart_json),
    ]
    for label,url,parser in urls:
        try:
            out=parser(_req(url,6))
            if len(out)>=90:return out,label
            attempts.append(f'{label}:{len(out)} rows')
        except Exception as e: attempts.append(f'{label}:{type(e).__name__}')
    raise RuntimeError('; '.join(attempts))

def eval_symbol(symbol,meta,hist,source):
    ins,sector,kind=meta; latest_i=len(hist)-1; anchor_i=latest_i-20; target_i=anchor_i+10
    train=hist[:anchor_i+1]; anchor=hist[anchor_i]['close']; actual=hist[target_i]['close']; adir=b.actual_dir(anchor,actual)
    row={'symbol':symbol,'sector':sector,'source':source,'anchor_date':hist[anchor_i]['date'],'target_date':hist[target_i]['date'],'anchor':anchor,'actual':actual,'actual_dir':adir,'corp_action':b.corp_action_flag(hist,anchor_i)}; preds=[]
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
        fs={ex.submit(fetch_history,meta[0]):sym for sym,meta in b.SYMBOLS.items()}
        for f in as_completed(fs):
            sym=fs[f]
            try:
                hist,source=f.result(); histories[sym]=(hist,source); print(f'OK {sym}: {len(hist)} rows via {source}',file=sys.stderr)
            except Exception as e: errors[sym]=str(e); print(f'ERROR {sym}: {e}',file=sys.stderr)
    results=[eval_symbol(sym,b.SYMBOLS[sym],*histories[sym]) for sym in b.SYMBOLS if sym in histories]
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
