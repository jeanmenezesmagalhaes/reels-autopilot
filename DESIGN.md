---
name: Reels Autopilot
description: A calm white sheet where the next post time and the content lifecycle read in one glance.
colors:
  ground: "#ffffff"
  ground-raised: "#f5f5f7"
  ink: "#1d1d1f"
  ink-muted: "#6e6e73"
  rule: "#d2d2d7"
  ok: "#248a3d"
  busy: "#b25000"
  bad: "#d70015"
  off: "#6e6e73"
  ground-dark: "#000000"
  ground-raised-dark: "#1c1c1e"
  ink-dark: "#f5f5f7"
  ink-muted-dark: "#a1a1a6"
  rule-dark: "#38383a"
  ok-dark: "#30d158"
  busy-dark: "#ff9f0a"
  bad-dark: "#ff453a"
  off-dark: "#a1a1a6"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body-large:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    fontFeature: "tnum"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  card: "16px"
  pill: "9999px"
spacing:
  hairline: "4px"
  stack: "12px"
  gutter-mobile: "16px"
  column-gap: "24px"
  gutter: "32px"
  section: "40px"
  nav-height: "48px"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  button-primary-compact:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-quiet:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  button-quiet-hover:
    backgroundColor: "{colors.rule}"
  button-card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  button-card-hover:
    backgroundColor: "{colors.rule}"
  segmented-track:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-item:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  segmented-item-active:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.ground-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
  input-pill:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  nav-bar:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: "48px"
---

# Design System: Reels Autopilot

## Overview

**Creative North Star: "The Calm White Sheet"**

Apple-like utility, pinned by the user: "clean like Apple systems, white with black, simple readable buttons". The page is a white sheet with black ink, one grey for everything secondary, and grey grouped surfaces that sit on it without borders or shadows. Colour is not decoration here; the Apple system greens, oranges and reds appear only when they are saying something about state.

The one loud thing is the hero figure: the next post time set very large in semibold tabular numerals, or, when there is no time to show, a state word in its system colour (Paused in orange, NOW in green while publishing, Empty in grey). Everything else steps back: 17px semibold titles, 15px body, 14px labels, all in the system font. Density is calm, not sparse: a single 1200px column with four Kanban lanes, read in one glance and closed.

The dark theme is the same sheet inverted: pure black ground, #1c1c1e grouped surfaces, Apple's dark-mode system colours. It is chosen per user (System, Light, Dark) via a `data-theme` attribute, and System follows `prefers-color-scheme`.

**Key Characteristics:**
- White (or pure black) ground, near-black ink, one muted grey.
- Grouped grey cards at 16px radius, no border, no shadow.
- Pill buttons and pill segmented controls; black is the primary, grey is the quiet one.
- System colours on status words only.
- Tabular numerals everywhere; the time is the hero.
- Translucent sticky nav bar with the only structural hairline.

## Colors

Monochrome sheet plus Apple's system state colours, each with a light and dark value bound to the same CSS custom property.

### Primary
- **Sheet Ink** (`ink`): the near-black of text, primary pill buttons, the focus ring and text selection. In dark theme it becomes Sheet White (`ink-dark`) and the primary pill turns white-on-black.

### Neutral
- **Paper White** (`ground`): page ground, the active thumb of segmented controls, the fill of small in-card pills and the input. Pure black (`ground-dark`) in dark theme.
- **Grouped Grey** (`ground-raised`): cards, segmented-control tracks, quiet buttons, the hover wash on the settings disclosure. Dark: `ground-raised-dark`.
- **Secondary Grey** (`ink-muted`): every secondary line: card details, counts, hints, empty states, inactive segments, chevrons. Dark: `ink-muted-dark`.
- **Hairline** (`rule`): the nav bar's bottom border, the idea input stroke, dividers between versions in the Versions disclosure, the settings popover edge, link underlines at rest, and the hover fill of quiet and in-card buttons. Dark: `rule-dark`.

### State (Apple system colours)
- **System Green** (`ok`): Published status, NOW while publishing, the "Worked" lane title.
- **System Orange** (`busy`): Publishing status and the Paused hero word.
- **System Red** (`bad`): Failed status, error lines, the token alert, the "Didn't work" lane title.
- **Off Grey** (`off`): Skipped status, struck through. Same value as Secondary Grey; kept as its own role so the state map stays complete.

### Named Rules
**The Status-Word Rule.** System colours colour words that name a state (status labels, the hero state word, lane titles, alerts). They never fill a surface, tint a card, or decorate a button.

**The Paired-Theme Rule.** Every colour is a CSS custom property with a light value on `:root` and a dark value under `[data-theme="dark"]` and the System media query. Components use the role (`text-ink-muted`, `bg-ground-raised`), never a raw hex.

## Typography

**Display Font:** the system stack (SF Pro on Apple; Helvetica Neue, Segoe UI, Roboto fallbacks)
**Body Font:** same stack

**Character:** One family, Apple's own, carried by weight and size alone. Semibold with tight tracking for anything that titles; regular for reading; medium for controls. Numerals are tabular on the whole body so times and counts never jitter.

### Hierarchy
- **Display** (600, 72px desktop / 60px mobile, line-height 1, tight tracking, tabular): the hero figure only: next post time or the state word.
- **Headline** (600, 24px, tight tracking, balanced wrap): the title of the next video beside the hero figure.
- **Title** (600, 17px, tight tracking): the app name in the nav bar, column headings, Results lane and aside headings.
- **Body Large** (400, 17px, snug leading): Results summary and empty prose, the learnings text, capped at prose width.
- **Body** (400, 15px): card text, buttons, segmented controls, the input, the detail line under the headline. Card titles are this size at 600.
- **Label** (500, 14px): in-card pills, the Versions disclosure, settings segments, status words (at 600), metric lines.
- Counts beside column titles sit at 16px medium in Secondary Grey.

