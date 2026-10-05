# Implementation Decisions Log

**Date**: 2026-10-05  
**Mode**: autonomous (implementer preference)

## Decision 1: Tech Stack Migration Strategy

**Context**: Task requires React 19, Tailwind v4, lucide-react, motion/react, idb. Current stack is React 18, TW 3, inline SVG icons, no motion library, manual IndexedDB.

**Decision**: Incremental migration in this order:
1. Package upgrades (React 19, TW4, add lucide/motion/idb) — verify build still works
2. Storage layer (IndexedDB migration, new stores, one-time localStorage import)
3. Component rewrites (new IA per Stage 0, new visual identity per Stage 1)
4. Motion polish (layout animations for result gallery)
5. AI-tell sweep + verification

**Rationale**: Storage migration must happen before UI changes (new UI will write to new schema). Component rewrites are high-risk (touching 9k lines) — do them after storage is stable so we can test end-to-end without compound failures.

**Risk**: React 19 breaking changes may surface during component rewrite. Mitigation: Check React 19 migration guide first, address any `key` warnings or suspense changes.

---

## Decision 2: IndexedDB Architecture

**Context**: Task requires moving settings/tasks/form-state from localStorage to IndexedDB, preserving existing imageCache.ts, no data loss for existing users.

**Decision**: Create new DB `openai-image-webui` (separate from existing `openai-image-webui-cache`) with stores:
- `settings`: keyPath `id` (singleton, always id="default")
- `tasks`: keyPath `id`, index on `createdAt` (no 500-item limit anymore)
- `kv`: keyPath `key` (form drafts: lastPrompt, lastSize, lastBatchPrompts, currentBatchId)

