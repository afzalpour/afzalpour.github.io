#!/usr/bin/env python3
import json, math, statistics, sys, time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import backtest_5models_v415 as b
import backtest_5models_fast as fast

# 18 minimally-overlapping point-in-time anchors. Forecast horizon remains 10 sessions.
ANCHORS = list(range(20, 361, 20))
HORIZON = 10
MIN_SYMBOL_HISTORY = 4
MODELS = list(b.MODELS)


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


def pctile(xs, q):
    if not xs:
        return None
    ys = sorted(xs)
    if len(ys) == 1:
        return ys[0]
    k = (len(ys) - 1) * q
    lo, hi = int(math.floor(k)), int(math.ceil(k))
    if lo == hi:
        return ys[lo]
    return ys[lo] * (hi - k) + ys[hi] * (k - lo)


def realized_vol(closes):
    if len(closes) < 3:
        return 0.0
    rs = [math.log(closes[i] / closes[i-1]) for i in range(1, len(closes)) if closes[i-1] > 0 and closes[i] > 0]
    return statistics.pstdev(rs) if len(rs) > 1 else 0.0


def classify_regime(train):
    """Exclusive point-in-time regime: high-volatility first, then bullish/bearish/range."""
    closes = [z['close'] for z in train]
    if len(closes) < 80:
        return 'نامشخص', {}
    e20 = b.ema_series(closes, 20)[-1]
    e60 = b.ema_series(closes, 60)[-1]
    p = closes[-1]
    ret20 = p / closes[-21] - 1 if len(closes) >= 21 and closes[-21] else 0.0
    rv20 = realized_vol(closes[-21:])

    # Compare current 20-session realized volatility against its own trailing history.
    rv_hist = []
    start = max(21, len(closes) - 140)
    for end in range(start, len(closes)):
        window = closes[max(0, end - 20):end + 1]
        if len(window) >= 21:
            rv_hist.append(realized_vol(window))
    rv75 = pctile(rv_hist[:-1], 0.75) if len(rv_hist) > 8 else None
    high_vol = rv75 is not None and rv20 > rv75 and rv20 > 0

    if high_vol:
        regime = 'پرنوسان'
    elif p > e20 > e60 and ret20 > 0.02:
        regime = 'صعودی'
    elif p < e20 < e60 and ret20 < -0.02:
        regime = 'نزولی'
    else:
        regime = 'رنج/خنثی'
    return regime, {
        'close': p,
        'ema20': e20,
        'ema60': e60,
        'ret20_pct': ret20 * 100,
        'rv20': rv20,
        'rv75': rv75,
    }