### Named Rules
**The One-Hero Rule.** Only the hero figure uses Display. No other number on the page competes with it; per-post view counts stop at 18px semibold.

**The Tabular Rule.** Numerals are tabular everywhere (`font-variant-numeric: tabular-nums` on body), carried over from the retired departures-board direction.

## Layout

A single centred container, 1200px max, with 16px gutters on mobile and 32px from the `sm` breakpoint. The nav bar is 48px tall, sticky, full-bleed, with its contents aligned to the same container. The hero row sits 40px below the nav and wraps: the figure, then the headline block, then the action pills pushed right (stacked under on narrow screens).

The board is a grid of four lifecycle columns at `xl`, two at `md`, one on mobile, with 24px between columns and 40px between rows. Inside a column, heading, input and cards stack with 12px gaps. Results is a two-column grid at `lg` (content plus a 360px learnings aside), with its two lanes side by side at `md`. Section rhythm: 32px under the view switcher, 24px under the period switcher, 40px between major blocks.

## Elevation & Depth

Flat by default. Depth is tonal: grey grouped surfaces on a white (or black) sheet. Shadows exist in exactly two places, both Apple-native: the lifted thumb of a segmented control and the floating settings popover. The nav bar gets its separation from translucency (80% ground, heavy backdrop blur and saturation) plus one hairline.

### Shadow Vocabulary
- **Segment thumb** (`box-shadow: 0 1px 3px rgba(0,0,0,0.12)`): the active item in any segmented control.
- **Popover** (`box-shadow: 0 10px 30px rgba(0,0,0,0.12)`): the settings disclosure panel, together with a hairline border.

### Named Rules
**The Flat Card Rule.** Cards have no border and no shadow. A grey surface on the sheet is enough.

## Shapes

Two radii only. Everything you press or type into is a full pill (9999px): buttons, inputs, segmented tracks and their items, the settings disclosure. Everything that holds content is a 16px rounded rectangle: cards, Results rows, the settings popover. Lines are 1px hairlines in `rule`. The only glyph is a thin stroked chevron (1.75 stroke, rounded caps) that rotates 90 degrees as a disclosure opens.

## Components

### Buttons
Simple, readable pills. Labels are sentence-case verbs ("Resume posting", "Post now", "Mark recorded").
- **Shape:** full pill (9999px).
- **Primary:** Sheet Ink fill, Paper White text, 15px medium, 8px by 20px. One per area: the main action (Post now, or Resume while paused).
- **Primary compact:** same fill at 8px by 16px, beside the idea input (Add).
- **Quiet:** Grouped Grey fill, ink text, same size as primary. The secondary action (Pause).
- **In-card:** Paper White pill on a grey card, 14px medium, 4px by 12px (Drop, Mark recorded, Skip, Retry).
- **Hover / Focus / Press:** primary dims to 85% opacity; quiet and in-card fill with Hairline grey; a 2px ink focus ring at 2px offset; a 0.97 press scale over 150ms. While pending the label swaps to a progress word or an ellipsis, the cursor waits and the pill drops to 50% opacity.

### Segmented Control (signature)
The view switcher (Board / Results), the Results period switcher and the settings language/theme groups.
- **Track:** Grouped Grey pill with 4px inset.
- **Items:** pills, 15px medium (14px in settings), Secondary Grey; hover to ink.
- **Active:** Paper White thumb, ink text, segment-thumb shadow. Links mark it with `aria-current`, buttons with `aria-pressed`.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Grouped Grey.
- **Shadow Strategy:** none (see Flat Card Rule).
- **Border:** none.
- **Internal Padding:** 12px by 16px, 15px text. A semibold title, then Secondary Grey detail lines, then actions right-aligned or a Versions disclosure.

### Inputs / Fields
- **Style:** full pill, Paper White fill, 1px Hairline stroke, 8px by 16px, 15px, Secondary Grey placeholder. Labels are visually hidden, not dropped.
- **Focus:** the stroke turns ink.

### Navigation
- **Nav bar:** 48px, sticky, translucent ground with backdrop blur, hairline below. App name left in Title type; right side holds the running state in Secondary Grey (hidden on mobile) and the settings disclosure: a ghost pill reading "Language · Theme" with a chevron, washing grey on hover, opening a 16px-radius popover with two segmented controls.

### Hero Figure (signature)
The next post time in Display, or a state word in its system colour. The headline and a Secondary Grey detail line sit beside it, bottom-aligned; the action pills sit on the far right.

### Versions Disclosure
A native `details` element inside a card: a chevron plus "N versions" in 14px medium grey. It opens to a list split by hairlines; each row has the version label (underlined link when published), a semibold status word in its system colour, a grey metric line and, where relevant, an in-card pill.

## Do's and Don'ts

### Do:
- **Do** keep the sheet monochrome: Paper White, Grouped Grey, Sheet Ink, Secondary Grey; colour only the words that name a state.
- **Do** make every pressable thing a pill and every content holder a 16px card.
- **Do** use the black pill for the one main action of an area and the grey pill for the rest.
- **Do** switch views and periods with a segmented control, never tabs with underlines.
- **Do** bind every colour to its role token so light and dark stay paired.
- **Do** keep numerals tabular and reserve Display for the hero figure.

### Don't:
- **Don't** add borders or shadows to cards; depth is tonal. Shadows belong only to the segment thumb and floating popovers.
- **Don't** use system colours as fills, tints or button colours.
- **Don't** add KPI tiles, charts or decorative chrome; the brief refuses them.
- **Don't** introduce a second typeface or a third radius.
