# Stage 0 — Frame: Personas and Information Architecture

**Date**: 2026-10-05  
**Mode**: autonomous (implementer preference throughout)

## Personas

### P1: Solo Creator (novice path, primary)

**Who**: Independent artist, content creator, or hobbyist exploring AI image generation.

**Context**: Working alone on personal projects, blog illustrations, or social media content. Limited budget (BYOK to avoid subscription fees). Discovers the tool via search/GitHub.

**Core goal**: Generate a few images quickly, iterate on prompts until one looks right, download and move on.

**Intuition**: Types what they want to see, clicks Generate, tweaks the prompt when the result is close but not quite there. Expects instant visual feedback. Does NOT think in terms of "tasks" or "queues" — those are implementation details bleeding through.

**Frequency map**:
- **Daily**: Single image generation (prompt → generate → preview → download)
- **Weekly**: Adjust size/model, browse previous results
- **Rarely**: Batch operations, advanced JSON, mask editing, Vision analysis

**Story (acceptance budget)**:
1. Opens app → sees prompt input front and center (0 clicks)
2. Types "a serene mountain lake at sunset" (typing)
3. Clicks Generate or presses Enter (1 click)
4. Sees image appear in ~5s, with live progress indicator (0 clicks, time passes)
5. Likes it → hovers to reveal download button → saves (1 click)
6. Wants to tweak → edits prompt in place, regenerates (1 click)
7. **Total**: 3 clicks, all on the main action path

**Breaks the budget**: Settings modal blocks the canvas; must close settings to see results; "task queue" vocabulary; having to switch between four equal-weight "workspaces" when 90% of the time they only need text→image.

---

### P2: Batch Operator (expert path, secondary)

**Who**: Game studio artist, dataset builder, or design agency producing volume work.

**Context**: Needs 50+ variations of a prompt, or testing the same scene across multiple models/seeds. Organized filesystem, cares about filenames. Uses the tool daily as part of a pipeline.

**Core goal**: Queue up a list of prompts (or one prompt × 50 seeds), let it run in the background, bulk download as ZIP with sane names, import into next pipeline step.

**Intuition**: Paste a column from a spreadsheet, set shared parameters once, hit "Run batch", walk away, come back to a ZIP. Expects the tool to remember parameters across sessions (form state persistence). Thinks in terms of "this batch" vs "that batch" — batches have identity.

**Frequency map**:
- **Daily**: Batch generation, ZIP export
- **Weekly**: Batch rename (game assets), Vision OCR (extract labels from generated UI mockups)
- **Rarely**: Single image generation (already has a working prompt, just needs one more variant)

**Story (acceptance budget)**:
1. Opens app → navigates to Batch mode (1 click via clear affordance, not hunting)
2. Pastes 30 prompts from spreadsheet (paste action)
3. Sets shared size + model once for the whole batch (2 inputs)
4. Clicks "Generate batch" (1 click)
5. Switches to another tab, works on something else (0 interaction)
6. Returns 10 minutes later → sees "30/30 complete" (0 clicks, status is visible)
7. Clicks "Export ZIP" → saves `batch-2026-10-05.zip` (1 click)
8. **Total**: 4 clicks + 2 inputs, most time is unattended

