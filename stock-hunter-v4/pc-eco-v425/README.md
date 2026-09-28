# Stock Hunter PC Eco Bridge v4.2.5 — Challenger Feature Feed

This feed revision is additive. It does **not** change Frozen Hunt `4.1.6-hunt-v2`.

It adds shadow-only feature inputs for the Iran-calibrated Challenger:
- price-aware 3-level multi-level OFI (`mlofi3_v425`);
- static top-3 book imbalance without a separate duplicate depth-ratio term;
- positive buy-book persistence across recent snapshots;
- conservative displayed-depth cancellation proxy;
- time-of-day RVOL against a bounded rolling same-5-minute historical baseline.

The rolling RVOL profile is local and bounded under:
`%LOCALAPPDATA%\StockHunterHistorical\challenger_volume_profile_v425.json`

A minimum of 3 prior observed sessions for the same symbol/time bucket is required before RVOL is marked mature.

Legacy fields used by Frozen Hunt remain byte/semantic compatible and are not overwritten by the new Challenger fields.
