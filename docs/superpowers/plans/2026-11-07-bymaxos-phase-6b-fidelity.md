# bymaxOS Phase 6b: Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four fidelity gaps from the 2026-11-07 comparison with frvky.online that the owner picked. A minimized window keeps its state. The Calendar icon shows today's date. The phone status bar shows battery percentage and signal bars when the browser reports them. The phone uses Apple's dark icons in dark mode.

**Architecture:**
- **Windows.** Minimized windows stay mounted. They are hidden with `invisible` + `inert` + `aria-hidden`, the way the phone shell keeps `AppScreen`s. The restore genie fires on the minimized → visible transition, not on mount.
- **Calendar icon.** It becomes a drawn icon (`{ live: 'calendar' }`), not a PNG.
- **Status bar.** It reads only what the browser exposes (Battery Status API, Network Information API). When the browser reports nothing, it shows nothing.
- **Dark icons.** Owner-exported Apple artwork in `src/assets/icons/dark/`. They are used only when every image icon has a dark file.

**Tech Stack:** Vite, React 19, TS strict, Tailwind v4, Zustand 5, Vitest + Testing Library, Playwright + axe. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` (§7 desktop, §8 phone, the Icons row in §2). Owner decisions from 2026-11-07:
- Scope is only these four items.
- The Camera, video wallpaper and PWA items are out of scope.

## Global Constraints

- Content comes via `getContent()`, and storage goes through `safeStorage` with validated reads. Icon-only buttons have an `aria-label`. Style matches the surrounding file: most files use single quotes and no semicolons. `src/system/types.ts`, `wm.ts`, `storage.ts` and `settings.ts` use semicolons.
- Nothing fabricated. A value the browser does not report (battery, network) is not shown, and is never guessed or faked.
- Icons are Apple's own artwork, exported from the owner's Mac by `scripts/export-apple-icons.swift`. No assets come from the reference site, and there is no Apple logo.
- Genie (from 6a) runs only on the desktop shell, for minimize and restore, and lasts 450ms. Scale is the fallback, and reduce motion means no animation.
- Contrast: text 4.5:1. Non-text elements (focus rings, switch tracks, battery fill, signal bars) 3:1 against the adjacent colour.
- Focus never drops to body, and never stays inside a hidden element. There are no window-level key listeners.
- Comments only explain the why that the code cannot show, in one line.
- Desktop rendering changes only where a task names it.

## Review Focus

1. **A minimized window holds focus** (a text field inside it was focused). Focus moves to the window the store now focuses, else to whatever had focus before that window opened, else to the desktop. It never lands on body or on the hidden window. Pinned in Task 1.
2. **A minimized window is unreachable.** Tab, a screen reader, axe and `getByRole` do not find its contents while it is minimized. Pinned in Task 1 (axe and Tab test).
3. **Quitting an app that only has minimized windows** (Dock → Quit). Its windows unmount cleanly, and no genie layer or registry entry is left behind. Pinned in Task 1.
4. **Midnight passes with the site open.** The Calendar icon changes date without a reload. Pinned in Task 2 (fake timers).
5. **Safari has neither the Battery API nor the Network Information API.** The status bar shows no percentage and no bars, and does not crash. Pinned in Task 3.

---

### Task 1: Minimized windows keep their state

**Files:**
- Modify: `src/shells/desktop/WindowLayer.tsx` (render every window; Mission Control still lays out only the visible ones)
- Modify: `src/shells/desktop/Window.tsx` (hidden state; restore and focus hand-off on the mode transition)
- Test: `src/shells/desktop/Window.test.tsx`, `src/shells/desktop/WindowLayer.test.tsx`, `e2e/genie.spec.ts`

**Interfaces:**
- Consumes: `genieRestores` (a Set in `src/system/genieSignals.ts`, filled by the store on every restore path), `playGenie`, `cancelGenie`, `dockIconRect` (all from 6a).
- Produces: none for later tasks.

**Behaviour:**
- `WindowLayer` renders all windows in store order. `missionLayout` and the `MissionControl` labels keep using only the non-minimized windows.
- `Window` derives `minimized = win.mode === 'minimized'`. While minimized, the root gets the `invisible` class, the `inert` attribute and `aria-hidden="true"`, and takes no pointer events. It stays in the DOM, so app state, scroll, form drafts and playing audio survive. macOS keeps playing audio from a minimized window.
- Restore: the existing restore effect changes from mount-only to a reaction to `minimized` going `true → false`. Use a `useRef` of the previous value. The genie runs only when `genieRestores.delete(win.id)` is true, as today. If the genie does not run (no Dock rect, `playGenie` returned null), play the existing open Scale animation. Under reduce motion, play no animation.
- Minimize: the clone is still taken before the store update. On the transition to minimized, if `document.activeElement` is inside the root, move focus. First choice is the root of the window the store now focuses. Second choice is the element that had focus before this window opened, if it is connected and not inside a hidden window. Otherwise use the desktop root rendered by `src/shells/desktop/Desktop.tsx` (give it `tabIndex={-1}` if it is not focusable yet).
- Close/quit of a minimized window unmounts it. The existing cleanups (`windowMinimizers.delete`, animation cancel) cover it.

- [ ] **Step 1: Write the failing unit tests** in `Window.test.tsx`:
  - `'a minimized window stays mounted, hidden and inert'`: after minimize, the root is in the document, has `inert` and `aria-hidden="true"`, and `screen.queryByRole('dialog', { name: <title> })` is null.
  - `'a text field keeps its value across minimize and restore'`: type `draft` into a TextEdit textarea, minimize, call `restore(id)`, and expect the value to still be `draft`.
  - `'focus inside a minimized window moves to the next focused window'`: two windows, focus a field in the top one, and minimize it. `document.activeElement` is the other window's root, never `document.body`.
  - `'restore without a Dock rect plays the Scale open animation'`: with `dockIconRect` returning undefined, `animate` is called once with the open keyframes.
  - `'quitting an app whose only window is minimized unmounts it'`: the root is gone and `windowMinimizers.has(id)` is false.
- [ ] **Step 2:** Run `npx vitest run src/shells/desktop/Window.test.tsx`. Expected: the new tests FAIL, because the window unmounts on minimize.
- [ ] **Step 3: Implement** in `WindowLayer.tsx` and `Window.tsx` as described above. Update the `WindowLayer.test.tsx` cases that assumed minimized windows are absent from the DOM, so that they assert hidden instead.
- [ ] **Step 4:** Run `npx vitest run src/shells/desktop`. Expected: PASS.
- [ ] **Step 5: e2e** in `e2e/genie.spec.ts`: `'a Notes edit survives minimize and restore'`. Open Notes, type into the note body, minimize with the yellow button, and click the Notes Dock icon. The typed text is still there, and after the genie ends `[data-genie-layer]` has count 0. Also add an axe check with one window minimized: no violations, and Tab never reaches the minimized window.
- [ ] **Step 6:** Run `npx playwright test e2e/genie.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: minimized windows keep their state`.

### Task 2: Live Calendar icon

**Files:**
- Modify: `src/apps/types.ts` (`AppIconSpec` gains `| { live: 'calendar' }`)
- Modify: `src/apps/registry.ts:167-170` (Calendar uses `{ live: 'calendar' }`; drop the `calendarIcon` import if nothing else uses it)
- Create: `src/ui/CalendarIcon.tsx`
- Modify: `src/ui/AppIcon.tsx` (render `CalendarIcon` for `live`)
- Test: `src/ui/CalendarIcon.test.tsx`

**Interfaces:**
- Produces: `CalendarIcon({ size, dark }: { size: number; dark?: boolean })`, used by Task 4 with `dark`.
- Consumes: `useClock()` from `src/shells/desktop/statusHooks.ts` (ticks every 15s).

**Look:**
- The same box as the glyph icons in `AppIcon`: a `size × size` outer box, `padding: size * 0.1`, and an inner squircle with `borderRadius: '22.5%'`. This matches the margin of Apple's PNGs.
- Light: a white tile, label text `#ff3b30` at `size * 0.13`px weight 600, and the date in `#1d1d1f` at `size * 0.42`px weight 300, centred.
- Dark: tile `#1c1c1e`, the same red label, and the date in `#ffffff`.
- Label: on the desktop shell, the month `short` upper-cased (macOS, e.g. `NOV`). On the phone shell, the weekday `long` (iOS, e.g. `Saturday`). Read the shell with `useShell()` from `src/system/shell.ts`. Use `Intl.DateTimeFormat('en-US', …)`. The site is EN-only.
- Decorative: `aria-hidden="true"`. Labels come from the parent, as today.

