#!/usr/bin/env python3
import backtest_5models_v415 as b

def force_archive(ins):
    raise RuntimeError('archive mode selected to avoid CDN geo timeout')

def archive3(symbol, kind, pages=3):
    return _orig_archive(symbol, kind, pages=3)

_orig_archive=b.fetch_shakhesban
b.fetch_tsetmc=force_archive
b.fetch_shakhesban=archive3
b.main()
