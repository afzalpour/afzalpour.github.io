#!/usr/bin/env python3
import re
from urllib.parse import quote,urljoin
from urllib.request import Request,urlopen
import backtest_5models_v415 as b
base='https://www.shakhesban.com'
symbol='وبملت'
url=f'{base}/markets/stock/{quote(symbol)}/history'
def get(u):
    req=Request(u,headers={'User-Agent':b.UA,'Accept':'*/*'})
    with urlopen(req,timeout=15) as r:return r.read().decode('utf-8','ignore')
html=get(url)
scripts=re.findall(r'<script[^>]+src=["\']([^"\']+)["\']',html,re.I)
print('SCRIPTS',len(scripts))
keys=['paginate_button','dataTables_paginate','history','api/','/api','start','length','pageSize','page_size','offset','markets/stock']
for src in scripts:
    try:
        js=get(urljoin(base,src))
    except Exception as e:
        print('FETCHERR',src,type(e).__name__);continue
    low=js.lower()
    hits=[]
    for key in keys:
        p=low.find(key.lower())
        if p>=0:hits.append((key,p))
    if hits:
        print('\nBUNDLE',src,'LEN',len(js),'HITS',hits)
        for key,p in hits:
            print('CTX',key,js[max(0,p-1000):p+2500].replace('\n',' ')[:3500])
