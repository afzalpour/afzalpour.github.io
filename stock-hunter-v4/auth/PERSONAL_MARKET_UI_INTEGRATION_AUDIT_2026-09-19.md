# Personal 4.1.7 Market UI Integration Audit — 2026-09-19

Status: IMPLEMENTED / awaiting post-deploy authenticated smoke.

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
- CI / Pages deployment;
- authenticated browser smoke;
- Auth redirect configuration;
- Leaked Password Protection platform setting;
- password recovery end-to-end;
- statistical calibration/OOS/promotion gates.
