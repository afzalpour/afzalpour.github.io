#!/usr/bin/env python3
import json, math, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import backtest_5models_v415 as b
import backtest_5models_regime_adaptive as r


def main():
    histories, errors = {}, {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        fs = {ex.submit(r.fetch_tv_retry, sym, meta[2]): sym for sym, meta in b.SYMBOLS.items()}
        for f in as_completed(fs):
            sym = fs[f]
            try:
                histories[sym] = f.result()
                print(f'OK {sym}: {len(histories[sym])} daily rows', file=sys.stderr)
            except Exception as e:
                errors[sym] = str(e)
    if len(histories) != len(b.SYMBOLS):
        raise SystemExit(f'Need all symbols; got {len(histories)}. Errors={errors}')

    rows = []
    for sym, meta in b.SYMBOLS.items():
        for back in r.ANCHORS:
            x = r.eval_case(sym, meta, histories[sym], back)
            if x and not x['corp_action']:
                rows.append(x)

    out = {}
    for sym in b.SYMBOLS:
        out[sym] = {}
        regimes = sorted(set(x['regime'] for x in rows if x['symbol'] == sym))
        for regime in regimes:
            xs = [x for x in rows if x['symbol'] == sym and x['regime'] == regime]
            if not xs:
                continue
            base_mean = b.avg([x['Baseline']['ape'] for x in xs])
            stats = {}
            for m in b.MODELS:
                vals = [x[m]['ape'] for x in xs if x[m]['ape'] is not None]
                stats[m] = {
                    'n': len(vals),
                    'mean_ape': b.avg(vals) if vals else None,
                    'beat_baseline_count': sum(x[m]['ape'] < x['Baseline']['ape'] for x in xs if x[m]['ape'] is not None),
                    'winner_count': sum(x['winner'] == m for x in xs),
                    'direction_accuracy_pct': 100 * sum(bool(x[m]['dir_ok']) for x in xs if x[m]['dir_ok'] is not None) / len(xs),
                }
            ranked = sorted(b.MODELS, key=lambda m: stats[m]['mean_ape'])
            best, second = ranked[:2]
            best_mean = stats[best]['mean_ape']
            second_mean = stats[second]['mean_ape']
            beat = stats[best]['beat_baseline_count']
            edge_vs_base = 100 * (base_mean - best_mean) / base_mean if base_mean else None
            advantage = 100 * (second_mean - best_mean) / second_mean if second_mean else None
            n = len(xs)
            # Descriptive evidence label, intentionally conservative for small cells.
            if n >= 5 and beat / n >= 0.60 and edge_vs_base is not None and edge_vs_base >= 10 and advantage >= 5:
                evidence = 'قوی توصیفی'
            elif n >= 3 and beat / n >= 0.50 and edge_vs_base is not None and edge_vs_base > 0:
                evidence = 'متوسط'
            else:
                evidence = 'ضعیف/نامشخص'
            out[sym][regime] = {
                'n': n,
                'baseline_mean_ape': base_mean,
                'best_model': best,
                'runner_up': second,
                'best_mean_ape': best_mean,
                'runner_up_mean_ape': second_mean,
                'edge_vs_baseline_pct': edge_vs_base,
                'advantage_vs_runner_up_pct': advantage,
                'best_beat_baseline_count': beat,
                'best_winner_count': stats[best]['winner_count'],
                'best_direction_accuracy_pct': stats[best]['direction_accuracy_pct'],
                'evidence': evidence,
                'models': stats,
            }

    print('=== SYMBOL X REGIME AFFINITY ===')
    print(json.dumps(out, ensure_ascii=False, indent=2))

    print('=== COMPACT TABLE ===')
    compact = []
    for sym, regs in out.items():
        for regime, z in regs.items():
            compact.append({
                'symbol': sym,
                'regime': regime,
                'n': z['n'],
                'best_model': z['best_model'],
                'best_mean_ape': round(z['best_mean_ape'], 4),
                'baseline_mean_ape': round(z['baseline_mean_ape'], 4),
                'edge_vs_baseline_pct': round(z['edge_vs_baseline_pct'], 2) if z['edge_vs_baseline_pct'] is not None else None,
                'beat_baseline': f"{z['best_beat_baseline_count']}/{z['n']}",
                'evidence': z['evidence'],
            })
    print(json.dumps(compact, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