**Keep existing**: `openai-image-webui-cache` DB untouched (imageCache.ts already works, don't break it).

**Migration**: On first load, detect localStorage keys → import to IDB → delete localStorage keys only after successful IDB write. Migration logic isolated in `src/lib/storageMigration.ts`.

**Rationale**: Separate DBs = no version conflict with existing cache. KV store for form state = flexible schema (add new draft keys without migration). Deleting localStorage only after success = zero data loss.

**Implementer preference**: Using `idb` library (Dexie is heavier than needed; hand-rolled IDB is error-prone; `idb` is the sweet spot for this scale).

---

## Decision 3: Information Architecture Changes

**Context**: Stage 0 sandbox converged on two-mode canvas (Generate default, Batch secondary) + drawer for settings/tools.

**Decision**: Remove four-workspace-tabs layout (Generate/Vision/Rename/Batch as equal-weight tabs). Replace with:
- **Default canvas**: Generate mode (prompt → button → inline results)
- **Drawer navigation** (hamburger icon in header):
  - Batch (mode switch, replaces canvas)
  - Vision (tool, modal or drawer panel)
  - Rename (tool, modal or drawer panel)
  - Library (archive view, drawer panel or modal)
  - Settings (drawer panel)

**Remove**: TaskQueue as separate panel (results are inline in Generate mode; Batch mode has progress bar).

**Add**: Settings drawer (slides in from right, full-height, shows all settings at once, explicit Save/Close actions).

**Rationale**: P1 (80% of usage) never sees Batch/Vision/Rename unless they seek it. Canvas is uncluttered. P2 can still access Batch in 1 click.

**Trade-off**: Users who switch between Generate/Vision frequently will feel 1 extra click. Acceptable — Vision is low-frequency even for power users (per Stage 0 frequency map).

---

## Decision 4: Tailwind v4 Migration Approach

**Context**: TW v4 is CSS-first (no `tailwind.config.js`), uses `@theme` in CSS. Existing project has `tailwind.config.js` with custom tokens (shadow-soft, etc.).

**Decision**: Migrate to `@theme` in new `src/index.css`, port custom tokens as CSS custom properties:
```css
@import "tailwindcss";

@theme {
  --color-surface-0: hsl(215, 20%, 6%);
  --color-surface-1: hsl(215, 18%, 12%);
  /* ... */
  --color-accent: hsl(38, 85%, 60%);
  
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-mono: "SF Mono", Menlo, monospace;
}
```

**Rationale**: TW v4 CSS-first is cleaner (design tokens live in CSS, not JS config). Custom properties are easier to reference in JS if needed (for canvas drawing, charts, etc.).

**Implementer preference**: Shadow names like `shadow-soft` will be replaced with inline `shadow-[...]` values or custom property references. No need to recreate every legacy token if it's not used in new design.

---

## Decision 5: Motion Strategy

**Context**: Task requires motion/react for layout animations (result gallery, list reordering). Direction playbook says "motion decision before building", referencing animation family skills.

**Decision**: Use `motion/react` for:
- Result gallery: `<AnimatePresence>` + `layout` prop on image cards (when new image arrives, existing ones flow down smoothly)
- Batch progress: discrete step animation (0/30 → 1/30 with spring easing)
- Drawer: slide-in transition (right-to-left, 300ms ease-out)

**NOT using motion for**: Individual button hover states (CSS transitions suffice), loading spinners (CSS animation), modals (native dialog backdrop is adequate).

**Rationale**: Motion budget is focused on memory point (P1's "result materializes inline") and spatial relationships (cards shifting is physical feedback). Over-animating is an AI tell.

---

## Decision 6: Input Images Persistence

**Context**: Task bonus: "persist inputImages File/Blob to IDB, restore edit tasks across sessions".

**Decision**: Defer to post-v1 (nice-to-have, not blocking惊艳 delivery). Reason: File/Blob serialization to IDB adds complexity (revocation, GC, quota pressure), and P1/P2 stories don't hinge on it (P1 rarely uses img2img; P2's input images are project assets, not session-specific).

**If time permits**: Store input image blobs in `kv` store with key `inputImage:${taskId}`, link task record to blob key, cleanup on task deletion.

---

## Decision 7: Form State Persistence Scope

**Context**: P2 expects "set size once, it's remembered next session". Task requires form drafts in IDB.

**Decision**: Persist to IDB `kv` store (debounced on change, 500ms):
- `lastPrompt`: string (Generate mode prompt textarea value)
- `lastSize`: string (size picker selection)
- `lastAdvancedJson`: string (advanced JSON textarea)
- `lastBatchPrompts`: string (Batch mode prompt list)
- `currentBatchId`: string | null (active batch identity, if any)

**NOT persisting**: inputImages, maskImage (File objects don't serialize well; Decision 6 scope). Response format, concurrency (those are in settings, already persisted).

**Rationale**: Solves P2's "set size once" pain point. String drafts are lightweight. Files deferred.

---

## Decision 8: Cost Estimation Preservation

**Context**: Existing app has cost estimation (per task, based on OpenAI pricing). Task says "keep functionality" but doesn't specify UI placement.

**Decision**: Move cost display to per-task card footer (inline, non-blocking). Format: `~$0.04` (compact). Full breakdown in debug modal (opened on-demand).

**Rationale**: Cost is useful but not primary (P1/P2 stories don't mention it). Inline display keeps it visible without dedicating header space. Debug modal satisfies power users who want itemized breakdown.

---

## Decision 9: Language Switcher Placement

**Context**: Existing app has zh/en toggle. Task says "keep i18next". Direction says "minimal chrome".

**Decision**: Move language switcher to footer (bottom-right corner, 28px flag icon or text button). Remove from header.

**Rationale**: Changed once per user, not per session. Footer suffices (still accessible, doesn't consume prime header real estate).

---

## Decision 10: PWA Continuity

**Context**: Existing app has PWA manifest + sw.js. Task says "continue可用".

**Decision**: Keep manifest + sw.js as-is, update `name`/`short_name` in manifest to match new branding (if any). Verify `start_url` and `scope` still match vite base path.

**Rationale**: PWA install is a bonus for P1 (offline access to settings/history). No redesign needed (manifest is metadata). Service worker may need cache invalidation if asset hashing changes (Vite handles this automatically).

---

## Decisions Summary

| # | Topic | Decision | Status |
|---|-------|----------|--------|
| 1 | Migration order | Storage → UI → Motion → Polish | Locked |
| 2 | IDB schema | New DB, 3 stores (settings/tasks/kv), separate from cache | Locked |
| 3 | IA changes | 2-mode canvas, drawer nav, inline results | Locked |
| 4 | TW v4 | CSS-first `@theme`, port tokens as custom props | Locked |
| 5 | Motion scope | Layout animations for gallery, progress, drawer | Locked |
| 6 | Input image persist | Defer to post-v1 (nice-to-have) | Deferred |
| 7 | Form state | Persist prompt/size/JSON to IDB kv, debounced | Locked |
| 8 | Cost display | Inline per-task, breakdown in debug modal | Locked |
| 9 | Language switcher | Footer placement | Locked |
| 10 | PWA | Keep as-is, verify paths | Locked |

**Next**: Implementation (storage layer first, then UI rewrite).
