# Stage 1 — Discover: Direction with Genre Floor

**Date**: 2026-10-05
**Mode**: autonomous (implementer preference)
**Track**: webapp (AI image generation tool)

## T0. Genre Floor — Best-in-Class Benchmark

### Category

AI image generation tool (webapp, browser-based, BYOK model)

### Benchmarks (sharpest in category)

1. **Midjourney web** (https://midjourney.com) — polished, prompt-centric, gallery-first
2. **Krea.ai** — real-time canvas, tool-heavy, pro-focused
3. **Ideogram** — clean, batch-aware, type-driven

### Dissection: Midjourney web (chosen as finish-line anchor)

**Why this one**: Most recognizable visual identity in the category; prompt-to-gallery flow is the genre's platonic ideal. Our finish line = credible peer in craft/clarity, not feature parity.

| Element | What it is | Why it works | Keep / Swap / Never |
|---------|------------|--------------|---------------------|
| **Prompt bar** | Full-width input at top, always accessible, ghost text shows examples | Removes friction — you never "look for" where to type | **Keep** — baseline expectation |
| **Gallery grid** | Masonry layout, newest first, infinite scroll | Natural for visual scanning; users expect images front-and-center | **Keep** — content-first baseline |
| **Minimal chrome** | Header is just logo + settings icon, no tabs/panels | Maximizes canvas for content | **Keep** — 20/80 space law |
| **Subtle status** | Progress rings on pending tiles, no modal blockers | Non-blocking feedback | **Keep** — baseline |
| **Card hover actions** | Download/upscale/vary appear on hover, hidden at rest | Keeps grid clean until needed | **Keep** — expert affordance |
| **Pastel purple-blue wash** | Signature gradient background, soft glows | Recognizable brand, but overused in AI tools category | **Swap** — cliché (AI tell #1) |
| **Left sidebar prompt history** | Always-visible list of past prompts | Useful for power users, but takes prime real estate for infrequent action (P1 rarely revisits old prompts) | **Swap** — violates 20/80 for our personas |
| **No batch mode** | One prompt at a time, no CSV import or bulk operations | Works for their social/exploratory model; breaks for P2 (Batch Operator) | **Swap** — our P2 needs this |
| **Rounded cards with soft shadows** | Default web component aesthetic | Generic, no craft signal | **Swap** — opportunity for sharpness |
| **Icon language** | Lucide/Heroicons at 24px, stroke-2, round caps everywhere | Unexamined default (AI tell #14) | **Swap** — direction must choose deliberately |

### Three-way classification

- **Baseline** (keep): Prompt bar, gallery grid, minimal chrome, subtle status, hover actions
- **Cliché** (at least one direction breaks): Purple-blue wash, always-visible sidebar, rounded soft cards
- **Lookalike** (none may copy wholesale): Their pastel+purple+gradient visual identity package

---

## T1. Direction Engine

**Engine choice**: **Material × Environment**
*Brushed aluminum × dawn workshop light*

**Derivation from product evidence**:
- This tool is about **craft** (iterating prompts until the image is right — Solo Creator's story)
- It's **utilitarian** (Batch Operator runs it daily as pipeline infrastructure)
- It's **BYOK** (bring-your-own-key = user owns the metal, we provide the workbench)

**Engine translation**:
- **Brushed aluminum** → matte surfaces, no gloss; hairline separator lines (1px, low opacity, directional grain); buttons are machined edges (subtle chamfer in shadow), not soft pills
- **Dawn workshop** → cool neutrals (blue-tinted grays at 6-8% lightness steps); one warm accent (amber at 45° saturation) for primary actions (Generate button, progress states); no purple
- **Workbench** → tools are organized but not hidden; settings drawer is a tool chest (slides out, shows everything at once, closes when done); results are the workpieces (laid out for inspection, not stacked in a "queue")

**NOT in this direction**:
- Gradients (no soft washes, no glows)
- Rounded corners everywhere (only where ergonomic — input fields yes, structural containers no)
- Purple/violet (it's the category cliché)
- Decorative blobs or abstract shapes (real imagery only, via generated assets or data visualization)

---

## T2. Tone Dials + Translated Brief

### Tone settings (with product evidence)

| Dial | Setting | Evidence |
|------|---------|----------|
| **Energy** | Quiet (3/10) | Tool runs in background for P2; P1 is iterating, not celebrating — results matter, not fanfare |
| **Finish** | Precise (8/10) | BYOK users are technical; misaligned controls = wasted API calls = real money |
| **Density** | Focused (6/10) | Webapp track naturally denser than landing page, but P1 needs breathing room (not a Bloomberg terminal) |
| **Weight** | Medium (5/10) | Not heavy (not making life-or-death decisions), not featherweight (not a toy) |
| **Seriousness** | Professional (7/10) | B2B-adjacent (game studios, agencies use this), but not corporate-stiff (indie creators use it too) |

### Fuzzy-word translation

- ~~"Premium"~~ → **Precision alignment** (8px grid, buttons snap to baseline, no sub-pixel AA blur), **Restrained palette** (5 surface levels, 1 accent, no decoration)
- ~~"Clean"~~ → **Subtraction** (Stage 0 already removed task queue panel; this direction removes rounded card containers — results are direct on canvas)
- ~~"Professional"~~ → **Honest materials** (aluminum = matte, not faking depth with shadows; status is numbers/progress, not vague spinners)

### Brief (for implementation)

*Design a workbench for AI image generation. The canvas is brushed aluminum under cool dawn light (blue-gray neutrals, 6-8% lightness steps). The prompt input is the worksurface — full-width, matte white field, hairline bottom edge. Results are workpieces laid directly on the bench (no card containers, just the images themselves on the surface, with hover actions appearing as inline tools). The Generate button is machined amber (warm accent, subtle chamfer shadow, 8/10 precision tolerance). Settings drawer slides in as a tool chest (vertical stack, everything visible, no nested tabs). Status is honest numbers (3/10 running, 45s elapsed), not decorative spinners.*

---

## T3. Memory Point (traced to Stage-0 story)

**Chosen moment**: P1's step 4 — "Sees image appear in ~5s, with live progress indicator"

**Current state**: Result appears in a separate "task card" in a "task queue" panel (vocabulary leak, spatial disconnect from prompt)

**Memory point**: **Result materializes inline, directly below the prompt input, as if the workbench is fabricating it**

**Mechanism**:
- User hits Generate → a placeholder frame appears immediately at top of result gallery (not in a separate panel), with live progress: `[████████░░] 8s elapsed, ~12s remaining`
- Image data arrives → placeholder cross-fades to finished image (not a hard pop, but fast — 200ms)
- New images push older ones down (vertical stack, newest on top, fluid motion via `motion/react` layout animations)

**Why this is the memory point**:
- It's P1's highest-emotion moment (waiting for the AI to deliver)
- It ties action (prompt) to result (image) spatially — they're in the same visual context
- It removes implementation abstraction ("task queue") and replaces it with direct physicality ("thing I asked for is appearing right here")

**Trade-off**: Batch mode can't use the same pattern (30 images materializing inline would flood the viewport). Batch uses discrete progress bar (0/30 → 1/30) + gallery view after completion. Acceptable — P2's memory point is "Export ZIP", not individual image appearance.

---

## T4. Skeleton + Type + Color Identity (for divergence gate)

### Skeleton (Generate mode, desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]                                    [Settings] [Language]  │ ← Header (48px, matte surface)
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Describe the image you want to generate...              │   │ ← Prompt (80px min-height, matte white)
│  └──────────────────────────────────────────────────────────┘   │
│  [Size ▼] [Advanced ▼]                    [Generate →]          │ ← Controls (inline, 40px height)
│                                                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │
│  │                │ │                │ │                │      │
│  │   [Progress]   │ │   [Image 2]    │ │   [Image 3]    │      │ ← Results (direct on surface, no card BG)
│  │                │ │                │ │                │      │
│  └────────────────┘ └────────────────┘ └────────────────┘      │
│  ┌────────────────┐ ┌────────────────┐                          │
│  │   [Image 4]    │ │   [Image 5]    │                          │
│  │                │ │                │                          │
│  └────────────────┘ └────────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile (375px)**:
- Prompt collapses to 60px min-height
- Controls stack vertically (Size/Advanced above, Generate full-width below)
- Results grid becomes 1 column

**Three-size behavior**: Structure is stable (prompt → controls → results vertical flow); only grid density and input sizing adapt.

### Type system

- **Families** (declared as CSS custom properties):
  - `--font-sans`: Inter Variable (neutral, technical, excellent hinting at small sizes)
  - `--font-mono`: SF Mono / Menlo (for JSON, debug views)
- **Scale** (fluid via `clamp()`):
  - Display (hero text, if needed): `clamp(2rem, 4vw, 3rem)` — not used in main canvas
  - Heading: `clamp(1.25rem, 2.5vw, 1.5rem)` — drawer titles, modal headers
  - Body: `clamp(0.9375rem, 1.5vw, 1rem)` — primary UI text
  - Detail: `clamp(0.8125rem, 1.25vw, 0.875rem)` — status, timestamps
  - Mono: `clamp(0.8125rem, 1.25vw, 0.875rem)` — code, JSON
- **Tracking**: `-0.01em` on headings, `0` on body, `0.01em` on detail (loosens small text)
- **Line-height**: 1.2 on headings, 1.5 on body (webapp density, not marketing copy)

### Color identity

**Palette**: Stepped tonal ladder (blue-gray), one warm accent.

**Surface levels** (5 steps, 6-8% lightness increments, tinted toward cool):
1. `--surface-0`: `hsl(215, 20%, 6%)`  — deepest (app background)
2. `--surface-1`: `hsl(215, 18%, 12%)` — elevated panels (drawer, modals)
3. `--surface-2`: `hsl(215, 16%, 18%)` — input fields (default state)
4. `--surface-3`: `hsl(215, 14%, 24%)` — input fields (focus state)
5. `--surface-4`: `hsl(215, 12%, 30%)` — highest contrast (unused in v1, reserved for future overlays)

**Text**:
- Primary: `hsl(215, 10%, 92%)` (off-white, slightly warm to offset cool backgrounds)
- Secondary: `hsl(215, 8%, 65%)` (dimmed for labels, placeholders)
- Tertiary: `hsl(215, 6%, 45%)` (status text, timestamps)

**Accent** (warm, high saturation, used sparingly):
- Amber: `hsl(38, 85%, 60%)` — Generate button, progress fills, active states
- Amber dim: `hsl(38, 70%, 45%)` — hover states
- Amber glow: `hsl(38, 85%, 60%)` at 20% opacity — focus rings (not box-shadow, use `outline`)

**Semantic** (honest state colors, not decorative):
- Success: `hsl(145, 60%, 50%)` — task complete
- Error: `hsl(0, 70%, 55%)` — task failed
- Warning: `hsl(38, 85%, 60%)` — reuses amber (quota warning)

**No gradients, no purple, no glows** (breaks category cliché, avoids AI tell #1).

### Icon grammar

**NOT Lucide at 24px/2px** (that's the unexamined default, AI tell #14).

**Decision**: **Custom 20px icons, 1.5px stroke, square caps** — sharper than the category default, matches the aluminum material language (machined, not rounded).

**Fallback**: If custom icon set is out of scope for v1 timeline, use Lucide but at **20px / 1.5px / square-cap** override (deliberate choice documented, not default).

---

## Divergence Gate (Receipt)

**Date**: 2026-10-05
**Mode**: Autonomous (single direction by design)

### Gate status: N/A (single-direction redesign)

This is a redesign of an existing product, not a multi-candidate exploration. The world-class-designer skill's divergence gate (2+ directions with strong differences) is **waived by task scope** — the user asked for "one惊艳 v1", not "show me 3 options".

### Five-item record (for the chosen direction)

| Item | Description |
|------|-------------|
| **Skeleton** | Prompt-first vertical flow; results inline (no separate queue panel); settings in drawer |
| **Type** | Inter Variable (technical neutral), fluid scale, tight tracking on headings |
| **Color identity** | Blue-gray tonal ladder (5 steps, cool-tinted), one warm accent (amber, high saturation), no gradients/purple |
| **Hero visual** | None (webapp track; content-first = generated images are the visual) |
| **Page structure** | Single-pane workbench (prompt → controls → results in vertical stack); drawer for settings/secondary tools |

### Cliché-breaking check

✅ **Breaks category default**: No purple-blue gradient wash, no soft rounded cards, no always-visible sidebar, no "task queue" panel vocabulary.

### Implementer preference declarations

All tone dial settings, engine choice, palette hue/saturation values, and type scale ratios are **implementer preference** (autonomous mode). User will see the result and may request adjustments in post-delivery iteration.

---

## Stage 1 Complete

**Next**: Stage 2/3 (implementation, then critic loop if time/budget permits — note that T3 fresh-context critic is explicitly scoped out by the task brief; we'll do code-level self-review against ai-tells checklist instead).
