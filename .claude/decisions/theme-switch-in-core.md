# Theme switch in core: gated toggle button, own dark chrome colour, scrollbars only for dark sites

Status: accepted
Date: 2026-11-11

## Context
itsapps built a light/dark switch on its own, with a note to move it into core once a second
customer needed it. Two upcoming customers want dark mode, so it moved now. Testing itsapps in
three browsers on a dark-mode Mac showed three problems:
- **Safari** tinted its browser chrome poster red. Core's `favicons.njk` used `manifest.themeColor`
  (the web app manifest's brand colour) as the dark `theme-color`.
- **Firefox** kept dark scrollbars on an explicit light choice: on macOS it ignores the page's
  `color-scheme` for scrollbars.
- The `theme-color` meta tags followed only the system setting, never the toggle.

## Decision
- **Gated by `manifest.colorScheme: 'light dark'`.** Partial, script and inline sync render, load
  or inline nothing otherwise. `theme.css` is imported only by dark-mode sites. A light-only site
  gets nothing.
- **Toggle button with a fixed label** (`theme.dark`) **+ `aria-pressed`**, not a label that
  changes ("switch to light/dark"). The state is announced explicitly, the name stays stable for
  voice control, and it matches the icons (each shows what a click switches to). Mixing a changing
  label with `aria-pressed` is wrong. Two states only. A third "follow the system" state is a
  possible later extension.
- **Overridable:** the button partial, plus a separate icons partial with neutral classes
  (`__icon--to-dark|--to-light`), so a site swaps icons without touching button, label or script.
  The look is customer CSS.
- **`manifest.themeBgColorDark`** for the dark `theme-color`, defaulting to `themeColor` (no change
  for existing sites). `themeColor` keeps one meaning: the brand colour in the web app manifest.
- **The inline theme script syncs the `theme-color` tags** on `data-theme` (before paint and via a
  MutationObserver), so any toggle that sets `data-theme` is followed without its own code.
- **`scrollbar-color` lives in `theme.css`, not in a file every site imports.** A core-wide rule
  would recolour scrollbars on light-only sites too.

## Consequences
- A new dark-mode customer sets `colorScheme`, `themeBgColorDark`, imports `theme.css`, defines its
  colour roles in the three-block pattern (`ui-contracts.md` → "Theme switch") and styles
  `.theme-toggle`.
- The inline script changed, so its CSP hash changes. `headers.ts` recomputes it; verify it
  against the built page after editing the script.
- Chrome, Firefox and Safari follow the toggle with scrollbars and browser chrome (checked on itsapps,
  2026-11-11).
