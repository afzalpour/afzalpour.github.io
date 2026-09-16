#!/usr/bin/env python3
import re
from urllib.parse import quote
from urllib.request import Request,urlopen
import backtest_5models_v415 as b
symbol='وبملت'
url=f'https://www.shakhesban.com/markets/stock/{quote(symbol)}/history'
req=Request(url,headers={'User-Agent':b.UA,'Accept':'text/html,*/*'})
with urlopen(req,timeout=15) as r:
    html=r.read().decode('utf-8','ignore')
print('HTML_LENGTH',len(html))
print('DATES',re.findall(r'1405/\d{2}/\d{2}',html)[:40])
for m in re.finditer(r'href=["\']([^"\']+)["\']',html,re.I):
    href=m.group(1)
    if 'page' in href.lower() or 'history' in href.lower() or 'offset' in href.lower():
        print('HREF',href)
for token in ['pagination','paginate','page=','offset','data-page','next','آخر','بعدی']:
    pos=html.lower().find(token.lower())
    if pos>=0:
        print('CONTEXT',token,html[max(0,pos-500):pos+1500].replace('\n',' '))