def eval_case(symbol, meta, hist, sessions_back):
    _, sector, kind = meta
    latest_i = len(hist) - 1
    anchor_i = latest_i - sessions_back
    target_i = anchor_i + HORIZON
    if anchor_i < 80 or target_i > latest_i:
        return None
    train = hist[:anchor_i + 1]
    anchor = hist[anchor_i]['close']
    actual = hist[target_i]['close']
    adir = b.actual_dir(anchor, actual)
    regime, regime_features = classify_regime(train)
    row = {
        'symbol': symbol,
        'sector': sector,
        'kind': kind,
        'sessions_back': sessions_back,
        'anchor_date': hist[anchor_i]['date'],
        'target_date': hist[target_i]['date'],
        'anchor': anchor,
        'actual': actual,
        'actual_return_pct': (actual / anchor - 1) * 100,
        'actual_dir': adir,
        'regime': regime,
        'regime_features': regime_features,
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
    row['Baseline'] = {'pred': anchor, 'ape': abs(anchor - actual) / actual * 100}
    med = statistics.median(preds) if preds else None
    row['Median5'] = {'pred': med, 'ape': abs(med - actual) / actual * 100 if med else None}
    valid = [(m, row[m]['ape']) for m in MODELS if row[m]['ape'] is not None]
    row['winner'] = min(valid, key=lambda x: x[1])[0] if valid else None
    return row


def summarize(rows, model):
    xs = [r for r in rows if r[model]['ape'] is not None]
    es = [r[model]['ape'] for r in xs]
    out = {
        'n': len(xs),
        'mean_ape': b.avg(es) if es else None,
        'median_ape': statistics.median(es) if es else None,
    }
    if model in MODELS:
        oks = [r[model]['dir_ok'] for r in xs if r[model]['dir_ok'] is not None]
        out.update({
            'direction_accuracy_pct': 100 * sum(bool(x) for x in oks) / len(oks) if oks else None,
            'winner_count': sum(r['winner'] == model for r in xs),
            'beat_baseline_count': sum(r[model]['ape'] < r['Baseline']['ape'] for r in xs),
        })
    return out


def performance_matrix(rows, key):
    groups = defaultdict(list)
    for r in rows:
        groups[r[key]].append(r)
    return {
        g: {m: summarize(xs, m) for m in MODELS + ['Baseline', 'Median5']}
        for g, xs in sorted(groups.items())
    }


def descriptive_symbol_affinity(rows):
    out = {}
    for sym in b.SYMBOLS:
        xs = [r for r in rows if r['symbol'] == sym]
        stats = {m: summarize(xs, m) for m in MODELS}
        ordered = sorted(MODELS, key=lambda m: stats[m]['mean_ape'])
        best, second = ordered[:2]
        bm, sm = stats[best]['mean_ape'], stats[second]['mean_ape']
        advantage = 100 * (sm - bm) / sm if sm else 0.0
        out[sym] = {
            'n': len(xs),
            'best_model': best,
            'runner_up': second,
            'best_mean_ape': bm,
            'runner_up_mean_ape': sm,
            'advantage_vs_runner_up_pct': advantage,
            'winner_count': stats[best]['winner_count'],
            'beat_baseline_count': stats[best]['beat_baseline_count'],
            'direction_accuracy_pct': stats[best]['direction_accuracy_pct'],
        }
    return out


def mean_ape(past, model, predicate=lambda r: True):
    vals = [r[model]['ape'] for r in past if predicate(r) and r[model]['ape'] is not None]
    return (b.avg(vals), len(vals)) if vals else (None, 0)


def shrink_component(base, comp, n, k):
    if comp is None or n <= 0:
        return base, 0.0
    rel = n / (n + k)
    return comp, rel


def expected_model_error(past, current, model):
    g, ng = mean_ape(past, model)
    if g is None:
        return None, {}
    sec, ns = mean_ape(past, model, lambda r: r['sector'] == current['sector'])
    reg, nr = mean_ape(past, model, lambda r: r['regime'] == current['regime'])
    sym, ny = mean_ape(past, model, lambda r: r['symbol'] == current['symbol'])
    sr, nyr = mean_ape(past, model, lambda r: r['symbol'] == current['symbol'] and r['regime'] == current['regime'])

    components = [(g, 1.0, 'global', ng)]
    for val, rel, label, n in [
        (*shrink_component(g, sec, ns, 8), 'sector', ns),
        (*shrink_component(g, reg, nr, 10), 'regime', nr),
        (*shrink_component(g, sym, ny, 5), 'symbol', ny),
        (*shrink_component(g, sr, nyr, 3), 'symbol_regime', nyr),
    ]:
        if rel > 0:
            mult = 1.0
            if label == 'symbol':
                mult = 1.8
            elif label == 'symbol_regime':
                mult = 2.2
            components.append((val, rel * mult, label, n))
    denom = sum(w for _, w, _, _ in components)
    est = sum(v * w for v, w, _, _ in components) / denom
    return est, {label: {'mean_ape': v, 'weight': w, 'n': n} for v, w, label, n in components}


def pred_dir(anchor, pred):
    return b.actual_dir(anchor, pred)


def walk_forward_adaptive(rows):
    clean = [r for r in rows if not r['corp_action']]
    cases = []
    for current in sorted(clean, key=lambda r: (r['anchor_date'], r['symbol'])):
        # A past forecast is usable only if its outcome was already observable by this anchor date.
        past = [r for r in clean if r['target_date'] < current['anchor_date']]
        sym_past = [r for r in past if r['symbol'] == current['symbol']]
        if len(sym_past) < MIN_SYMBOL_HISTORY:
            continue

        est = {}
        details = {}
        for m in MODELS:
            est[m], details[m] = expected_model_error(past, current, m)
        valid = {m: v for m, v in est.items() if v is not None and current[m]['pred'] is not None}
        if not valid:
            continue
        chosen = min(valid, key=valid.get)

        # Inverse expected-error ensemble. Squaring creates meaningful differentiation without hard routing.
        inv = {m: 1.0 / max(valid[m], 0.5) ** 2 for m in valid}
        sw = sum(inv.values())
        weights = {m: inv[m] / sw for m in inv}
        ensemble_pred = sum(weights[m] * current[m]['pred'] for m in weights)
        ensemble_ape = abs(ensemble_pred - current['actual']) / current['actual'] * 100
        ensemble_dir = pred_dir(current['anchor'], ensemble_pred)

        # Baseline-aware gate: use a model only when its estimated error has at least 7.5% historical edge.
        base_vals = [r['Baseline']['ape'] for r in past if r['symbol'] == current['symbol']]
        baseline_est = b.avg(base_vals) if base_vals else None
        edge = ((baseline_est - valid[chosen]) / baseline_est) if baseline_est and baseline_est > 0 else None
        gated_choice = chosen if edge is not None and edge >= 0.075 else 'Baseline'
        gated_ape = current[chosen]['ape'] if gated_choice != 'Baseline' else current['Baseline']['ape']
        gated_pred = current[chosen]['pred'] if gated_choice != 'Baseline' else current['anchor']

        cases.append({
            'symbol': current['symbol'],
            'sector': current['sector'],
            'regime': current['regime'],
            'anchor_date': current['anchor_date'],
            'target_date': current['target_date'],
            'chosen_model': chosen,
            'chosen_ape': current[chosen]['ape'],
            'chosen_dir_ok': current[chosen]['dir_ok'],
            'actual_winner': current['winner'],
            'winner_match': chosen == current['winner'],
            'baseline_ape': current['Baseline']['ape'],
            'median5_ape': current['Median5']['ape'],
            'ensemble_pred': ensemble_pred,
            'ensemble_ape': ensemble_ape,
            'ensemble_dir_ok': ensemble_dir == current['actual_dir'],
            'gated_choice': gated_choice,
            'gated_ape': gated_ape,
            'gated_dir_ok': pred_dir(current['anchor'], gated_pred) == current['actual_dir'],
            'estimated_errors': valid,
            'model_weights': weights,
            'baseline_est_symbol': baseline_est,
            'estimated_edge_vs_baseline': edge,
            'details': details,
        })

    def agg(xs):
        if not xs:
            return {}
        return {
            'n': len(xs),
            'adaptive_hard_mean_ape': b.avg([x['chosen_ape'] for x in xs]),
            'adaptive_hard_median_ape': statistics.median([x['chosen_ape'] for x in xs]),
            'adaptive_hard_direction_accuracy_pct': 100 * sum(bool(x['chosen_dir_ok']) for x in xs) / len(xs),
            'adaptive_hard_beat_baseline_pct': 100 * sum(x['chosen_ape'] < x['baseline_ape'] for x in xs) / len(xs),
            'winner_match_pct': 100 * sum(x['winner_match'] for x in xs) / len(xs),
            'adaptive_ensemble_mean_ape': b.avg([x['ensemble_ape'] for x in xs]),
            'adaptive_ensemble_median_ape': statistics.median([x['ensemble_ape'] for x in xs]),
            'adaptive_ensemble_direction_accuracy_pct': 100 * sum(bool(x['ensemble_dir_ok']) for x in xs) / len(xs),
            'adaptive_ensemble_beat_baseline_pct': 100 * sum(x['ensemble_ape'] < x['baseline_ape'] for x in xs) / len(xs),
            'baseline_aware_mean_ape': b.avg([x['gated_ape'] for x in xs]),
            'baseline_aware_median_ape': statistics.median([x['gated_ape'] for x in xs]),
            'baseline_aware_direction_accuracy_pct': 100 * sum(bool(x['gated_dir_ok']) for x in xs) / len(xs),
            'baseline_mean_ape': b.avg([x['baseline_ape'] for x in xs]),
            'median5_mean_ape': b.avg([x['median5_ape'] for x in xs]),
            'model_used_rate_pct': 100 * sum(x['gated_choice'] != 'Baseline' for x in xs) / len(xs),
        }

    by_symbol = {sym: agg([x for x in cases if x['symbol'] == sym]) for sym in b.SYMBOLS}
    regimes = sorted(set(x['regime'] for x in cases))
    by_regime = {r: agg([x for x in cases if x['regime'] == r]) for r in regimes}
    return {'summary': agg(cases), 'by_symbol': by_symbol, 'by_regime': by_regime, 'cases': cases}


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
    if len(histories) != len(b.SYMBOLS):
        raise SystemExit(f'Need all symbols; got {len(histories)}. Errors={errors}')

    rows = []
    for sym, meta in b.SYMBOLS.items():
        for back in ANCHORS:
            r = eval_case(sym, meta, histories[sym], back)
            if r:
                rows.append(r)
    expected = len(b.SYMBOLS) * len(ANCHORS)
    if len(rows) != expected:
        raise SystemExit(f'Expected {expected} cases, got {len(rows)}')

    clean = [r for r in rows if not r['corp_action']]
    regime_counts = defaultdict(int)
    for r in clean:
        regime_counts[r['regime']] += 1

    global_summary = {m: summarize(clean, m) for m in MODELS + ['Baseline', 'Median5']}
    regime_matrix = performance_matrix(clean, 'regime')
    sector_matrix = performance_matrix(clean, 'sector')
    affinity = descriptive_symbol_affinity(clean)
    adaptive = walk_forward_adaptive(clean)

    compact_cases = [{
        'symbol': x['symbol'], 'regime': x['regime'], 'anchor_date': x['anchor_date'],
        'chosen_model': x['chosen_model'], 'chosen_ape': round(x['chosen_ape'], 4),
        'ensemble_ape': round(x['ensemble_ape'], 4), 'baseline_ape': round(x['baseline_ape'], 4),
        'gated_choice': x['gated_choice'], 'gated_ape': round(x['gated_ape'], 4),
        'winner_match': x['winner_match']
    } for x in adaptive['cases']]

    print('=== META ===')
    print(json.dumps({
        'anchors_sessions_back': ANCHORS,
        'forecast_horizon_sessions': HORIZON,
        'raw_cases': len(rows),
        'clean_cases': len(clean),
        'corp_action_excluded': len(rows) - len(clean),
        'symbols': len(b.SYMBOLS),
        'regime_counts': dict(regime_counts),
        'regime_definition': 'point-in-time only: high-volatility via trailing own-volatility percentile; otherwise EMA20/EMA60 + 20-session momentum; else range/neutral',
        'walk_forward_rule': 'only forecasts whose target_date is earlier than the current anchor_date may train selector',
        'note': 'Adaptive shrinkage weights and 7.5% baseline gate are research heuristics, not production parameters.'
    }, ensure_ascii=False, indent=2))
    print('=== GLOBAL SUMMARY ===')
    print(json.dumps(global_summary, ensure_ascii=False, indent=2))
    print('=== REGIME MATRIX ===')
    print(json.dumps(regime_matrix, ensure_ascii=False, indent=2))
    print('=== SECTOR MATRIX ===')
    print(json.dumps(sector_matrix, ensure_ascii=False, indent=2))
    print('=== SYMBOL AFFINITY 18 WINDOWS ===')
    print(json.dumps(affinity, ensure_ascii=False, indent=2))
    print('=== WALK FORWARD ADAPTIVE ===')
    print(json.dumps({k: v for k, v in adaptive.items() if k != 'cases'}, ensure_ascii=False, indent=2))
    print('=== WALK FORWARD CASES COMPACT ===')
    print(json.dumps(compact_cases, ensure_ascii=False))


if __name__ == '__main__':
    main()
