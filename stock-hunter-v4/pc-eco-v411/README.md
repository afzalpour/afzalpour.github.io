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

EXE SHA-256: `999d79257049a8d4357420a9b8de72b6e6c506afe4bfc5904a0616b9f52f290d`

ZIP SHA-256: `7c2f7fbbfd2f0196ef97b832d4e516a0575e281fbe486d754899a700ca2fb2c3`
