# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: Jean, founder (Sidemed) who records short raw videos and wants them edited and tested as Instagram Trial Reels without managing the process. Opens the dashboard mostly on the MacBook browser, occasionally on the phone. Checks in briefly: is it running, what's queued, what performed, what to change next.

## Product Purpose

Turn raw recordings dropped in a Mac folder into 5+ edited variants each, publish them over time as Instagram Trial Reels (non-followers only), measure results, and feed what worked back into editing and into the next recording script. Success: Jean drops a video and does nothing else until he reads the learnings. Instagram is the validation channel; TikTok may follow later.

## Positioning

A personal content copilot, not a social media manager: it owns editing, A/B variants, pacing and analysis for one creator.

## Operating Context

- Editing and analysis run as scheduled Claude routines on the Mac (`pipeline/EDIT_PROMPT.md`, `pipeline/ANALYZE_PROMPT.md`).
- Posting runs on Vercel cron; dashboard is a password-protected page on `*.vercel.app`.
- Content mix: mostly entrepreneurship and tech, Sidemed, some personal. Language pt-BR.

## Capabilities and Constraints

- Every post is a Trial Reel; graduation to followers only happens manually in the Instagram app.
- Variant statuses: na fila, processando, publicado, falhou, pulado.
- Metrics per published variant: views, reach, likes, comments, shares, saves, average watch time.
- Actions: pause/resume posting, post next now, skip a queued variant, retry a failed one.

## Product Principles

1. Only what is essential. If a screen element isn't needed day to day, it doesn't exist.
2. Zero friction: no setup steps, no forms, no navigation for routine checks.
3. The system works without the dashboard; the dashboard only answers "is it running, what's next, what worked".
4. Nothing sensitive leaves the server: no tokens or keys in the page, URLs or client bundle.
