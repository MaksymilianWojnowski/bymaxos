# bymaxOS Phase 6a (Genie and Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the required Genie minimize and restore, close the items parked by earlier phases, and verify the site against its own budgets: Lighthouse, bundle size, final screenshots.

**Architecture:** Spec phase 6 is split. **6a (this plan)** covers Genie, parked fixes and audits. **6b** compares against the reference site and gets its own plan.

Genie uses static clones of the window cut into horizontal strips, each animated with the Web Animations API towards the Dock icon. The owner chose this on 2026-11-06 instead of WebGL with a DOM snapshot, because it adds no dependency and starts at once. The keyframe maths is a pure module under unit test.

**Tech Stack:** Existing stack. No new runtime dependencies. Lighthouse runs once through `npx lighthouse@12.6.1` and is not added to `package.json`.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` §7 (Quality, §7.4 Genie), §8 (screenshots), §5 (honesty rules). Conventions: `docs/superpowers/plans/2026-11-02-bymaxos-phase-5b-phone-apps.md`.

## Global Constraints

- All earlier Global Constraints apply (content via `getContent()`, validated storage reads, icon-only buttons have `aria-label`, style matches the file, commits are per task, no Prettier on whole files, no debug probes).
- Genie runs only on the desktop shell, for minimize and for restore. The Scale effect (today's `Window.tsx` minimize) stays as the fallback, and reduce motion means no animation at all.
- Genie duration is 450ms (spec §7.4). Clones are `aria-hidden`, `inert`, carry no `id` attributes and no live iframes, video or audio, and are removed when the animation ends or is cancelled.
- Desktop rendering may change only where a task names it.
- Contrast: text 4.5:1; non-text (focus rings, switch tracks, selection bars) 3:1 against the adjacent colour.
- Nothing fabricated: storage failures are reported honestly.

## Decisions taken in this plan

| Decision | Choice | Cost if wrong |
|---|---|---|
| Strip count | `clamp(floor(40000 / nodeCount), 8, 32)` strips; Scale effect above 5000 nodes | A very long Resume minimizes with Scale, not Genie |
| Genie on restore | Restores from any path (Dock click, Dock menu, Mission Control, App Switcher) play reverse Genie | None |
| Clone scroll | Scroll offsets copied from the original into each clone | None |
| Dock focus ring | Two-tone ring (2px white plus 2px black outside) in both themes | Slightly heavier ring than macOS |
| Launchpad | Leaves the Dock visible and usable above it, as on macOS | None |
| Lighthouse | Run once per shell; fixes only for a score under 90 | Scores are from this Mac, not CI |

## Review Focus

1. **Minimize, then close or reopen before the animation ends.** No clone layer is left behind, focus does not drop to body, and the window ends in the state the last action asked for. Pinned in Task 2.
2. **Minimize a maximized, scrolled or iframe window** (Resume scrolled halfway, Safari on an embeddable site). The clone shows the same scroll position and an empty frame in place of the iframe, with no network request. Pinned in Task 2.
3. **The Dock moves while a window is minimized** (dock size or magnification changed in Settings, or the viewport resized). Restore animates from the icon's current position. Pinned in Task 2.
4. **Storage blocked or full** (private mode, quota). Notes says the edit was not saved instead of "Your edits stay on this device". Pinned in Task 4.
5. **Spotlight after a visitor adds or renames a note.** The visitor's note is found by its new title, and a deleted seed note is not. Pinned in Task 4.

---

## File Structure

```
src/shells/desktop/genie.ts          pure: strip count rule, keyframes per strip
src/shells/desktop/genieLayer.ts     builds the clone strips, runs them, cleans up
src/shells/desktop/Window.tsx        minimize and restore call genieLayer, Scale fallback kept
src/system/genieSignals.ts           set of window ids restored since their last render
src/system/store.ts                  restore() records the id
src/styles/tokens.css, src/ui/Switch.tsx, src/apps/safari/Safari.tsx, src/shells/desktop/Dock.tsx   contrast
src/system/storage.ts, src/apps/notes/Notes.tsx, src/system/search.ts, src/shells/desktop/Spotlight.tsx,
src/shells/mobile/MobileSearch.tsx, src/apps/terminal/commands.ts, src/shells/desktop/Launchpad.tsx   behaviour fixes
src/shells/mobile/LockScreen.tsx, src/apps/developer/Developer.tsx, src/apps/maps/Maps.tsx, src/ui/NavStack.tsx   phone leftovers
scripts/check-bundle.mjs, .github/workflows/ci.yml, package.json   bundle budget
e2e/genie.spec.ts, e2e/screenshots.spec.ts, docs/screenshots/   checks and final screenshots
```

---

### Task 1: Genie maths

**Files:**
- Create: `src/shells/desktop/genie.ts`, `src/shells/desktop/genie.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Box { x: number; y: number; width: number; height: number }
export const GENIE_MS = 450
export function stripCount(nodeCount: number): number | null  // null means use the Scale effect
export function genieKeyframes(from: Box, to: Box, strips: number, steps: number): Keyframe[][]
```

`genieKeyframes` returns one keyframe list per strip, top strip first, each with `steps + 1` frames at evenly spaced `offset` values from 0 to 1. Each frame sets only `transform` (`translate(x, y) scale(sx, sy)` with `transform-origin: 0 0`), relative to the strip's own place in `from`.

Strip `i` covers the band `y ∈ [i/strips, (i+1)/strips)` of the window. Normalized height `v = (i + 0.5) / strips`. Its progress is `p = clamp((t − d) / (1 − d), 0, 1)` with delay `d = 0.4 · (1 − v)`, so the bottom strips lead.

Over `ease-in-out(p)`, the strip's width and centre move from the window's to the icon's. Its top moves from its band in `from` to the same relative band in `to`. Its height scales from `from.height / strips` to `to.height / strips`. This works when the icon is below the window, the normal Dock case, and needs no special case when it is not.

- [ ] **Step 1: Write the failing tests.**
  - `stripCount gives 32 strips for small windows, 8 at the floor, and null above 5000 nodes`: values 100 → 32, 4000 → 10, 5000 → 8, 5001 → null.
  - `the first frame of every strip is the identity`
  - `the last frame of every strip lies inside the icon box`: apply the transform to the strip's band in `from`; within 0.5px.
  - `bottom strips move first`: at the middle offset, the bottom strip's progress is greater than the top strip's.
  - `every strip has steps + 1 frames with offsets 0 to 1`
  - `an icon above the window still ends inside the icon`
- [ ] **Step 2: Run.** `npx vitest run src/shells/desktop/genie.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/shells/desktop/genie.ts`.
- [ ] **Step 4: Run and commit.** Same command, PASS. Commit: `feat: add genie keyframe maths`.

### Task 2: Genie on minimize and restore

**Files:**
- Create: `src/shells/desktop/genieLayer.ts`, `src/shells/desktop/genieLayer.test.ts`, `src/system/genieSignals.ts`, `e2e/genie.spec.ts`
- Modify: `src/shells/desktop/Window.tsx`, `Window.test.tsx`, `src/system/store.ts`, `src/system/store.test.ts`

**Interfaces:**
- Consumes: `stripCount`, `genieKeyframes`, `GENIE_MS` from Task 1; `dockIconRects` from `src/shells/desktop/dockIconRects.ts`.
- Produces:
  - `playGenie(source: HTMLElement, from: Box, to: Box, direction: 'minimize' | 'restore'): Animation[] | null`. Returns null when it cannot run (no `animate`, no strip count), so the caller uses the fallback.
  - `genieRestores: Set<string>` exported from `src/system/genieSignals.ts`, filled by `restore(id)` in the store.

- [ ] **Step 1: Write the failing tests.**
  - `genieLayer.test.ts`:
    - `builds one aria-hidden inert strip per stripCount, each a clone clipped to its band`
    - `clones carry no ids and no iframe, video or audio`
    - `copies scroll offsets into the clones`
    - `removes the layer when every animation finishes`
    - `removes the layer when cancelled`
    - `returns null when the element has no animate`
  - `Window.test.tsx`:
    - `minimize plays genie towards the dock icon, then minimizes`
    - `minimize falls back to the scale effect when genie returns null`
    - `reduce motion minimizes at once`
    - `closing mid-genie removes the layer and keeps focus off body`
    - `a window restored from minimized plays reverse genie once and is hidden until it ends`
    - `restore starts from the Dock icon rect current at restore time, not at minimize time`
  - `store.test.ts`: `restore records the id in genieRestores`.
  - `e2e/genie.spec.ts` at 1440×900:
    - `minimizing Finder shows genie strips that end at its Dock icon, then removes them`
    - `clicking the Dock icon restores the window with reverse genie`
    - `minimizing Safari on an embeddable page clones no iframe`
    - `reduce motion minimizes with no strips`
    - `a scrolled Resume keeps its scroll position in the strips`
- [ ] **Step 2: Run them.** `npx vitest run src/shells/desktop src/system` and `npx playwright test e2e/genie.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `genieLayer.ts`.**
  - One `position: fixed` layer appended to `document.body`, with `z-index` above windows and the Dock, `pointer-events: none`, `aria-hidden`, `inert`.
  - Per strip: a wrapper at the window's box with `clip-path: inset(...)` for its band, holding `source.cloneNode(true)`. Strip `id`s; replace `iframe, video, audio` with an empty `div` of the same size; copy `scrollTop` and `scrollLeft` from each scrollable original to its clone by walking both trees in order.
  - Animate each wrapper with its keyframes, `duration: GENIE_MS`, `easing: 'linear'` (the easing is in the frames), `fill: 'forwards'`. Restore uses the same frames reversed.
  - `stripCount(source.querySelectorAll('*').length)`.
