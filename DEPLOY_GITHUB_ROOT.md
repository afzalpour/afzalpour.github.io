# Deploy Avan Core 1.0 to GitHub Pages root

## 0. Keep rollback material
Before replacing the current root files, download/keep a ZIP or Git snapshot of the current production root.
Do not delete `/avan-staging/` until the production smoke test passes.

## 1. Files to deploy
Upload/replace exactly these runtime files at the repository root:
- index.html
- styles.css
- config.js
- cloud.js
- app.js
- manifest.webmanifest
- sw.js

For `afzalpour/afzalpour.github.io`, these files belong directly at repository root, not inside `avan-staging`.

## 2. Commit
Suggested commit message:
`release: Avan Core 1.0 production candidate`

## 3. Open production
Open:
`https://afzalpour.github.io/`

Use a private/incognito window for the first check to avoid stale app state.

## 4. Run the production smoke test
Follow `PRODUCTION_SMOKE_TEST.md`.

## 5. After pass
Keep `/avan-staging/` only as a temporary rollback/reference environment. It can be removed after production is stable and a repository tag/backup exists.
