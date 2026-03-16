---
name: feedback_style
description: Code quality and collaboration preferences for this project
type: feedback
---

Do things properly and professionally at all times — no quick and dirty solutions.

**Why:** User explicitly stated this at the start of the session and holds to it throughout.

**How to apply:**
- Prefer explicit, typed, well-named constructs over clever shortcuts
- When something feels like a hack (mutable shared state, implicit dependencies), raise it and propose a proper alternative
- Don't add things speculatively — only what's needed now, done right
- Keep code non-repetitive and clean; use helpers/abstractions when they genuinely reduce duplication
- When uncertain about the right approach, discuss trade-offs before implementing

