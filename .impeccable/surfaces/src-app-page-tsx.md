---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/board.tsx","src/app/results.tsx"]
---

# Surface: Painel (src/app/page.tsx, board.tsx, results.tsx)

Mode: operate. Single user (Jean), mostly MacBook browser, quick daily check. Jobs: is it running, what posts next and when, where each piece of content is in its lifecycle (Kanban), what worked by period, add an idea. Actions: pause/resume, post now, skip/retry a version, add/drop/mark-recorded an idea, language and theme. Essential only; the system moves cards by itself.

## Direction contract

Brief-pinned by the user on 25 out 2026: "clean like Apple systems, white with black, simple readable buttons". This replaces the departures-board direction (seed:04249bff800b01a8), which is retired; its tabular-numerals and stamped-states discipline is kept.

THESIS: A calm white sheet where the next post time and the content lifecycle read in one glance. Refuses KPI tiles, charts and chrome.

OWN-WORLD: White #ffffff ground, #f5f5f7 grouped surfaces, #1d1d1f ink, #6e6e73 secondary, #d2d2d7 hairline under the nav bar only; Apple system state colours (green/orange/red) on status words only; system font stack (SF Pro on Mac); pill buttons (black primary, grey secondary); segmented control for views and periods; 16px-radius grouped cards with no border or shadow. Dark theme is pure black with #1c1c1e surfaces.

STORY: Jean opens it, reads the next post time, scans the four columns, checks Results for the period, closes it.

FIRST VIEWPORT: 48px nav bar (name left, status + "Language · Theme" disclosure right). Hero row: next post time at 72px semibold tabular, headline + detail beside it, Pause/Resume and Post now pills right. Segmented control Board/Results. Four Kanban columns: Planned (idea input on top), Editing, Queued, Published.

FORM: Apple-like utility, brief-pinned by the user. seed:04249bff800b01a8 (the rolled departures-board direction, retired by the user pin). Signature move: the time as the hero figure, updating state words (NOW while publishing).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
