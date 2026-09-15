#!/usr/bin/env python3
import json, urllib.request, ssl
urls=[
('brs-home','https://brsapi.ir/'),
('brs-free-tsetmc','https://brsapi.ir/FreeTsetmcBourseApi/TsetmcApi.php?key=FreeveC1WWiugiuq45nKMv2B62LsbvUz'),
]
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36','Accept':'application/json,text/plain,*/*'}
for name,url in urls:
    try:
        req=urllib.request.Request(url,headers=H)
        with urllib.request.urlopen(req,timeout=20,context=ssl.create_default_context()) as r:
            b=r.read(500000)
            print(name,'HTTP',r.status,'bytes',len(b),'type',r.headers.get('content-type'))
            print(b[:300].decode('utf-8','ignore').replace('\n',' '))
    except Exception as e:
        print(name,'ERROR',repr(e))
