# Stock Hunter Historical Cache/Resume v4.1.9

Date: 2026-09-24
Status: READY FOR WINDOWS CLIENT CONTINUATION

## Trigger
Real v4.1.8 continuation batch:
- shortlist: 957
- ledger resolved: 280
- new batch: 75 candidates
- success: 71
- failed: 4
- network bytes: 7,636,441
- accumulated events: 277 reversal + 263 acceleration
- unresolved among first 300: 91

## Defect found
In v4.1.8, normal continue mode selected any unresolved post-bootstrap symbol, including previously failed symbols. Persistent failures could therefore reappear at the start of every batch and eventually starve unseen symbols.

## Repair
v4.1.9 makes fresh coverage and retry queues explicit:
- continue: only post-bootstrap symbols never attempted before;
- retry-first: unresolved symbols in the first 300;
- retry-post: failed symbols after the first 300;
- resolved symbols remain cache/ledger protected.

AUTO_CONTINUE_3_BATCHES_20260923 runs at most three fresh-only batches, pausing 15 seconds between batches. It stops early if fresh coverage is exhausted, a run fails, or a round reports zero success.

Persistent state remains under:
`%LOCALAPPDATA%\StockHunterHistorical`

No production 4.1.6 Hunt formula, threshold, routing, lifecycle, OOS gate or challenger state is changed.

## Verification
- go test ./...: PASS
- go vet ./...: PASS
- selftest: PASS
- Windows amd64 PE build: PASS
- ZIP integrity: PASS

ZIP SHA-256:
`558f35a039e366116db9cd13af24c7189e9fffb9d3f3459ccf31419cff215075`

Executable SHA-256:
`4703345df02663de6ef628f09de7c57b0be0faa6f2522ac69e3d646dfded59a7`
