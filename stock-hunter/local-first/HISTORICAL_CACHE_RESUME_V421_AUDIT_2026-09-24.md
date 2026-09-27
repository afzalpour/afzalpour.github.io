# Historical Cache/Resume v4.2.1

Date: 2026-09-24

Trigger: v4.2.0 correctly classified all 15 unresolved post-300 symbols as terminal NO_TRADES (both TradeHistory variants empty), then failed only while rendering HTML because the Report struct lacked LedgerNoTrades.

Repair:
- add LedgerNoTrades to Report;
- populate it during final aggregation;
- add offline --mode report;
- add REBUILD_REPORT_20260923.cmd;
- extend selftest with an HTML report smoke test so this class of template/struct mismatch fails before packaging.

State safety:
- v4.2.0 saved the ledger after every symbol, so the 15 NO_TRADES classifications are expected to remain persisted despite the final report-render failure.
- persistent state remains under %LOCALAPPDATA%\StockHunterHistorical.

Verification:
- go test ./... PASS
- go vet ./... PASS
- selftest PASS
- offline status/report smoke PASS
- Windows amd64 PE build PASS
- ZIP integrity PASS

ZIP SHA-256:
843b3c394a2a11fd7308d5cd8d0988982e051f07fcd5c20862f04d579a76f9bb

EXE SHA-256:
75ee3110f6b9834196562c8ff2fa062381cdd5fbac9664a0ed1d56157f1c1090

Production Hunt 4.1.6 formulas/thresholds/routing/lifecycle remain unchanged.