- [ ] **Step 1: Write the failing tests** in `CalendarIcon.test.tsx`, using `vi.useFakeTimers()` with `vi.setSystemTime(new Date(2026, 10, 7, 23, 59, 50))`:
  - `'desktop shows the month and the day'`: the text contains `NOV` and `7`.
  - `'phone shows the weekday and the day'`: with `useShell` mocked to `'mobile'`, the text contains `Saturday` and `7`.
  - `'the date rolls over at midnight'`: advance 20s with `act`, and the text contains `8` (and `Sunday` on the phone).
  - `'the dark variant uses a dark tile'`: with `dark`, the tile's inline background is `#1c1c1e`.
- [ ] **Step 2:** Run `npx vitest run src/ui/CalendarIcon.test.tsx`. Expected: FAIL, the module is missing.
- [ ] **Step 3: Implement** `CalendarIcon` and the `live` branch in `AppIcon`. Fix every `'image' in icon` narrowing that TS flags. Grep for `icon.image` and `'image' in` across `src`, `scripts` and `e2e`. The e2e Dock icon helpers may select by `img`.
- [ ] **Step 4:** Run `npx vitest run src/ui src/shells` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `npx playwright test e2e/desktop.spec.ts e2e/mobile.spec.ts`. Expected: PASS. Fix any locator that relied on the Calendar `<img>`.
- [ ] **Step 6: Commit** `feat: the Calendar icon shows today's date`.

