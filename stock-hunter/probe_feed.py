#!/usr/bin/env python3
import urllib.request, ssl
urls=[
('old-symbol-list','http://old.tsetmc.com/Loader.aspx?ParTree=111C1417'),
('old-marketwatch','http://old.tsetmc.com/tsev2/data/MarketWatchInit.aspx?h=0&r=0'),
('brs-home','https://brsapi.ir/'),
]
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36','Accept':'text/html,application/json,text/plain,*/*'}
for name,url in urls:
    try:
        req=urllib.request.Request(url,headers=H)
        with urllib.request.urlopen(req,timeout=20,context=ssl.create_default_context()) as r:
            b=r.read(1200000)
            text=b[:500].decode('utf-8','ignore').replace('\n',' ')
            print(name,'HTTP',r.status,'bytes',len(b),'type',r.headers.get('content-type'))
            print(text)
    except Exception as e:
        print(name,'ERROR',repr(e))
