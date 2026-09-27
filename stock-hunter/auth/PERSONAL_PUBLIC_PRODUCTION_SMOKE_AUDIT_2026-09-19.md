# 4.1.7 Personal Public Production Smoke Extension — 2026-09-19

Status: IMPLEMENTED / workflow execution pending.

The canonical public production smoke now fetches from GitHub Pages and compares byte-for-byte:
- `index-v417.html`
- `app-personal-v417.js`
- `personal-v417.css`

Runtime markers additionally verify:
- the 4.1.7 personal page loads the personal JS/CSS assets;
- missing session redirects to `auth-v417.html?next=index-v417.html`;
- personal Preferences table integration exists;
- personal Watchlist integration exists;
- the Preferences browser payload contains only explicitly granted fields;
- protected `updated_at` is not written by the browser payload;
- Watchlist star saved-state CSS is present.

The workflow remains read-only and performs no application mutation.

Purpose:
The assistant's direct web fetch path cannot retrieve the GitHub Pages JS asset in this environment. GitHub Actions performs the external fetch independently and provides deployment-integrity evidence.
