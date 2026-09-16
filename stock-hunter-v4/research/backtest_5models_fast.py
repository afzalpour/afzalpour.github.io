#!/usr/bin/env python3
import gzip
from urllib.request import Request, urlopen
import backtest_5models_v415 as b

def fetch_members(ins):
    url=f'https://members.tsetmc.com/tsev2/chart/data/Financial.aspx?i={ins}&t=ph&a=0'
    req=Request(url,headers={'User-Agent':b.UA,'Accept':'text/csv,text/plain,*/*'})
    with urlopen(req,timeout=12) as r:
        raw=r.read()
    if raw[:2]==b'\x1f\x8b': raw=gzip.decompress(raw)
    text=raw.decode('utf-8','ignore').strip()
    out=[]
    for rec in text.split(';'):
        parts=rec.strip().split(',')
        if len(parts)<7: continue
        try:
            date,pmax,pmin,pf,pl,tvol,pc=parts[:7]
            row={'date':date,'high':float(pmax),'low':float(pmin),'open':float(pf),'close':float(pc),'volume':float(tvol),'py':0.0}
            if row['date'] and row['high']>0 and row['low']>0 and row['close']>0: out.append(row)
        except Exception:
            pass
    out.sort(key=lambda r:r['date'])
    if len(out)<90: raise RuntimeError(f'members API returned only {len(out)} rows')
    return out

b.fetch_tsetmc=fetch_members
b.main()