- [ ] **Step 4: Wire `Window.tsx`.**
  - Minimize: try `playGenie` towards `dockIconRects.get(win.appId)`. Hide the source with `visibility: hidden` while it runs and minimize on finish. On null, keep today's Scale code path.
  - Restore: on mount, if `genieRestores` has the id, delete it and, unless reduce motion is on, play reverse Genie from the current Dock icon rect with the window `visibility: hidden` until the last animation finishes.
  - Unmount cancels.
- [ ] **Step 5: Run and commit.** Same commands, plus `npm run typecheck`, `npm run lint`. Commit: `feat: minimize and restore windows with the genie effect`.

### Task 3: Contrast fixes

**Files:**
- Modify: `src/ui/Switch.tsx`, `src/apps/safari/Safari.tsx`, `src/styles/tokens.css` (only if the Safari fix needs a token), `src/shells/desktop/Dock.tsx`
- Create: `e2e/contrast.spec.ts`; add `contrastRatio(a: string, b: string): number` to `e2e/helpers.ts`

- [ ] **Step 1: Write the failing tests** in `e2e/contrast.spec.ts`, desktop 1440×900, reading computed colours:
  - `an unchecked switch track has 3:1 against the window in dark mode`: Settings → Accessibility; was 2.28:1.
  - `the selected Safari tab bar has 3:1 against the tab in dark mode for every accent`: was 2.89:1 for purple.
  - `a focused Dock icon ring has 3:1 against the Dock glass and against the wallpaper behind it, in both themes, for every accent`: read the ring colours and the Dock background behind the ring.
