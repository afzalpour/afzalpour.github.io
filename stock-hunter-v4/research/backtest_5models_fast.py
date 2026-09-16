#!/usr/bin/env python3
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote
import backtest_5models_v415 as b

def force_archive(ins):
    raise RuntimeError('archive mode selected to avoid CDN geo timeout')

def _page(symbol, kind, page):
    market='fund' if kind=='fund' else 'stock'
    url=f'https://www.shakhesban.com/markets/{market}/{quote(symbol)}/history?page={page}'
    html=b.fetch_text(url,timeout=6)
    text=b.strip_tags(html)
    rows=[]
    for ch in re.split(r'تاریخ\s*:',text)[1:]:
        dm=re.search(r'\s*(\d{4}/\d{2}/\d{2})',ch)
        if not dm: continue
        def g(label):
            m=re.search(label+r'\s*:\s*([\d,٬.]+)',ch)
            return b.num(m.group(1)) if m else 0.0
        vm=re.search(r'حجم\s*:\s*([\d,٬.]+\s*(?:میلیون|میلیارد|هزار)?)',ch)
        r={'date':dm.group(1),'open':g('بازگشایی'),'low':g('کمترین'),'high':g('بیشترین'),'close':g('پایانی'),'volume':b.volume_num(vm.group(1)) if vm else 0.0,'py':0.0}
        if r['close']>0 and r['high']>0 and r['low']>0: rows.append(r)
    return rows

def archive3(symbol, kind, pages=3):
    rows={}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs=[ex.submit(_page,symbol,kind,p) for p in range(1,4)]
        for f in as_completed(futs):
            try:
                for r in f.result(): rows[r['date']]=r
            except Exception as e:
                print(f'WARN archive page failed for {symbol}: {e}',file=b.sys.stderr)
    return sorted(rows.values(),key=lambda r:r['date'])

b.fetch_tsetmc=force_archive
b.fetch_shakhesban=archive3
b.main()
