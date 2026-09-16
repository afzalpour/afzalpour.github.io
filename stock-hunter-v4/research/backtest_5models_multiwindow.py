#!/usr/bin/env python3
import csv, json, statistics, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import backtest_5models_v415 as b
import backtest_5models_fast as fast

ANCHORS = [20, 40, 60, 80, 100, 120]
HORIZON = 10


def fetch_tv_retry(symbol, kind, attempts=3):
    last = None
    for i in range(attempts):
        try:
            return fast.fetch_tv(symbol, kind)
        except Exception as e:
            last = e
            if i + 1 < attempts:
                time.sleep(1.0 + i)
    raise last


def eval_case(symbol, meta, hist, sessions_back):
    _, sector, _ = meta
    latest_i = len(hist) - 1
    anchor_i = latest_i - sessions_back
    target_i = anchor_i + HORIZON
    if anchor_i < 52 or target_i > latest_i:
        return None
    train = hist[:anchor_i + 1]
    anchor = hist[anchor_i]['close']
    actual = hist[target_i]['close']
    adir = b.actual_dir(anchor, actual)
    row = {
        'symbol': symbol,
        'sector': sector,
        'sessions_back': sessions_back,
        'anchor_date': hist[anchor_i]['date'],
        'target_date': hist[target_i]['date'],
        'anchor': anchor,
        'actual': actual,
        'actual_return_pct': (actual / anchor - 1) * 100,
        'actual_dir': adir,
        'corp_action': b.corp_action_flag(hist, anchor_i),
    }
    preds = []
    for name, f in b.FUNCS.items():
        z = f(train)
        pred, mdir = z if z else (None, None)
        ape = abs(pred - actual) / actual * 100 if pred else None
        row[name] = {
            'pred': pred,
            'dir': mdir,
            'ape': ape,
            'dir_ok': (mdir == adir) if mdir else None,
        }
        if pred:
            preds.append(pred)
    baseline_ape = abs(anchor - actual) / actual * 100
    row['Baseline'] = {'pred': anchor, 'ape': baseline_ape}
    med = statistics.median(preds) if preds else None
    row['Median5'] = {
        'pred': med,
        'ape': abs(med - actual) / actual * 100 if med else None,
    }
    valid = [(m, row[m]['ape']) for m in b.MODELS if row[m]['ape'] is not None]
    row['winner'] = min(valid, key=lambda x: x[1])[0] if valid else None
    return row


def summarize_model(rows, model):
    es = [r[model]['ape'] for r in rows if r[model]['ape'] is not None]
    out = {
        'mean_ape': b.avg(es),
        'median_ape': statistics.median(es) if es else None,
        'n': len(es),
    }
    if model in b.MODELS:
        oks = [r[model]['dir_ok'] for r in rows if r[model]['dir_ok'] is not None]
        out['direction_accuracy'] = 100 * sum(bool(x) for x in oks) / len(oks) if oks else None
        out['winner_count'] = sum(r['winner'] == model for r in rows)
        out['beat_baseline_count'] = sum(
            r[model]['ape'] < r['Baseline']['ape']
            for r in rows if r[model]['ape'] is not None
        )
    return out


def affinity_for_symbol(rows):
    stats = {}
    for m in b.MODELS:
        s = summarize_model(rows, m)
        vals = [r[m]['ape'] for r in rows if r[m]['ape'] is not None]
        s['worst_ape'] = max(vals) if vals else None
        s['stdev_ape'] = statistics.pstdev(vals) if len(vals) > 1 else 0.0
        stats[m] = s
    ordered = sorted(b.MODELS, key=lambda m: stats[m]['mean_ape'])
    best, second = ordered[0], ordered[1]
    best_mean = stats[best]['mean_ape']
    second_mean = stats[second]['mean_ape']
    advantage_pct = ((second_mean - best_mean) / second_mean * 100) if second_mean else 0.0
    wins = stats[best]['winner_count']
    beats = stats[best]['beat_baseline_count']
    if wins >= 3 and beats >= 4 and advantage_pct >= 10:
        strength = 'قوی'
    elif wins >= 2 and beats >= 3 and advantage_pct >= 5:
        strength = 'متوسط'
    else:
        strength = 'ضعیف/نامشخص'
    return {
        'best_model': best,
        'runner_up': second,
        'best_mean_ape': best_mean,
        'runner_up_mean_ape': second_mean,
        'advantage_vs_runner_up_pct': advantage_pct,
        'winner_count': wins,
        'beat_baseline_count': beats,
        'direction_accuracy': stats[best]['direction_accuracy'],
        'affinity_strength': strength,
        'models': stats,
    }


def main():
    histories, errors = {}, {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        fs = {ex.submit(fetch_tv_retry, sym, meta[2]): sym for sym, meta in b.SYMBOLS.items()}
        for f in as_completed(fs):
            sym = fs[f]
            try:
                histories[sym] = f.result()
                print(f'OK {sym}: {len(histories[sym])} daily rows', file=sys.stderr)
            except Exception as e:
                errors[sym] = str(e)
                print(f'ERROR {sym}: {e}', file=sys.stderr)
    if len(histories) < 10:
        raise SystemExit(f'Need 10 successful symbols; got {len(histories)}. Errors={errors}')

    rows = []
    for sym, meta in b.SYMBOLS.items():
        hist = histories[sym]
        for back in ANCHORS:
            r = eval_case(sym, meta, hist, back)
            if r:
                rows.append(r)
    if len(rows) != len(b.SYMBOLS) * len(ANCHORS):
        raise SystemExit(f'Expected 60 cases, got {len(rows)}')

    global_summary = {m: summarize_model(rows, m) for m in b.MODELS + ['Baseline', 'Median5']}
    affinity = {}
    for sym in b.SYMBOLS:
        srows = [r for r in rows if r['symbol'] == sym]
        affinity[sym] = affinity_for_symbol(srows)

    regime_counts = {}
    for r in rows:
        regime_counts[r['actual_dir']] = regime_counts.get(r['actual_dir'], 0) + 1

    print('=== META ===')
    print(json.dumps({
        'anchors_sessions_back': ANCHORS,
        'forecast_horizon_sessions': HORIZON,
        'cases': len(rows),
        'symbols': len(b.SYMBOLS),
        'actual_direction_counts': regime_counts,
        'note': 'Affinity labels are descriptive, not statistical proof; windows are partially overlapping.'
    }, ensure_ascii=False, indent=2))
    print('=== GLOBAL SUMMARY ===')
    print(json.dumps(global_summary, ensure_ascii=False, indent=2))
    print('=== SYMBOL AFFINITY ===')
    print(json.dumps(affinity, ensure_ascii=False, indent=2))

    print('=== CASES CSV ===')
    hdr = ['symbol','sector','sessions_back','anchor_date','target_date','anchor','actual','actual_return_pct','actual_dir','corp_action','winner']
    for m in b.MODELS:
        hdr += [m+'_pred', m+'_dir', m+'_ape', m+'_dir_ok']
    hdr += ['Baseline_ape','Median5_pred','Median5_ape']
    w = csv.writer(sys.stdout); w.writerow(hdr)
    for r in rows:
        vals = [r[k] for k in hdr[:11]]
        for m in b.MODELS:
            z = r[m]
            vals += [round(z['pred'],4) if z['pred'] else '', z['dir'], round(z['ape'],4) if z['ape'] is not None else '', z['dir_ok']]
        vals += [round(r['Baseline']['ape'],4), round(r['Median5']['pred'],4), round(r['Median5']['ape'],4)]
        w.writerow(vals)

if __name__ == '__main__':
    main()
