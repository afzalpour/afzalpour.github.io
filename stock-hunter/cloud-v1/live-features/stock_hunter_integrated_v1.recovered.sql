-- Recovered directly from PostgreSQL on 2026-09-25.
-- Source: pg_get_viewdef('public.stock_hunter_integrated_v1'::regclass, true)
-- MD5(pg_get_viewdef(...)): 09f820b9692f94010a5391c489ac9c96
-- Audit artifact only; do not execute this file as a migration.

WITH joined AS (
         SELECT s.id,
            s.symbol,
            s.company_name,
            s.state,
            s.last_price,
            s.closing_price,
            s.yesterday_price,
            s.low_price,
            s.high_price,
            s.min_allowed,
            s.max_allowed,
            s.volume,
            s.value,
            s.buy_depth,
            s.sell_depth,
            s.best_bid,
            s.best_ask,
            s.sell_queue,
            s.buy_queue,
            s.fast_score,
            s.fast_probability,
            s.signal_accel,
            s.continuation_score,
            s.prob_2d,
            s.prob_3d,
            s.risk_score,
            s.qi,
            s.ofi,
            s.bid_stack_15s,
            s.ask_pull_15s,
            s.daily_rvol,
            s.rsi_5m,
            s.ema9_5m,
            s.ema21_5m,
            s.vwap,
            s.atr_5m,
            s.technical_score,
            s.microprice,
            s.absorption,
            s.cancellation_ratio,
            s.price_velocity,
            s.trade_accel,
            s.recovery,
            s.depth_ratio,
            s.queue_decay,
            s.momentum,
            s.real_flow_ratio,
            s.hunt_state,
            s.decision,
            s.entry_price,
            s.entry_low,
            s.entry_high,
            s.stop_loss,
            s.target_1,
            s.target_2,
            s.target_3,
            s.risk_reward,
            s.reason,
            s.snapshots,
            s.candles,
            s.raw_json,
            s.identity_repaired_at,
            s.updated_at,
            u.asset_type,
            u.market,
                CASE
                    WHEN ((COALESCE(u.asset_type, ''::text) = ANY (ARRAY['سهام / سایر'::text, 'حق تقدم'::text])) OR s.symbol ~ 'ح$'::text OR COALESCE(s.company_name, ''::text) ~~* 'ح .%'::text) AND COALESCE(s.company_name, ''::text) !~~* '%صندوق%'::text AND COALESCE(s.company_name, ''::text) !~~* '%اختیار%'::text THEN true
                    ELSE false
                END AS integrated_eligible,
            GREATEST(0::numeric, LEAST(100::numeric, 50::numeric + 22::numeric * ln(GREATEST(COALESCE(s.real_flow_ratio, 1::numeric), 0.10)) + 18::numeric * GREATEST('-1'::integer::numeric, LEAST(1::numeric, COALESCE(s.ofi, 0::numeric))) + 10::numeric * GREATEST('-1'::integer::numeric, LEAST(2::numeric, COALESCE(s.daily_rvol, 1::numeric) - 1::numeric)))) AS flow_score_v1,
            GREATEST(0::numeric, LEAST(100::numeric, COALESCE(s.technical_score, 7.5) / 15::numeric * 75::numeric +
                CASE
                    WHEN COALESCE(s.ema9_5m, 0::numeric) > 0::numeric AND s.ema9_5m > s.ema21_5m THEN 10
                    ELSE 0
                END::numeric +
                CASE
                    WHEN COALESCE(s.vwap, 0::numeric) > 0::numeric AND s.last_price >= s.vwap THEN 8
                    ELSE 0
                END::numeric +
                CASE
                    WHEN COALESCE(s.rsi_5m, 0::numeric) >= 40::numeric AND COALESCE(s.rsi_5m, 0::numeric) <= 72::numeric THEN 7
                    ELSE 0
                END::numeric)) AS trend_score_v1,
            GREATEST(0::numeric, LEAST(100::numeric, 50::numeric + 18::numeric * GREATEST('-2'::integer::numeric, LEAST(2::numeric, COALESCE(s.momentum, 0::numeric))))) AS momentum_score_v1,
                CASE
                    WHEN COALESCE(s.last_price, 0::numeric) <= 0::numeric OR COALESCE(s.volume, 0::numeric) <= 0::numeric THEN 0
                    WHEN s.updated_at >= (now() - '00:02:00'::interval) THEN 100
                    WHEN s.updated_at >= (now() - '00:05:00'::interval) THEN 82
                    WHEN s.updated_at >= (now() - '00:10:00'::interval) THEN 65
                    WHEN s.updated_at >= (now() - '00:30:00'::interval) THEN 40
                    ELSE 25
                END::numeric AS data_quality_score_v1
           FROM stock_hunter_signals_v4 s
             LEFT JOIN stock_hunter_universe_v4 u ON u.ins_code = s.id
        ), market AS (
         SELECT avg(
                CASE
                    WHEN joined.integrated_eligible AND joined.yesterday_price > 0::numeric AND joined.last_price > joined.yesterday_price THEN 1.0
                    WHEN joined.integrated_eligible AND joined.yesterday_price > 0::numeric THEN 0.0
                    ELSE NULL::numeric
                END) AS adv_ratio,
            avg(
                CASE
                    WHEN joined.integrated_eligible AND joined.yesterday_price > 0::numeric THEN (joined.last_price / joined.yesterday_price - 1::numeric) * 100::numeric
                    ELSE NULL::numeric
                END) AS avg_return_pct,
            avg(
                CASE
                    WHEN joined.integrated_eligible THEN joined.fast_score
                    ELSE NULL::numeric
                END) AS avg_fast,
            avg(
                CASE
                    WHEN joined.integrated_eligible THEN joined.risk_score
                    ELSE NULL::numeric
                END) AS avg_risk
           FROM joined
          WHERE joined.updated_at > (now() - '00:05:00'::interval)
        ), scored AS (
         SELECT j.id,
            j.symbol,
            j.company_name,
            j.state,
            j.last_price,
            j.closing_price,
            j.yesterday_price,
            j.low_price,
            j.high_price,
            j.min_allowed,
            j.max_allowed,
            j.volume,
            j.value,
            j.buy_depth,
            j.sell_depth,
            j.best_bid,
            j.best_ask,
            j.sell_queue,
            j.buy_queue,
            j.fast_score,
            j.fast_probability,
            j.signal_accel,
            j.continuation_score,
            j.prob_2d,
            j.prob_3d,
            j.risk_score,
            j.qi,
            j.ofi,
            j.bid_stack_15s,
            j.ask_pull_15s,
            j.daily_rvol,
            j.rsi_5m,
            j.ema9_5m,
            j.ema21_5m,
            j.vwap,
            j.atr_5m,
            j.technical_score,
            j.microprice,
            j.absorption,
            j.cancellation_ratio,
            j.price_velocity,
            j.trade_accel,
            j.recovery,
            j.depth_ratio,
            j.queue_decay,
            j.momentum,
            j.real_flow_ratio,
            j.hunt_state,
            j.decision,
            j.entry_price,
            j.entry_low,
            j.entry_high,
            j.stop_loss,
            j.target_1,
            j.target_2,
            j.target_3,
            j.risk_reward,
            j.reason,
            j.snapshots,
            j.candles,
            j.raw_json,
            j.identity_repaired_at,
            j.updated_at,
            j.asset_type,
            j.market,
            j.integrated_eligible,
            j.flow_score_v1,
            j.trend_score_v1,
            j.momentum_score_v1,
            j.data_quality_score_v1,
                CASE
                    WHEN COALESCE(m.avg_risk, 0::numeric) >= 58::numeric THEN 'پرنوسان'::text
                    WHEN COALESCE(m.adv_ratio, 0.5) >= 0.58 AND COALESCE(m.avg_return_pct, 0::numeric) > 0::numeric THEN 'صعودی'::text
                    WHEN COALESCE(m.adv_ratio, 0.5) <= 0.42 AND COALESCE(m.avg_return_pct, 0::numeric) < 0::numeric THEN 'نزولی'::text
                    ELSE 'خنثی'::text
                END AS market_regime_v1,
            round(COALESCE(m.adv_ratio, 0.5) * 100::numeric, 1) AS market_breadth_pct_v1,
            GREATEST(0::numeric, LEAST(100::numeric, 0.38 * COALESCE(j.fast_score, 0::numeric) + 0.22 * COALESCE(j.continuation_score, 0::numeric) + 0.18 * j.flow_score_v1 + 0.14 * j.trend_score_v1 + 0.08 * j.momentum_score_v1 - 0.28 * COALESCE(j.risk_score, 0::numeric) +
                CASE
                    WHEN COALESCE(m.adv_ratio, 0.5) >= 0.58 AND COALESCE(m.avg_return_pct, 0::numeric) > 0::numeric THEN 4
                    WHEN COALESCE(m.adv_ratio, 0.5) <= 0.42 AND COALESCE(m.avg_return_pct, 0::numeric) < 0::numeric THEN '-4'::integer
                    WHEN COALESCE(m.avg_risk, 0::numeric) >= 58::numeric THEN '-2'::integer
                    ELSE 0
                END::numeric)) AS integrated_score_v1,
                CASE
                    WHEN COALESCE(j.fast_score, 0::numeric) >= 58::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(j.continuation_score, 0::numeric) >= 58::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.flow_score_v1 >= 58::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.trend_score_v1 >= 58::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.momentum_score_v1 >= 58::numeric THEN 1
                    ELSE 0
                END AS positive_experts_v1,
                CASE
                    WHEN COALESCE(j.fast_score, 0::numeric) <= 42::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(j.continuation_score, 0::numeric) <= 42::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.flow_score_v1 <= 42::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.trend_score_v1 <= 42::numeric THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN j.momentum_score_v1 <= 42::numeric THEN 1
                    ELSE 0
                END AS negative_experts_v1
           FROM joined j
             CROSS JOIN market m
        ), confidence AS (
         SELECT s.id,
            s.symbol,
            s.company_name,
            s.state,
            s.last_price,
            s.closing_price,
            s.yesterday_price,
            s.low_price,
            s.high_price,
            s.min_allowed,
            s.max_allowed,
            s.volume,
            s.value,
            s.buy_depth,
            s.sell_depth,
            s.best_bid,
            s.best_ask,
            s.sell_queue,
            s.buy_queue,
            s.fast_score,
            s.fast_probability,
            s.signal_accel,
            s.continuation_score,
            s.prob_2d,
            s.prob_3d,
            s.risk_score,
            s.qi,
            s.ofi,
            s.bid_stack_15s,
            s.ask_pull_15s,
            s.daily_rvol,
            s.rsi_5m,
            s.ema9_5m,
            s.ema21_5m,
            s.vwap,
            s.atr_5m,
            s.technical_score,
            s.microprice,
            s.absorption,
            s.cancellation_ratio,
            s.price_velocity,
            s.trade_accel,
            s.recovery,
            s.depth_ratio,
            s.queue_decay,
            s.momentum,
            s.real_flow_ratio,
            s.hunt_state,
            s.decision,
            s.entry_price,
            s.entry_low,
            s.entry_high,
            s.stop_loss,
            s.target_1,
            s.target_2,
            s.target_3,
            s.risk_reward,
            s.reason,
            s.snapshots,
            s.candles,
            s.raw_json,
            s.identity_repaired_at,
            s.updated_at,
            s.asset_type,
            s.market,
            s.integrated_eligible,
            s.flow_score_v1,
            s.trend_score_v1,
            s.momentum_score_v1,
            s.data_quality_score_v1,
            s.market_regime_v1,
            s.market_breadth_pct_v1,
            s.integrated_score_v1,
            s.positive_experts_v1,
            s.negative_experts_v1,
            GREATEST(s.positive_experts_v1, s.negative_experts_v1)::numeric * 20::numeric AS direction_agreement_v1,
            GREATEST(0::numeric, LEAST(100::numeric, 0.45 * (GREATEST(s.positive_experts_v1, s.negative_experts_v1) * 20)::numeric + 0.35 * s.data_quality_score_v1 + 0.20 * LEAST(100::numeric, abs(s.integrated_score_v1 - 50::numeric) * 2::numeric))) AS confidence_score_v1,
                CASE
                    WHEN COALESCE(s.last_price, 0::numeric) <= 0::numeric OR COALESCE(s.volume, 0::numeric) <= 0::numeric THEN true
                    WHEN COALESCE(s.risk_score, 0::numeric) >= 72::numeric THEN true
                    WHEN COALESCE(s.cancellation_ratio, 0::numeric) >= 90::numeric AND COALESCE(s.absorption, 0::numeric) < 12::numeric THEN true
                    ELSE false
                END AS risk_gate_v1,
                CASE
                    WHEN COALESCE(s.last_price, 0::numeric) <= 0::numeric OR COALESCE(s.volume, 0::numeric) <= 0::numeric THEN 'قیمت یا حجم معتبر برای تصمیم وجود ندارد'::text
                    WHEN COALESCE(s.risk_score, 0::numeric) >= 72::numeric THEN 'ریسک فیک/برگشت از حد مجاز بالاتر است'::text
                    WHEN COALESCE(s.cancellation_ratio, 0::numeric) >= 90::numeric AND COALESCE(s.absorption, 0::numeric) < 12::numeric THEN 'لغو سفارش بالا و جذب عرضه ضعیف است'::text
                    WHEN s.updated_at < (now() - '00:10:00'::interval) THEN 'داده لحظه‌ای این نماد به اندازه کافی تازه نیست'::text
                    ELSE NULL::text
                END AS gate_reason_v1
           FROM scored s
        ), final AS (
         SELECT c.id,
            c.symbol,
            c.company_name,
            c.state,
            c.last_price,
            c.closing_price,
            c.yesterday_price,
            c.low_price,
            c.high_price,
            c.min_allowed,
            c.max_allowed,
            c.volume,
            c.value,
            c.buy_depth,
            c.sell_depth,
            c.best_bid,
            c.best_ask,
            c.sell_queue,
            c.buy_queue,
            c.fast_score,
            c.fast_probability,
            c.signal_accel,
            c.continuation_score,
            c.prob_2d,
            c.prob_3d,
            c.risk_score,
            c.qi,
            c.ofi,
            c.bid_stack_15s,
            c.ask_pull_15s,
            c.daily_rvol,
            c.rsi_5m,
            c.ema9_5m,
            c.ema21_5m,
            c.vwap,
            c.atr_5m,
            c.technical_score,
            c.microprice,
            c.absorption,
            c.cancellation_ratio,
            c.price_velocity,
            c.trade_accel,
            c.recovery,
            c.depth_ratio,
            c.queue_decay,
            c.momentum,
            c.real_flow_ratio,
            c.hunt_state,
            c.decision,
            c.entry_price,
            c.entry_low,
            c.entry_high,
            c.stop_loss,
            c.target_1,
            c.target_2,
            c.target_3,
            c.risk_reward,
            c.reason,
            c.snapshots,
            c.candles,
            c.raw_json,
            c.identity_repaired_at,
            c.updated_at,
            c.asset_type,
            c.market,
            c.integrated_eligible,
            c.flow_score_v1,
            c.trend_score_v1,
            c.momentum_score_v1,
            c.data_quality_score_v1,
            c.market_regime_v1,
            c.market_breadth_pct_v1,
            c.integrated_score_v1,
            c.positive_experts_v1,
            c.negative_experts_v1,
            c.direction_agreement_v1,
            c.confidence_score_v1,
            c.risk_gate_v1,
            c.gate_reason_v1,
                CASE
                    WHEN NOT c.integrated_eligible THEN
                    CASE c.decision
                        WHEN 'خرید قوی'::text THEN 'ورود قوی'::text
                        WHEN 'ورود اولیه'::text THEN 'ورود اولیه'::text
                        WHEN 'تحت نظر'::text THEN 'تحت نظر'::text
                        ELSE 'عدم ورود'::text
                    END
                    WHEN c.risk_gate_v1 THEN 'عدم ورود'::text
                    WHEN c.updated_at < (now() - '00:10:00'::interval) THEN 'صبر برای تأیید'::text
                    WHEN c.integrated_score_v1 >= 67::numeric AND c.positive_experts_v1 >= 4 AND COALESCE(c.risk_score, 0::numeric) <= 45::numeric AND c.confidence_score_v1 >= 65::numeric THEN 'ورود قوی'::text
                    WHEN c.integrated_score_v1 >= 57::numeric AND c.positive_experts_v1 >= 3 AND COALESCE(c.risk_score, 0::numeric) <= 55::numeric AND c.confidence_score_v1 >= 55::numeric THEN 'ورود اولیه'::text
                    WHEN c.integrated_score_v1 >= 47::numeric OR c.positive_experts_v1 >= 2 AND c.negative_experts_v1 >= 2 THEN 'صبر برای تأیید'::text
                    WHEN c.integrated_score_v1 >= 39::numeric THEN 'تحت نظر'::text
                    ELSE 'عدم ورود'::text
                END AS final_decision_v1,
                CASE
                    WHEN NOT c.integrated_eligible THEN 'مدل عمومی؛ موتور اختصاصی این نوع ابزار هنوز فعال نشده است'::text
                    WHEN c.confidence_score_v1 >= 72::numeric THEN 'بالا'::text
                    WHEN c.confidence_score_v1 >= 55::numeric THEN 'متوسط'::text
                    ELSE 'پایین'::text
                END AS confidence_label_v1,
                CASE
                    WHEN c.integrated_eligible THEN 'موتور یکپارچه سهام/حق‌تقدم'::text
                    ELSE 'مدل عمومی نسخه قبل'::text
                END AS engine_scope_v1,
            '4.1.0-phase1'::text AS engine_version_v1
           FROM confidence c
        )
 SELECT id,
    symbol,
    company_name,
    state,
    last_price,
    closing_price,
    yesterday_price,
    low_price,
    high_price,
    min_allowed,
    max_allowed,
    volume,
    value,
    buy_depth,
    sell_depth,
    best_bid,
    best_ask,
    sell_queue,
    buy_queue,
    fast_score,
    fast_probability,
    signal_accel,
    continuation_score,
    prob_2d,
    prob_3d,
    risk_score,
    qi,
    ofi,
    bid_stack_15s,
    ask_pull_15s,
    daily_rvol,
    rsi_5m,
    ema9_5m,
    ema21_5m,
    vwap,
    atr_5m,
    technical_score,
    microprice,
    absorption,
    cancellation_ratio,
    price_velocity,
    trade_accel,
    recovery,
    depth_ratio,
    queue_decay,
    momentum,
    real_flow_ratio,
    hunt_state,
    decision,
    entry_price,
    entry_low,
    entry_high,
    stop_loss,
    target_1,
    target_2,
    target_3,
    risk_reward,
    reason,
    snapshots,
    candles,
    raw_json,
    identity_repaired_at,
    updated_at,
    asset_type,
    market,
    integrated_eligible,
    flow_score_v1,
    trend_score_v1,
    momentum_score_v1,
    data_quality_score_v1,
    market_regime_v1,
    market_breadth_pct_v1,
    integrated_score_v1,
    positive_experts_v1,
    negative_experts_v1,
    direction_agreement_v1,
    confidence_score_v1,
    risk_gate_v1,
    gate_reason_v1,
    final_decision_v1,
    confidence_label_v1,
    engine_scope_v1,
    engine_version_v1
   FROM final;
