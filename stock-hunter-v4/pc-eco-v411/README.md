# Stock Hunter PC Eco Bridge v4.1.1

This revision fixes the v4.1.0 top-220 transport prefilter mismatch.

- Reads the full eligible TSETMC MarketWatch universe for flows 1, 2 and 4.
- No local top-N truncation before Frozen Hunt.
- MarketWatch every 30 seconds; ClientType every 120 seconds.
- Full universe is uploaded as gzip batches of at most 250 rows.
- Feed health reports the total universe count.
- Default website view remains active Hunt states only.
- Universal search / "all symbols" remains available for inspection.
- Frozen Hunt `4.1.6-hunt-v2` is unchanged.

The local `fast_score` no longer decides whether a symbol reaches the browser Hunt engine.

EXE SHA-256: `a318401d3d6e3fc7640139cc4370a0b61301db4b1b26421ade49dc0ec3e1671e`

ZIP SHA-256: `0d51471a3a9f0dfefc7273b273e840b4798dc8590bcdefe040ad26cc323aee54`
