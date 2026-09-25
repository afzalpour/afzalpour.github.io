# Frozen Hunt 4.1.6 real prospective backtest

Purpose: validate the actual primary Hunt model, not the five supplementary technical forecast models.

Primary population:
- `asset_type = سهام`
- exact frozen engine: `4.1.6-hunt-v2`
- prospective raw market snapshots only
- no synthetic historical feature reconstruction

Two alert channels are reported independently:
- `ACTIVE_ANY`: شکار ویژه / هشدار فوری / شکار زودهنگام
- `ACTION_NOW`: شکار ویژه / هشدار فوری

For each first alert per symbol/day/channel the report measures:
- same-day objective reached:
  - Reversal: later day change reaches >= 0%
  - Acceleration: later day change reaches >= +1%
- same-day positive/target close when close coverage is present
- same-day MFE/MAE from alert price
- next expected trading session coverage
- D+1 positive close
- D+1 hit +1%, +2%, +3%
- D+1 canonical buy queue at any snapshot
- D+1 canonical buy queue at close
- D+1 queue snapshot share and first queue time
- D+1 MFE/MAE from the original alert price

Canonical buy queue uses the production feed feature:
`buy_queue > 0`, derived when level-1 best bid is approximately the daily `max_allowed` price with positive bid quantity.

Missing expected D+1 raw data is never backfilled and is not counted as failure.

The workflow discovers all prospective R2 dates, uses existing deterministic daily packs when available, compacts raw snapshots when needed, replays Frozen Hunt, and uploads JSON/CSV/Markdown evidence.