- [ ] **Step 2: Run.** `npx playwright test e2e/contrast.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Fix.**
  - Switch: dark unchecked track gets a colour that reaches 3:1 against `--window-bg`, light unchanged.
  - Safari: the selected tab's bar uses a colour that reaches 3:1 for every accent in dark mode, by a dark-only token if needed.
  - Dock: two-tone focus ring, `focus-visible:ring-2 focus-visible:ring-white` plus `focus-visible:shadow-[0_0_0_4px_rgb(0_0_0/0.75)]`, in both themes. Remove the accent ring.
- [ ] **Step 4: Run and commit.** Same command, plus the e2e axe specs `e2e/system.spec.ts e2e/more-apps.spec.ts`. Commit: `fix: bring switch, Safari tab and Dock focus contrast to 3:1`.

### Task 4: Honest storage, visitor notes in search, Terminal and Launchpad

**Files:**
- Modify: `src/system/storage.ts` (+ test), `src/apps/notes/Notes.tsx` (+ test), `src/system/search.ts` (+ test), `src/shells/desktop/Spotlight.tsx`, `src/shells/mobile/MobileSearch.tsx`, `src/apps/terminal/commands.ts` (+ test), `src/shells/desktop/Launchpad.tsx` (+ test), `e2e/system.spec.ts`

**Interfaces:**
- Produces: `safeStorage.set(...)` returns `boolean` (true when written). Existing callers ignore it.
- Produces: `buildIndex(content, apps, notes?: VisibleNote[])`. With `notes`, note items come from it instead of `content.notes`.

- [ ] **Step 1: Write the failing tests.**
  - `storage.test.ts`: `set returns false when setItem throws, true otherwise`.
  - `Notes.test.tsx`: `when saving fails the footer says edits are not being saved`, footer copy exactly `Couldn't save — your edits will be lost when you leave.`, shown after a failed write and gone after a successful one.
  - `search.test.ts`: `indexes the visitor's notes by their current titles and leaves out deleted ones`.
  - Spotlight and MobileSearch tests: `a note the visitor added is found`. Both build the index from `mergeNotes(getContent().notes, parseStoredNotes(stored))` each time they open, not once at module load.
  - `commands.test.ts`: `ls .. lists the parent folder`; `ls .. at root lists root`.
  - `Launchpad.test.tsx`: `the Dock stays above Launchpad and works while it is open`. In `e2e/system.spec.ts`: `Launchpad leaves the Dock visible and clickable`.