### Task 3: Phone status bar battery percentage and signal bars

**Files:**
- Modify: `src/shells/mobile/StatusBar.tsx`
- Modify: `src/shells/desktop/statusHooks.ts` (add `useNetwork`)
- Create tests: `src/shells/mobile/StatusBar.test.tsx`, `src/shells/desktop/statusHooks.test.ts`

**Interfaces:**
- Produces: `useNetwork(): { bars: 1 | 2 | 3 | 4; type?: string } | null` in `statusHooks.ts`. It reads `navigator.connection` (feature-detected, typed locally, no `any`) and listens to its `change` event. `effectiveType` maps `slow-2g → 1`, `2g → 2`, `3g → 3` and `4g → 4`. It returns null when the API or `effectiveType` is absent.
- Consumes: `useBattery()` (it already returns null when the API is absent).

**Behaviour (Ruling: signal bars show the browser's effective connection quality, as the only honest source a web page has. Safari exposes neither API, so a real iPhone shows neither. Cost: no visible change on iPhone Safari.):**
- **Bars.** When `useNetwork()` is not null, draw 4 bars left of the Wi‑Fi icon: an inline SVG 17×11, bar heights 4/6/8/10, filled bars `currentColor`, unfilled bars `currentColor` at 35% opacity. Wrap it in `role="img"` with `aria-label="Signal: 3 of 4 bars"`.
- **Battery.** When the battery is known, show the percentage as text (`text-[12px] tabular-nums`, e.g. `82%`) and draw the battery as an inline SVG 25×12: an outline with a fill width proportional to `level`. The fill is `#34c759` while charging, else `currentColor`. The level under 20% uses `#ff3b30`. Keep the existing `aria-label` `Battery 82%` and add `, charging` when charging.
- **Lock screen.** The `onWallpaper` variant keeps the white text with a shadow.

- [ ] **Step 1: Write the failing tests:**
  - `statusHooks.test.ts`: `'useNetwork maps effectiveType to bars'` (stub `navigator.connection = { effectiveType: '3g', addEventListener, removeEventListener }`, expect `bars` 3). `'useNetwork is null without the API'` (delete the stub).
  - `StatusBar.test.tsx`: `'shows battery percentage when the API reports it'` (mock `useBattery` returning `{ level: 0.82, charging: false }`, expect the text `82%`). `'shows no battery and no bars when neither API exists'`: both hooks return null, `queryByRole('img', { name: /Battery/ })` and `/Signal/` are null, and there is no `%` text. `'signal bars label'`: with bars 3, the image is named `Signal: 3 of 4 bars`.
- [ ] **Step 2:** Run `npx vitest run src/shells/mobile/StatusBar.test.tsx src/shells/desktop/statusHooks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `useNetwork` and the StatusBar changes.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: e2e contrast** in `e2e/contrast.spec.ts` at 390x844, in light and dark mode on the home screen. Use `page.addInitScript` to stub `navigator.getBattery` (level 0.5) and `navigator.connection` (`4g`). The battery fill and a filled signal bar reach 3:1 against the sampled background behind the status bar. Use the existing `contrastRatio`/`composite` helpers in `e2e/helpers.ts`.
- [ ] **Step 6:** Run `npx playwright test e2e/contrast.spec.ts e2e/mobile.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: phone status bar shows battery percentage and signal bars when the browser reports them`.

### Task 4: Dark app icons on the phone

**Owner step, before this task starts.** The controller asks the owner. Do not change system settings yourself. The owner does this:
1. In System Settings → Appearance, set the icon style to **Dark**.
2. Run `swift scripts/export-apple-icons.swift --dark` from the repo root, after Step 3 below has added the flag. Alternatively, the controller runs it on the owner's go.
3. Set the icon style back.

The controller then checks that `src/assets/icons/dark/*.png` exist and differ from the light files. A 2026-11-07 spike showed that rendering with `NSAppearance.darkAqua` alone returns the light artwork. **If the dark files equal the light ones, the task stops, reports BLOCKED and ships nothing**, because nothing may be fabricated.

**Files:**
- Modify: `scripts/export-apple-icons.swift`. A `--dark` argument writes the app icons only (no folders or documents) to `src/assets/icons/dark/<name>.png`. It uses `NSWorkspace.shared.icon(forFile:)` on each app bundle path, so the system's current icon style applies.
- Create: `src/apps/darkIcons.ts`. It exports `darkIcons: Record<string, string>` built from `import.meta.glob('../assets/icons/dark/*.png', { eager: true, import: 'default' })`, keyed by file name without extension. It also exports `darkIconsComplete(apps: AppDefinition[]): boolean`, which is true only when every app with an `image` icon has an entry.
- Modify: `src/apps/types.ts`. The image icon gains `darkKey?: string`, the export name, e.g. `'notes'`. Set it in `registry.ts` for each image app.
- Modify: `src/ui/AppIcon.tsx`.
  - Dark artwork is used when the phone shell is active, the resolved theme is dark (`document.documentElement.dataset.theme === 'dark'`, set by `src/system/settings.ts:33`; subscribe with a `MutationObserver` on that attribute so a theme switch re-renders), and `darkIconsComplete(APPS)` holds.
  - Glyph icons in dark mode: tile `#1c1c1e`, with the glyph in the icon's `background` colour.
  - The Calendar icon gets `dark`.
- Create test: `src/ui/AppIcon.test.tsx`; modify `e2e/screenshots.spec.ts`

**Interfaces:**
- Consumes: `CalendarIcon({ size, dark })` from Task 2.
- Produces: `darkIcons`, `darkIconsComplete(apps)`.

**Ruling.** All or nothing: a home screen that mixes dark and light Apple icons reads as a defect. Cost: one missing export keeps every icon light.

- [ ] **Step 1: Write the failing tests** in `AppIcon.test.tsx`, with `vi.mock('../apps/darkIcons', …)`:
  - `'phone dark mode uses the dark artwork when the set is complete'`: the `img` `src` is the mocked dark URL.
  - `'an incomplete dark set keeps the light artwork'`.
  - `'desktop dark mode keeps the light artwork'`.
  - `'a dark brand glyph sits on a dark tile in its brand colour'`.
- [ ] **Step 2:** Run `npx vitest run src/ui/AppIcon.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `darkIcons.ts`, the `darkKey` fields, the AppIcon branch and the script's `--dark` flag.
- [ ] **Step 4:** Run `npx vitest run src/ui src/apps` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Owner step** as described above. The controller verifies that the PNGs differ from the light ones (`cmp` per file), then views two of them.
- [ ] **Step 6: Screenshots.** Add `390x844-home-dark` to `e2e/screenshots.spec.ts`: phone, dark appearance, home screen. Regenerate all screenshots with `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts`.
- [ ] **Step 7: Commit** `feat: Apple's dark icons on the phone in dark mode` with `src/assets/icons/dark/` and `docs/screenshots/`.

---

## Out of scope (owner decision 2026-11-07)

Camera app, video wallpaper, PWA / Add to Home Screen, the lock screen style (owner decision 2026-10-26: macOS login screen on the desktop). Deferred from 6a and still open: genie strip seams and clone cost on a maximized 2x window, both of which need a live profile on real hardware.
