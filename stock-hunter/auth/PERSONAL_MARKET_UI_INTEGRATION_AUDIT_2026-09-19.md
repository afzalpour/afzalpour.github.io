# Personal 4.1.7 Market UI Integration Audit — 2026-09-19

Status: IMPLEMENTED / CI + Pages PASS / authenticated browser smoke pending.

Scope:
- added authenticated staging surface `index-v417.html`;
- 4.1.6 production `index.html` unchanged;
- account identity and role shown on the 4.1.7 surface;
- Profile/Admin navigation connected;
- Preferences hydrate and persist:
  - page size;
  - Hunt filter;
  - decision filter;
  - visible columns;
  - dark/light preference;
  - sound preference;
- Watchlists connected to market rows:
  - select Watchlist;
  - create Watchlist;
  - add/remove symbol with ☆/★;
  - optional Watchlist-only filtering;
  - mobile cards supported;
- symbol identifier uses integrated `id`, verified equal to universe `ins_code`;
- all writes use authenticated publishable-key client under existing own-only RLS;
- no service-role/secret credential added to browser;
- Action Now → Radar → Universe filtering remains upstream and unchanged;
- runtime router remains CHAMPION_ONLY / 0% / kill switch engaged at implementation snapshot.

Remaining:
- CI / Pages deployment: PASS;
- authenticated browser smoke with a real human session: PENDING;
- Auth redirect configuration;
- Leaked Password Protection platform setting;
- password recovery end-to-end;
- statistical calibration/OOS/promotion gates.

## Merge evidence
- PR #207 merged.
- main commit: `b0cce246fbcd5d4bbdfc9936908f0c0130cd999d`.
- Pages deploy: PASS.
- Public Production Smoke: PASS.
- 4.1.6 `index.html` blob unchanged: `ea833fe20a75e11bb71bcf52abeaafeed46dec0a`.
