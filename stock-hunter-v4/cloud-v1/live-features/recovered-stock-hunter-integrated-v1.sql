-- Recovered verbatim from Supabase PostgreSQL historical logs.
-- Migration name: stock_hunter_integrated_engine_v1
-- Original execution timestamp: 2026-09-16T10:15:04.078Z
-- Migration-history wrapper and personal metadata are intentionally excluded.

create or replace view public.stock_hunter_integrated_v1
with (security_invoker = true) as
with joined as (
  select
    s.*,
    u.asset_type,
    u.market,
    case
      when (
        coalesce(u.asset_type,'') in ('سهام / سایر','حق تقدم')
        or s.symbol ~ 'ح$'
        or coalesce(s.company_name,'') ilike 'ح .%'
      )
      and coalesce(s.company_name,'') not ilike '%صندوق%'
      and coalesce(s.company_name,'') not ilike '%اختیار%'
      then true else false
    end as integrated_eligible,
    greatest(0,least(100,
      50
      + 22*ln(greatest(coalesce(s.real_flow_ratio,1),0.10))
      + 18*greatest(-1,least(1,coalesce(s.ofi,0)))
      + 10*greatest(-1,least(2,coalesce(s.daily_rvol,1)-1))
    )) as flow_score_v1,
    greatest(0,least(100,
      coalesce(s.technical_score,7.5)/15*75
      + case when coalesce(s.ema9_5m,0)>0 and s.ema9_5m>s.ema21_5m then 10 else 0 end
      + case when coalesce(s.vwap,0)>0 and s.last_price>=s.vwap then 8 else 0 end
      + case when coalesce(s.rsi_5m,0) between 40 and 72 then 7 else 0 end
    )) as trend_score_v1,
    greatest(0,least(100,
      50 + 18*greatest(-2,least(2,coalesce(s.momentum,0)))
    )) as momentum_score_v1,
    case
      when coalesce(s.last_price,0)<=0 or coalesce(s.volume,0)<=0 then 0
      when s.updated_at >= now()-interval '2 minutes' then 100
      when s.updated_at >= now()-interval '5 minutes' then 82
      when s.updated_at >= now()-interval '10 minutes' then 65
      when s.updated_at >= now()-interval '30 minutes' then 40
      else 25
    end::numeric as data_quality_score_v1
  from public.stock_hunter_signals_v4 s
  left join public.stock_hunter_universe_v4 u on u.ins_code=s.id
), market as (
  select
    avg(case when integrated_eligible and yesterday_price>0 and last_price>yesterday_price then 1.0
             when integrated_eligible and yesterday_price>0 then 0.0 end) as adv_ratio,
    avg(case when integrated_eligible and yesterday_price>0 then (last_price/yesterday_price-1)*100 end) as avg_return_pct,
    avg(case when integrated_eligible then fast_score end) as avg_fast,
    avg(case when integrated_eligible then risk_score end) as avg_risk
  from joined
  where updated_at > now()-interval '5 minutes'
), scored as (
  select
    j.*,
    case
      when coalesce(m.avg_risk,0)>=58 then 'پرنوسان'
      when coalesce(m.adv_ratio,.5)>=.58 and coalesce(m.avg_return_pct,0)>0 then 'صعودی'
      when coalesce(m.adv_ratio,.5)<=.42 and coalesce(m.avg_return_pct,0)<0 then 'نزولی'
      else 'خنثی'
    end as market_regime_v1,
    round((coalesce(m.adv_ratio,.5)*100)::numeric,1) as market_breadth_pct_v1,
    greatest(0,least(100,
      .38*coalesce(j.fast_score,0)
      + .22*coalesce(j.continuation_score,0)
      + .18*j.flow_score_v1
      + .14*j.trend_score_v1
      + .08*j.momentum_score_v1
      - .28*coalesce(j.risk_score,0)
      + case
          when coalesce(m.adv_ratio,.5)>=.58 and coalesce(m.avg_return_pct,0)>0 then 4
          when coalesce(m.adv_ratio,.5)<=.42 and coalesce(m.avg_return_pct,0)<0 then -4
          when coalesce(m.avg_risk,0)>=58 then -2
          else 0
        end
    )) as integrated_score_v1,
    ((case when coalesce(j.fast_score,0)>=58 then 1 else 0 end)
     +(case when coalesce(j.continuation_score,0)>=58 then 1 else 0 end)
     +(case when j.flow_score_v1>=58 then 1 else 0 end)
     +(case when j.trend_score_v1>=58 then 1 else 0 end)
     +(case when j.momentum_score_v1>=58 then 1 else 0 end)) as positive_experts_v1,
    ((case when coalesce(j.fast_score,0)<=42 then 1 else 0 end)
     +(case when coalesce(j.continuation_score,0)<=42 then 1 else 0 end)
     +(case when j.flow_score_v1<=42 then 1 else 0 end)
     +(case when j.trend_score_v1<=42 then 1 else 0 end)
     +(case when j.momentum_score_v1<=42 then 1 else 0 end)) as negative_experts_v1
  from joined j cross join market m
), confidence as (
  select
    s.*,
    greatest(s.positive_experts_v1,s.negative_experts_v1)*20::numeric as direction_agreement_v1,
    greatest(0,least(100,
      .45*(greatest(s.positive_experts_v1,s.negative_experts_v1)*20)
      + .35*s.data_quality_score_v1
      + .20*least(100,abs(s.integrated_score_v1-50)*2)
    )) as confidence_score_v1,
    case
      when coalesce(s.last_price,0)<=0 or coalesce(s.volume,0)<=0 then true
      when coalesce(s.risk_score,0)>=72 then true
      when coalesce(s.cancellation_ratio,0)>=90 and coalesce(s.absorption,0)<12 then true
      else false
    end as risk_gate_v1,
    case
      when coalesce(s.last_price,0)<=0 or coalesce(s.volume,0)<=0 then 'قیمت یا حجم معتبر برای تصمیم وجود ندارد'
      when coalesce(s.risk_score,0)>=72 then 'ریسک فیک/برگشت از حد مجاز بالاتر است'
      when coalesce(s.cancellation_ratio,0)>=90 and coalesce(s.absorption,0)<12 then 'لغو سفارش بالا و جذب عرضه ضعیف است'
      when s.updated_at < now()-interval '10 minutes' then 'داده لحظه‌ای این نماد به اندازه کافی تازه نیست'
      else null
    end as gate_reason_v1
  from scored s
), final as (
  select
    c.*,
    case
      when not c.integrated_eligible then
        case c.decision when 'خرید قوی' then 'ورود قوی' when 'ورود اولیه' then 'ورود اولیه' when 'تحت نظر' then 'تحت نظر' else 'عدم ورود' end
      when c.risk_gate_v1 then 'عدم ورود'
      when c.updated_at < now()-interval '10 minutes' then 'صبر برای تأیید'
      when c.integrated_score_v1>=67 and c.positive_experts_v1>=4 and coalesce(c.risk_score,0)<=45 and c.confidence_score_v1>=65 then 'ورود قوی'
      when c.integrated_score_v1>=57 and c.positive_experts_v1>=3 and coalesce(c.risk_score,0)<=55 and c.confidence_score_v1>=55 then 'ورود اولیه'
      when c.integrated_score_v1>=47 or (c.positive_experts_v1>=2 and c.negative_experts_v1>=2) then 'صبر برای تأیید'
      when c.integrated_score_v1>=39 then 'تحت نظر'
      else 'عدم ورود'
    end as final_decision_v1,
    case
      when not c.integrated_eligible then 'مدل عمومی؛ موتور اختصاصی این نوع ابزار هنوز فعال نشده است'
      when c.confidence_score_v1>=72 then 'بالا'
      when c.confidence_score_v1>=55 then 'متوسط'
      else 'پایین'
    end as confidence_label_v1,
    case when c.integrated_eligible then 'موتور یکپارچه سهام/حق‌تقدم' else 'مدل عمومی نسخه قبل' end as engine_scope_v1,
    '4.1.0-phase1'::text as engine_version_v1
  from confidence c
)
select * from final;

grant select on public.stock_hunter_integrated_v1 to anon, authenticated;
