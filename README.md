# Cab Books

Income, expenses and VAT tracking for London taxi drivers (All Black Taxis).

- `web/public/` – the live website (Netlify publishes this folder on every push to `main`).
- `netlify/functions/arrivals.mjs` – airport arrivals (needs `AERODATABOX_KEY` set in Netlify).
- `firestore.rules` – Firebase security rules (paste into Firebase console → Firestore → Rules).
- `src/` – the app source and `build_web.py`. To rebuild: `cd src && python3 build_web.py source_index.html`, then copy `src/web/public/index.html` over `web/public/index.html`.