**Breaks the budget**: Re-entering model/size for every batch (form state not persisted); no batch identity (can't tell "morning batch" from "afternoon batch" without inspecting every image); ZIP naming is opaque; can't resume a half-finished batch after closing the tab.

---

## Sandbox Iteration (20/80 space allocation)

### Round 1: Block set (everything imaginable)

**Direct space (on-canvas, always visible)**:
- Prompt input (multi-line textarea)
- Generate button
- Real-time result gallery (generated images, newest first)
- Live status (X/Y running, progress bars)
- Settings panel (API key, base URL, model, concurrency)
- Size picker
- Advanced JSON textarea
- Image count slider
- Input image upload (for img2img)
- Mask editor
- Vision prompt + image upload
- Batch prompt list
- Batch rename controls
- Task history list
- Image library browser
- Debug view (raw JSON request/response)
- Cost estimation
- Language switcher

**Secondary entries (tabs/drawer/menu, 1-2 clicks)**:
- (empty in v1)

**Deep storage (3+ clicks or separate pages)**:
- (empty in v1)

**Assessment**: Information overload. Every feature at the same visual weight. Solo Creator is drowning; Batch Operator can't focus on batch controls because single-image controls are screaming at the same volume.

---

### Round 2: Novice pass (Solo Creator's 20%)

**Keep on-canvas**:
- Prompt input (primary action)
- Generate button (primary trigger)
- Result gallery (primary feedback) — newest 3-6 images, large previews
- Live status indicator (subtle, per-task progress)

**Move to secondary**:
- Settings (drawer/modal — set once per session, rarely changed mid-workflow)
- Size picker (defaults to 1024x1024; power users can override in secondary)
- Advanced JSON (expert escape hatch)
- Image count (defaults to 1; changing it is batching, which is P2 territory)
- Input image upload (img2img is a mode switch, not the default landing)
- Mask editor (nested within img2img mode)
- Vision (separate tool, different mental model)
- Batch (separate tool)
- Batch rename (separate tool)
- Task history (archive view, accessible but not on-canvas)
- Image library (archive view)
- Debug view (per-task detail, opened on-demand)
- Cost estimation (per-task detail, visible in task card but not blocking canvas)
- Language switcher (footer or settings)

**Assessment**: Canvas is now breathable. P1 sees prompt → button → results. Settings are 1 click away (drawer icon in header). But we've moved *too much* — size is common enough to keep on-canvas with smart defaults.

---

### Round 3: Expert pass (Batch Operator's needs)

**Bring back to canvas (when in Batch mode)**:
- Batch prompt list (primary input for P2)
- Shared parameters (size, model, count-per-prompt)
- Batch identity input (optional name/tag)
- Batch progress (X/Y complete, ETA)
- Export ZIP button (primary output for P2)

**Architecture decision**: Two **modes**, not four equal "workspaces":
1. **Generate mode** (default): P1's canvas (prompt → button → results) + secondary drawer for settings/advanced
2. **Batch mode**: P2's canvas (prompt list → shared params → batch progress) + same settings drawer

Vision and Batch Rename are lower frequency even for P2 → move to **tertiary access** (tabs within Batch mode, or separate drawer items).

---

### Round 4: Convergence (persona-stable)

**Direct space (80% visual area, mode-dependent)**:

**Generate mode** (default landing, P1 optimized):
- Prompt input (multi-line, center stage)
- Generate button (primary action, prominent)
- Result gallery (3-6 newest images, large cards with hover actions)
- Per-task status (subtle progress indicator within result card)

**Batch mode** (tab/drawer item, P2 optimized):
- Prompt list textarea (paste CSV or one-per-line)
- Shared parameters (size, count-per-prompt, inline above list)
- Batch progress bar (X/Y, ETA if estimable)
- Export ZIP button (primary CTA when batch is complete)

**Secondary space (drawer, 1 click from canvas)**:
- Settings (API key, base URL, model, concurrency)
- Advanced params (JSON textarea, applies to current mode)
- Image library (grid view, search/filter, bulk delete)
- Task history (archive list, reuse params)

**Tertiary space (nested within secondary, or on-demand overlays)**:
- Input image upload → appears as mode variant of Generate (img2img tab)
- Mask editor → inline overlay when input image is present
- Vision → separate drawer item (different mental model: upload → analyze, no "generation")
- Batch rename → separate drawer item (niche tool)
- Debug view → per-task modal, opened via task card action
- Cost estimate → inline in task card (non-blocking)
- Language switcher → footer or settings bottom

**Memory points** (Stage 1 will revisit, noted here for continuity):
- **P1 moment**: Result appears on-canvas as it's generated (no "task queue" list, just inline progress → image in gallery)
- **P2 moment**: Batch progress bar fills with satisfying chunked steps (not smooth linear, but 1/30 → 2/30 discrete jumps)

**Persona walk**:
- **P1 (Solo Creator)**: Opens app → prompt is at eye level → types → Enter or click Generate → sees result appear in same visual context → hovers to download → done. ✅ Budget holds (3 clicks).
- **P2 (Batch Operator)**: Opens app → clicks "Batch" in drawer → pastes prompts → sets size once → Generate batch → switches tab → returns → Export ZIP. ✅ Budget holds (4 clicks + 2 inputs).

**Subtraction justification** (for T6 later):
- Task Queue as separate panel: P1 doesn't think in tasks; results appear inline. P2's batch progress replaces it.
- Four equal workspace tabs: Only two true modes (single vs batch); Vision/Rename are tools, not workspaces.
- Settings always visible: Changed once per session; drawer suffices.

---

## Information Architecture Decisions (implementer preference, autonomous mode)

### 1. Two-mode canvas, not four workspaces

**Rationale**: P1 (80% of usage) never needs Batch/Vision/Rename → showing them as equal-weight tabs is visual noise. P2 enters Batch mode deliberately.

**Implementation**: 
- Default landing: Generate mode (prompt front-and-center)
- Drawer navigation: Batch (mode switch) / Vision (tool) / Rename (tool) / Library (archive) / Settings

### 2. Results inline, not separate "Task Queue"

**Rationale**: "Task" is implementation vocabulary bleeding through. P1 sees "I typed a prompt, here's my image" — the queue is internal state. Only show queue mechanics when user needs to manage multiple simultaneous requests.

**Implementation**:
- Generate mode: Result gallery shows newest images with subtle per-item progress during generation
- Batch mode: Batch-level progress bar (discrete steps: 0/30 → 1/30 → 2/30)

### 3. Settings in drawer, not on-canvas panel

**Rationale**: API key/base URL/model are set once per session. Screen real estate is too valuable to dedicate a permanent sidebar.

**Implementation**: Drawer icon in header → slides in settings form → Save closes drawer.

### 4. Persistent form state (localStorage → IndexedDB)

**Rationale**: P2's "set size once for the whole batch" expectation breaks if form resets on refresh. P1's prompt should persist across page refreshes (don't make them re-type on accidental close).

**Implementation**: IndexedDB `kv` store holds form drafts (lastPrompt, lastSize, lastBatchPrompts). Load on mount, save on change (debounced).

---

## Stage 0 Complete

**Next**: Stage 1 (genre floor, direction engines, divergence gate).