- [ ] **Step 2: Run.** `npx vitest run src/system src/apps/notes src/apps/terminal src/shells`. Expected: FAIL.
- [ ] **Step 3: Implement.** Launchpad stays below the Dock in z-order and pads its bottom by the Dock height so no icon sits under it. A Dock click while Launchpad is open closes Launchpad and runs the click.
- [ ] **Step 4: Run and commit.** Same commands, plus `npx playwright test e2e/system.spec.ts`. Commit: `fix: report failed note saves, search visitor notes, ls .., and keep the Dock above Launchpad`.

### Task 5: Phone leftovers from 5b

**Files:**
- Modify: `src/shells/mobile/LockScreen.tsx`, `src/apps/developer/Developer.tsx`, `src/apps/maps/Maps.tsx`, `src/ui/NavStack.tsx`, with their tests

- [ ] **Step 1: Write the failing tests.**
  - `LockScreen.test.tsx`: `the lock list allows pinch zoom` (class `touch-pinch-zoom` next to every `touch-pan-y`).
  - `Developer.test.tsx`: `phone: no language request before a repository is opened`; `phone: opening a repository requests its languages`.
  - `Maps.test.tsx`: `phone: map, place details and timeline follow that order in the DOM` (drop `phone:order-last`).
  - `NavStack.test.tsx`: `Escape already handled by a child does not go back` (`defaultPrevented`); `Escape while composing text does not go back` (`isComposing`).
- [ ] **Step 2: Run.** `npx vitest run src/shells/mobile src/apps/developer src/apps/maps src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement.** Developer passes no active repository to the language effect on phones while the detail is closed. Maps renders the timeline after the map section on phones with a `useShell` branch, keeping the desktop order.
- [ ] **Step 4: Run and commit.** Same command, plus `npx playwright test e2e/mobile.spec.ts e2e/phone-apps.spec.ts`. Commit: `fix: tidy phone leftovers in lock screen, Developer, Maps and NavStack`.

### Task 6: Budgets and Lighthouse

**Files:**
- Create: `scripts/check-bundle.mjs`
- Modify: `package.json` (script `check:bundle`), `.github/workflows/ci.yml` (run it after build), plus whatever the audit exposes

- [ ] **Step 1: Write the check.** `scripts/check-bundle.mjs` reads `dist/index.html`, finds the entry script and its `modulepreload` links, gzips each from `dist/` with `node:zlib`, and fails when the total exceeds 150 KB (spec §7.2). It prints the total. Add `"check:bundle": "node scripts/check-bundle.mjs"`, and add `npm run check:bundle` to CI after `npm run build`.
- [ ] **Step 2: Run it.** `npm run build`, then `npm run check:bundle`. Expected: PASS around 96 KB; record the number.
- [ ] **Step 3: Run Lighthouse.** Serve with `npm run preview -- --port 4180`. Run `npx lighthouse@12.6.1 http://localhost:4180/ --only-categories=performance,accessibility --output=json --output-path=<scratch>/lh-desktop.json --preset=desktop --chrome-flags="--headless"`, and again without `--preset` for mobile. Record both scores per category.
- [ ] **Step 4: Fix any category under 90** at the source, one commit per cause, each with a test where one is possible. Re-run until both shells reach 90 or more. If a cause cannot be fixed without breaking the spec, stop and report it.
- [ ] **Step 5: Commit.** `chore: add the shell bundle budget check` plus any fix commits.

### Task 7: Final screenshots and gate

**Files:**
- Create: `e2e/screenshots.spec.ts`, `docs/screenshots/*.png`

- [ ] **Step 1: Write `e2e/screenshots.spec.ts`.** It is skipped unless `process.env.SCREENSHOTS === '1'`. At 1440×900 and 1280×720 it captures: desktop with Finder, Resume, Mission Control, Spotlight and Launchpad. At 390×844 (`hasTouch`) it captures: lock screen, home, Notes editor, Finder folder, Mail sheet, Terminal. At 844×390 (`hasTouch`) it captures: lock screen, home, Maps. Light theme, with a fixed clock (`page.clock.setFixedTime('2026-11-06T10:09:00')`). Files go to `docs/screenshots/<width>x<height>-<name>.png`.
- [ ] **Step 2: Generate.** `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts`. Open several and check that nothing is cut off or mid-animation.
- [ ] **Step 3: Run the gate sequentially.** `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`, `npm run build`, `npm run check:bundle`. Each exits 0.
- [ ] **Step 4: Commit.** `docs: add final screenshots at the four spec sizes`.
