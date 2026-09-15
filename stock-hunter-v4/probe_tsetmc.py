#!/usr/bin/env python3
import json, urllib.request, urllib.parse, ssl
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36'
H={'User-Agent':UA,'Accept':'application/json,text/plain,*/*','Referer':'https://www.tsetmc.com/'}
paths=[
('/api/ClosingPrice/GetClosingPriceDailyAllInst','روزانه همه نمادها'),
('/api/ClientType/GetClientTypeAll','حقیقی حقوقی همه'),
('/api/ClosingPrice/GetMarketWatch?market=0&paperTypes%5B0%5D=1&paperTypes%5B1%5D=2&paperTypes%5B2%5D=3&paperTypes%5B3%5D=4&paperTypes%5B4%5D=5&paperTypes%5B5%5D=6&paperTypes%5B6%5D=7&paperTypes%5B7%5D=8&paperTypes%5B8%5D=9&withBestLimits=true&hEven=0&RefID=0','دیده بان'),
('/api/Instrument/GetInstrumentSearch/'+urllib.parse.quote('فولاد'),'جستجوی نماد'),
]
for host in ['https://cdn.tsetmc.com','https://cdn10.tsetmc.com']:
 print('HOST',host,flush=True)
 for path,label in paths:
  try:
   req=urllib.request.Request(host+path,headers=H)
   with urllib.request.urlopen(req,timeout=12,context=ssl.create_default_context()) as r:
    b=r.read(); print(label,'HTTP',r.status,'bytes',len(b),flush=True)
    try:
     j=json.loads(b.decode('utf-8','ignore')); k=next(iter(j),None); v=j.get(k) if k else None
     n=len(v) if isinstance(v,list) else (1 if isinstance(v,dict) else 0)
     print(' key=',k,'count=',n,'sample_keys=',list(v[0].keys())[:16] if isinstance(v,list) and v else list(v.keys())[:16] if isinstance(v,dict) else [],flush=True)
    except Exception as e: print(' non-json',b[:120],flush=True)
  except Exception as e: print(label,'ERROR',repr(e),flush=True)
