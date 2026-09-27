# Stock Hunter AI + Jalali Calendar + PDF Audit — 2026-09-26

## Scope
User-approved implementation of:
1. symbol-detail intelligent Hunt assistant;
2. Persian natural-language Strategy Builder;
3. intelligent end-of-market report;
4. historical similar-Hunt retrieval;
5. reliability diagnostic assistant;
6. calendar-grid-only date selection;
7. Print / Save as PDF across Hunt Analysis research pages.

## Frozen-engine safety
- Frozen Hunt remains `4.1.6-hunt-v2`.
- No Hunt formula, threshold, state classifier, lifecycle gate, capture provenance, routing state or activation state was changed.
- AI/analysis outputs are explanatory and research-only.

## AI implementation
- New research surface: `ai-center-v417.html` / `ai-center-v417.js`.
- New main-detail enhancement: `app-ai-assistant-v417.js`.
- Strategy Builder accepts Persian prose and converts it to visible/editable rules before execution.
- Similar historical Hunts use recorded feature distance and observed outcomes; they do not create a new success probability.
- Daily report combines Journey, missed opportunities, backtest summary and reliability.
- Reliability assistant separates feed/capture evidence from model-outcome evidence.
- Deterministic local analysis remains available without external generative inference.

## Secure generative path
- Supabase Edge Function: `stock-hunter-ai-v417`, deployed version 2.
- `verify_jwt=false` is intentional because the function performs explicit user-session validation against Supabase Auth in server code and exposes only an unauthenticated health probe.
- Authenticated requests are rate-limited in the Edge isolate and payload size is bounded.
- No OpenAI secret is present in browser code.
- Health probe at implementation time: `configured=false`; no `OPENAI_API_KEY` or AI-named Vault secret existed.
- Therefore generative enrichment is ready but not currently enabled; local data-grounded behavior is the active fallback until the server secret is configured.
- Unauthenticated POST regression probe returned HTTP 401 / `AUTH_REQUIRED`.

## Jalali calendar contract
Current selectable-date fields were found in:
- Hunt Journey;
- Market Replay;
- Backtest Lab;
- Missed Opportunities;
- Alert Center;
- Reliability;
- Strategy Builder;
- AI Center.

All are read-only text fields and are selected using the shared monthly Persian calendar grid in `research-tools-v417.js`.
CI rejects native `type="date"` and any `.jalali-input` that is not read-only.

## Print / PDF contract
`research-tools-v417.js` injects `چاپ / ذخیره PDF` into every research navigation surface.
Print CSS:
- removes controls/navigation;
- expands scroll-limited tables;
- switches to print-safe white background;
- preserves current filtered/report content.

## Cache / delivery
Service Worker revision: `shikar-sahm-v4.1.6-r18`.
New AI, calendar and research assets are pre-cached.
