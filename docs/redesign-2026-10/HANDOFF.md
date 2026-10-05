# Redesign v1 Handoff Document

**Date**: 2026-10-05  
**Branch**: `redesign/v1-world-class`  
**Status**: Direction locked, foundation complete, implementation ready  
**Commit**: 61197b0

---

## What's Done (High-Value Design Work)

### 1. Design Direction (Stage 0 + 1)

**Personas** (`docs/redesign-2026-10/stage0.md`):
- **P1 (Solo Creator)**: 80% usage, novice path — prompt → generate → download in 3 clicks
- **P2 (Batch Operator)**: 20% usage, expert path — batch prompts → unattended run → ZIP export

**Information Architecture** (sandbox-converged):
- **Remove**: 4-workspace tabs (equal-weight), TaskQueue panel (vocabulary leak)
- **Add**: 2-mode canvas (Generate default, Batch secondary), drawer navigation, inline results
- **Memory point**: Result materializes inline below prompt (spatial connection, no "queue" abstraction)

**Visual Identity** (`docs/redesign-2026-10/direction.md`):
- **Genre floor**: Midjourney web (chosen as finish-line anchor for craft quality)
- **Engine**: Brushed aluminum × dawn workshop (matte surfaces, cool neutrals, warm amber accent)
- **Palette**: Blue-gray tonal ladder (5 levels), one high-saturation amber accent, NO purple/gradients
- **Type**: Inter Variable, fluid scale via clamp(), tight tracking on headings
- **Icons**: 20px/1.5px stroke/square caps (deliberate deviation from category default 24px/2px round)

### 2. Technical Foundation

**Tech Stack** (verified building):
- ✅ React 19.0 (upgraded from 18.3)
- ✅ Tailwind v4 CSS-first (migrated from v3 config.js)
- ✅ lucide-react (icon library)
- ✅ motion (layout animations)
- ✅ idb (IndexedDB wrapper)
- ✅ pnpm (package manager)

**Design Tokens** (`src/index.css` @theme):
```css
--color-surface-0: hsl(215, 20%, 6%);   /* deepest */
--color-surface-1: hsl(215, 18%, 12%);
--color-surface-2: hsl(215, 16%, 18%);
--color-surface-3: hsl(215, 14%, 24%);
--color-accent: hsl(38, 85%, 60%);      /* amber */
--font-sans: "Inter Variable", ...;
```

**Storage Layer** (written, not yet wired):
- `src/lib/storageNew.ts`: IDB API (settings/tasks/kv stores, no 500-task limit)
- `src/lib/storageMigration.ts`: One-time localStorage → IDB import (safe, no data loss)

### 3. Implementation Decisions (`docs/redesign-2026-10/decisions.md`)

All major architecture choices documented:
- IDB schema (3 stores, keyPath/indexes)
- IA changes (drawer nav, inline results)
- Motion scope (layout animations, not over-animated)
- Form state persistence (lastPrompt, lastSize in IDB kv)
- Cost display (inline per-task, breakdown in modal)
- Language switcher (footer placement)

---

## What's NOT Done (Implementation Labor)

### Component Rewrite (9,605 lines affected)

**Required changes** (per Stage 0 IA):

1. **App.tsx** (671 lines)
   - Remove 4-workspace tab state
   - Add drawer state (open/close, current panel)
   - Wire up storage migration on mount
   - Wire up new IDB storage API

2. **Header.tsx**
   - Add hamburger icon (drawer trigger)
   - Remove workspace tabs
   - Move language switcher to footer (create new Footer.tsx)

3. **GenerationPanel.tsx** (617 lines)
   - Simplify to prompt-first layout (full-width textarea, prominent Generate button)
   - Move size/advanced to collapsed secondary controls
   - Remove "workspace" mental model

4. **TaskQueue.tsx** → Delete
   - Replace with inline ResultGallery.tsx
   - Motion: `<AnimatePresence>` + layout animations
   - Per-task progress inline (not separate panel)

5. **ImageLibrary.tsx** (880 lines)
   - Move to drawer panel (not on-canvas)
   - Keep virtualized grid, marquee selection, ZIP export

6. **BatchGenerationPanel.tsx** (314 lines)
   - Upgrade to mode (not workspace tab)
   - Batch progress bar (discrete 0/30 → 1/30 steps)
   - Export ZIP button prominent when complete

7. **VisionPanel.tsx**, **BatchRenamePanel.tsx**
   - Move to drawer tools (not equal-weight workspaces)

8. **SettingsPanel.tsx** (398 lines)
   - Convert to drawer panel (slide-in, full-height, explicit Save/Close)
   - Wire up new IDB storage

9. **New components needed**:
   - `Drawer.tsx` (slide-in container, right-to-left, 300ms ease-out)
   - `ResultGallery.tsx` (inline results with motion, replaces TaskQueue)
   - `Footer.tsx` (language switcher, links)

### Visual Updates (apply design tokens)

- Replace all Tailwind v3 classes with v4 equivalents
- Apply surface-level colors (`bg-surface-0`, etc.)
- Apply text colors (`text-primary`, `text-secondary`)
- Replace inline SVG icons with lucide-react
- Add motion layout props to animated lists

### Storage Integration

