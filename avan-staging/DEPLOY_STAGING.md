# Deploy Avan Core 1.0 RC1 to GitHub Pages staging

1. Extract `avan-staging-rc1-runtime.zip`.
2. Replace the seven files inside repository folder `avan-staging/`:
   - index.html
   - styles.css
   - config.js
   - cloud.js
   - app.js
   - manifest.webmanifest
   - sw.js
3. Commit the changes.
4. Open `https://afzalpour.github.io/avan-staging/` in a Private/Incognito window.
5. Confirm sidebar shows `Core 1.0 — RC1`.
6. Run `RC_DATABASE_VERIFY.sql` in Supabase SQL Editor.
7. Run `RLS_TWO_USER_LIVE_TEST.md`.
8. Do not replace the repository root / production page until both checks pass.
