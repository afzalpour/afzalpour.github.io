# Stock Hunter — Search Typeahead UX Audit

DATE: 2026-09-21
STATUS: IMPLEMENTED_IN_PR / DEPLOYMENT_PENDING
SCOPE: 4.1.6 public UI + 4.1.7 personal staging UI

## User-visible issue

The search input rendered typed characters with noticeable latency because the input event synchronously called the full table/mobile `render()` path. A second Universe listener also scheduled remote work for the same keystroke.

The search field also had no discoverable symbol/company suggestion list.

## Implementation

Shared runtime changes apply to both `index.html` (4.1.6) and `index-v417.html` (4.1.7):

- synchronous full render was removed from the search `input` event;
- search-result rendering is debounced by 110 ms;
- native input paint is allowed to complete before suggestion computation;
- the full `stock_hunter_universe_v4` catalog is normalized/indexed locally;
- autocomplete shows up to 10 matching symbols/companies;
- ranking priority:
  1. exact symbol
  2. symbol prefix
  3. company prefix
  4. symbol contains
  5. company contains
  6. normalized compact contains
- Persian/Arabic letter variants are normalized (`ي/ى→ی`, `ك→ک`) and Persian digits are normalized;
- dropdown supports mouse, touch/pointer, Arrow Up/Down, Enter and Escape;
- selecting a suggestion writes the symbol into the search field and immediately filters the universal browser;
- the old server-side Universe typeahead path remains only as a fallback while the full local catalog is unavailable;
- periodic market refresh defers a full render briefly if the user has just typed.

## Accessibility

The search input is upgraded at runtime to an ARIA combobox:
- `role=combobox`
- `aria-autocomplete=list`
- `aria-controls=searchSuggestionsV416`
- suggestion container uses `role=listbox`
- each suggestion uses `role=option`
- active keyboard option is exposed through `aria-activedescendant`.

## Shared-version behavior

4.1.6 and 4.1.7 intentionally load the same:
- `app-runtime.js`
- `app-universe.js`
- `app-universal-search-v416.js`
- `styles.css`

Therefore the search fix is behaviorally identical in both surfaces. 4.1.7 Auth/Profile behavior is unchanged.

Modified assets use the cache-buster suffix `4.1.6-search1`; product/scoring versions are unchanged.

## Safety

Unchanged:
- Hunt engine: `4.1.6-hunt-v2`
- scoring formulas and thresholds
- market freshness rules
- production routing
- 4.1.7 lifecycle state
- Supabase write paths
- Auth/Profile RLS

The search remains outside Hunt/session constraints and can discover the full Universe.

## Verification contract

PR CI must prove:
- JavaScript syntax PASS;
- deterministic search/EOD smoke PASS;
- Persian normalization and typeahead ranking PASS;
- no direct search-input full render remains in `app-runtime.js`;
- combobox/keyboard markers exist;
- both 4.1.6 and 4.1.7 pages load the cache-busted shared search asset;
- Main Integration Gate PASS.

Post-merge must additionally prove:
- Public Production Smoke PASS with deployed bytes matching repository for `app-runtime.js`, `app-universe.js`, `app-universal-search-v416.js`, and `styles.css`;
- GitHub Pages deployment PASS on the final main SHA.