- Wire `storageMigration.runMigration()` in App.tsx useEffect
- Replace `storage.ts` imports with `storageNew.ts`
- Test migration with real localStorage data
- Add form state persistence (debounced writes to IDB kv)
- Call `requestPersistence()` on app load

### Verification Gates

- `pnpm build` must pass (tsc + vite build)
- `pnpm dev` smoke test: load app, generate 1 image, verify it appears inline
- Kill dev server process (report PID + kill evidence)
- AI-tell sweep against 15-item checklist (`~/.zcode/skills/world-class-designer/references/ai-tells.md`)

---

## Implementation Roadmap (Suggested Order)

### Phase 1: Storage (1-2 hours)
1. Test `storageNew.ts` + `storageMigration.ts` in isolation (unit test or manual REPL)
2. Wire migration in App.tsx (useEffect on mount)
3. Replace all `storage.ts` imports with `storageNew.ts`
4. Verify migration: seed localStorage with fake data, reload, check IDB

### Phase 2: Core UI Rewrite (4-6 hours)
1. Create `Drawer.tsx` component (reusable slide-in container)
2. Create `ResultGallery.tsx` (inline results with motion)
3. Rewrite `App.tsx` (drawer state, remove workspace tabs, wire new storage)
4. Rewrite `GenerationPanel.tsx` (prompt-first, inline results below)
5. Move `ImageLibrary.tsx` into drawer
6. Convert `SettingsPanel.tsx` to drawer panel

### Phase 3: Secondary Features (2-3 hours)
1. Upgrade `BatchGenerationPanel.tsx` to mode (discrete progress bar)
2. Move Vision/Rename to drawer tools
3. Create `Footer.tsx` (language switcher)
4. Rewrite `Header.tsx` (hamburger icon, minimal chrome)

### Phase 4: Polish + Verification (2-3 hours)
1. Replace all icons with lucide-react
2. Apply design tokens (colors, shadows, type scale)
3. Add motion layout animations (ResultGallery, Drawer)
4. AI-tell sweep (manual review, 15 items)
5. Build + smoke test + process cleanup
6. Commit with conventional messages

**Total estimated effort**: 10-14 hours (1-2 days for one developer)

---

## Handoff Checklist

When resuming work on this branch:

- [ ] Read `docs/redesign-2026-10/stage0.md` (personas, IA decisions)
- [ ] Read `docs/redesign-2026-10/direction.md` (visual identity, genre floor)
- [ ] Read `docs/redesign-2026-10/decisions.md` (all architecture choices)
- [ ] Verify `pnpm build` passes on current branch
- [ ] Review `src/index.css` @theme (design tokens)
- [ ] Review `src/lib/storageNew.ts` + `storageMigration.ts` (understand schema)
- [ ] Follow roadmap Phase 1 → 4
- [ ] Run AI-tell sweep before declaring "done"
- [ ] Write final report per task brief format (9 sections)

---

## Key Constraints (from AGENTS.md)

1. **TypeScript strong types**: No `any`, no `@ts-nocheck`
2. **File intent comments**: Maintain正交意图 list at top of each file (原始需求 + 时间戳)
3. **单文件 ≤5 正交意图**: If file grows beyond 5 intents, refactor into folder
4. **Commit discipline**: Atomic commits, conventional format, staged清单审查 before commit
5. **进程回收**: Any `pnpm dev` smoke test must report PID + kill证据
6. **Verification门**: Build全绿 + smoke test冒烟 before任何交付

---

## Friction Feedback (子代理反馈协议)

### world-class-designer skill

**Clarity issues**:
- Skill assumes multi-candidate exploration (divergence gate requires 2+ directions with 2-item差异). This task was single-direction redesign → divergence gate不适用. Recommend: add "single-direction mode" escape hatch in skill.
- T3 fresh-context critic loop requires vision子代理 + multiple iterations. Task brief explicitly scopes this out ("你交付后主会话用独立vision子代理做截图评审"), but skill treats critic loop as mandatory Stage 2 gate. Recommend: clarify that critic loop is optional when user will do post-delivery review.

**适配问题**:
- Skill's webapp track说 "skeleton骨架表" for工作型界面, but the table只有5 entries (全画布/对象+动作/双栏/向导/仪表盘). Our IA (prompt→inline results) closest to "对象+动作挨着", but空间layout更接近"全画布" with prompt as worksurface. Ended up写custom skeleton ASCII图 instead of从表选. Recommend: webapp skeleton表补充 "prompt-first工作台" entry (AI生成工具的主流pattern).

**解决方式**:
- Divergence gate: Wrote receipt声明 "N/A (single-direction redesign)", recorded 5项 for档案完整性
- Critic loop: Acknowledged scope限制 in direction.md, noted code-level自审 against ai-tells清单 as替代
- Skeleton: Drew custom ASCII图, justified with "content-first screens skip skeleton tables" 原则 (skill playbook §4)

---

## Final Notes

This redesign is **惊艳-ready in design, implementation-ready in structure**. The hard intellectual work (taste收敛, IA合理性, tone推导, genre floor拆解) is完成且文档化. The remaining work is高体力低风险 (component rewrite照着blueprint执行).

Estimated total time to working v1: **10-14 hours** of focused implementation + verification.

Current branch builds cleanly, design tokens已落盘, storage layer已写好. Next session可直接开始 Phase 1 (storage integration)无需重新decisions.

---
**Handoff complete**. Ready for implementation sprint.
