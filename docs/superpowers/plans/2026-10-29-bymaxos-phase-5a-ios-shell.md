# bymaxOS Phase 5a (iOS Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile placeholder with an iOS-style shell — lock screen with swipe-up unlock, home screen with widgets, pages, dock and search, and apps opening full screen (Mail as a sheet) with a home indicator.

**Architecture:** Spec phase 5 is split: **5a (this plan)** is the shell; **5b** adapts individual apps to narrow screens (list → detail nav stack, left-edge swipe back, Terminal quick-command chips) and gets its own plan written against the code 5a leaves. The mobile shell reuses the existing store: apps open through `openApp` as ordinary window state, and the shell shows the focused window full screen while `mobileHome` is false. Pure gesture maths (rubber band, unlock decision, page index) lives in `src/shells/mobile/gestures.ts` under unit test.

**Tech Stack:** Existing stack. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` §6 (Mobile), §3.8 (shell selection, deep links), §7.1 (a11y). Conventions: `docs/superpowers/plans/2026-10-29-bymaxos-phase-4b-more-apps.md`.

## Global Constraints

- All earlier Global Constraints apply (content via `getContent()`; storage via `safeStorage` with validated reads; icon-only buttons have `aria-label`; style matches the file; gate `npm run typecheck && npm run lint && npm test` before each commit; commit trailer = the attribution line the implementer's harness specifies).
- Mobile shell only when `selectShell` says `mobile` (`(max-width: 767px)` or coarse pointer and height ≤ 500px); tablets ≥ 768px keep the desktop shell. Desktop-only features (menu bar, dock, windows chrome, Mission Control, app switcher, Launchpad) never render in the mobile shell.
- Layout: `100dvh`, `env(safe-area-inset-*)` padding on the status bar, home indicator and dock; touch targets ≥ 44×44px; portrait and landscape both usable.
- Every gesture has a tap/keyboard alternative. Visual-only press feedback (`active:scale-95`); no vibration API, no permission prompts.
- Text over the wallpaper is white with a text shadow on a wallpaper scrim of `rgb(0 0 0 / 0.4)` (≥ 4.5:1 for 12px labels over the brightest default-wallpaper stop `#f2a65a`); other text sits on opaque surfaces with theme tokens. Focus rings over the wallpaper are `ring-white`; on opaque app surfaces `ring-accent-link`.
- Reduce motion: no zoom/slide/bounce animations (instant transitions); reduce transparency: solid surfaces.
- Unlock state is shared with the desktop (`store.locked` / `unlock()`, persisted in session as today).

## Review Focus

1. **Swipe-up released short or slow** (dy < 30% height and velocity < 0.5 px/ms) → springs back and stays locked; a fast flick unlocks even when short. Pinned by `shouldUnlock` tests (Task 2).
2. **Rotation / resize while an app is open or the lock screen is mid-drag** → layout recomputes, no stuck translate. Pinned by the LockScreen resize test (Task 2) and the home grid columns test (Task 3).
3. **Opening an app that is already open** (tap icon twice, Spotlight result for an open app, Resume → Mail from inside an app) → the existing window comes to the foreground; no duplicate stacks. Pinned by `openMobileApp` tests (Task 1).
4. **Deep link `?app=<id>` on a phone, including hidden or external apps** → after unlock the app opens (fullscreen/sheet); external opens a new tab and stays on home; hidden ids fall back to home. Pinned by MobileShell deep-link tests (Task 4).
5. **Shell switch while the phone shell has an app open** (rotate an iPad mini across 768px, or resize a desktop browser) → the same windows appear in the other shell; nothing is lost. Pinned by the App shell-switch test (Task 1).

---

## File Structure

```
src/shells/appComponents.ts            componentFor(app) — shared lazy cache (moved out of WindowLayer)
src/system/store.ts                    + mobileHome, openMobileApp, goHome
src/system/notifications.ts            readDismissed, saveDismissed (moved out of NotificationCenter)
src/apps/registry.ts                   + mobile presentations; mobileHomeApps(), mobileDockApps(), mobileLinkApps()
src/shells/mobile/MobileShell.tsx      locked → LockScreen; home → HomeScreen; app → AppScreen
src/shells/mobile/StatusBar.tsx        time, online, battery (safe-area top)
src/shells/mobile/gestures.ts          rubberBand, shouldUnlock, pageFromScroll
src/shells/mobile/LockScreen.tsx
src/shells/mobile/HomeScreen.tsx       pages, widgets, grid, dock, page dots, pull-down search trigger
src/shells/mobile/MobileSearch.tsx
src/shells/mobile/AppScreen.tsx        fullscreen / sheet host + HomeIndicator
src/App.tsx                            MobilePlaceholder → MobileShell (placeholder deleted)
e2e/mobile.spec.ts
```

---

### Task 1: Mobile app host

**Files:**
- Create: `src/shells/appComponents.ts`, `src/shells/mobile/MobileShell.tsx`, `src/shells/mobile/StatusBar.tsx`, `src/shells/mobile/AppScreen.tsx`, `src/shells/mobile/AppScreen.test.tsx`
- Modify: `src/shells/desktop/WindowLayer.tsx` (use `componentFor`), `src/system/store.ts` (+test), `src/apps/registry.ts` (+test), `src/App.tsx` (+test), delete `src/shells/mobile/MobilePlaceholder.tsx` and its tests/e2e references (replace the e2e placeholder tests with "mobile shell renders the lock screen" in Task 5).

**Interfaces:**
- Produces:
  ```ts
  // appComponents.ts
  export function componentFor(app: AppDefinition): LazyExoticComponent<ComponentType<AppProps>> | null
  export function resetComponent(appId: AppId): void
  // store
  mobileHome: boolean                                   // initial true
  openMobileApp(appId: AppId, props?: Record<string, unknown>): void
  goHome(): void
  // registry
  export function mobileHomeApps(): AppDefinition[]     // presentation fullscreen|sheet, not in the mobile dock, registry order
  export function mobileDockApps(): AppDefinition[]     // ['contacts','mail','safari','resume'] in that order
  export function mobileLinkApps(): AppDefinition[]     // presentation 'external'
  ```
  `MobileShell` renders (locked) a temporary `<button>Unlock</button>` calling `unlock()` until Task 2, (home) a temporary list of `mobileHomeApps()` buttons until Task 3, (app) `<AppScreen />`.

- [ ] **Step 1: Write failing tests**
- `registry.test.ts`: presentations — `mail: 'sheet'`; `linkedin`, `github: 'external'`; `quicklook`, `about`, `launchpad`, `trash`, `textedit: 'hidden'`; every other app `fullscreen` (default when `mobile` is unset). `mobileDockApps()` ids are `['contacts','mail','safari','resume']`; `mobileHomeApps()` excludes dock, hidden and external apps.
- `store.test.ts`:
  - `openMobileApp opens the app, focuses it and leaves home` (`mobileHome === false`, `wm.focusedId` is the new window).
  - `openMobileApp on an app with a window focuses that window instead of opening another` (also when it is minimized → restored).
  - `openMobileApp passes props (merged into an existing singleInstance window)`.
  - `goHome sets mobileHome true and keeps windows`.
  - `openMobileApp on an external app opens a new tab and stays home`; `on a hidden app does nothing`.
- `AppScreen.test.tsx`:
  - `renders the focused window's app full screen with a status bar and a home indicator button named "Home"`.
  - `Home (click, Enter, or an upward swipe ≥ 60px starting on the indicator) calls goHome`.
  - `a sheet app (Mail) renders in a role="dialog" sheet named after the app with a "Close" button that goes home; the home screen stays visible behind (aria-hidden)`.
  - `app.open dispatched from inside an app (e.g. Resume → Mail) brings the new window to the foreground`.
- `App.test.tsx`: `switching the shell from desktop to mobile keeps the open windows (the focused one is shown)`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- `componentFor` moves the lazy cache out of `WindowLayer` unchanged (WindowLayer's reset path uses `resetComponent`).
- `openMobileApp`: resolve app; `external` → `window.open(url, '_blank', 'noopener,noreferrer')`; `hidden` → no-op; else reuse `dockClickAction`'s rule (focus top visible window of the app, else restore minimized, else `openApp`), merge `props` into the reused window, set `mobileHome: false`.
- In `MobileShell`, subscribe to `wm.focusedId`: when it changes to a new non-null id (e.g. `app.open` from inside an app), set `mobileHome: false`.
- `AppScreen`: full-viewport surface `bg-window`; `StatusBar` (time `HH:MM` 24h via `Intl`, Wi-Fi from `useOnline`, battery from `useBattery` when available — both hooks from `src/shells/desktop/statusHooks.ts`) at top with `padding-top: env(safe-area-inset-top)`; app component in a scrollable middle region; home indicator: a 134×5px pill inside a 44px-tall `<button aria-label="Home">` with `padding-bottom: env(safe-area-inset-bottom)`. Sheet presentation: dimmed home behind, sheet from `top: 48px`, radius 12 top corners, grabber, header with app name and `Close`. Open animation: zoom from 0.9 + fade 220ms (none under reduce-motion).
- Registry: add `mobile: { presentation }` per the test list.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: host apps full screen in the mobile shell`

---

### Task 2: Lock screen

**Files:**
- Create: `src/shells/mobile/gestures.ts`, `src/shells/mobile/gestures.test.ts`, `src/shells/mobile/LockScreen.tsx`, `src/shells/mobile/LockScreen.test.tsx`, `src/system/notifications.ts`, `src/system/notifications.test.ts`
- Modify: `src/shells/desktop/NotificationCenter.tsx` (use the shared helpers), `src/shells/mobile/MobileShell.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function rubberBand(offset: number, dimension: number, c?: number): number   // c default 0.55; (1 - 1/(offset*c/dimension + 1)) * dimension
  export function shouldUnlock(dy: number, height: number, velocity: number): boolean // dy, velocity upward-positive (px, px/ms)
  export function readDismissed(): string[]; export function saveDismissed(ids: string[]): void   // session KEYS.notifications, validated
  ```

- [ ] **Step 1: Write failing tests**
- `gestures.test.ts`: `rubberBand(0, 800) === 0`; `rubberBand(100, 800)` ≈ `51.46`; `rubberBand(800, 800)` ≈ `283.87` (2 decimals); `shouldUnlock(240, 800, 0) === true` (exactly 30%); `shouldUnlock(239, 800, 0.49) === false`; `shouldUnlock(40, 800, 0.5) === true`; `shouldUnlock(-50, 800, 2) === false` (downward never unlocks).
- `notifications.test.ts`: round-trip; non-array / non-string entries → `[]`/filtered.
- `LockScreen.test.tsx` (fake timers where needed):
  - `shows the large clock (HH:MM), the date ("Thursday, October 29"), the status bar and "Swipe up to unlock"` — with `vi.setSystemTime(new Date(2026, 9, 29, 9, 41))` the clock reads `09:41`.
  - `lists content notifications; ✕ (Dismiss <title>) and a left swipe > 80px dismiss one, persisted via saveDismissed`.
  - `a drag up past the threshold unlocks; a short slow drag springs back (transform returns to none) and stays locked`.
  - `the "Unlock" button and Enter unlock` (keyboard/tap alternative).
  - `Flashlight toggles a full-screen white layer (aria-pressed); tapping the layer or the button turns it off`.
  - `Camera unlocks and opens Photos` (`openMobileApp('photos')`).
  - `a resize during a drag cancels it and resets the transform`.
- `NotificationCenter.test.tsx` still passes (uses shared helpers).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Layout: wallpaper (`Wallpaper` component from the desktop shell, same settings) + `rgb(0 0 0 / 0.4)` scrim; status bar; date (17px semibold) above clock (`text-[84px] font-light tabular-nums`); notifications as a stack of opaque cards (`var(--window-bg)`, radius 16) under the clock; bottom row: 50px circular `Flashlight` and `Camera` buttons left/right; centred bouncing chevron + `Swipe up to unlock` (white 15px), and an `Unlock` text button for tap/keyboard.
- Drag: pointer events on the whole screen except buttons/cards; translateY = −`rubberBand(dy, height)`; on release `shouldUnlock` → animate up and `unlock()`, else spring back (transition 250ms; instant under reduce-motion).
- Landscape (`height ≤ 500px`): clock and date left column, notifications right column.
- Deep link: unchanged here (Task 4).

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add the iOS lock screen with swipe-up unlock`

---

### Task 3: Home screen

**Files:**
- Create: `src/shells/mobile/HomeScreen.tsx`, `src/shells/mobile/HomeScreen.test.tsx`
- Modify: `src/shells/mobile/gestures.ts` (+test), `src/shells/mobile/MobileShell.tsx`

**Interfaces:**
- Produces: `pageFromScroll(scrollLeft: number, pageWidth: number, pageCount: number): number` (nearest page, clamped).

- [ ] **Step 1: Write failing tests**
- `gestures.test.ts`: `pageFromScroll(0, 390, 2) === 0`; `pageFromScroll(200, 390, 2) === 1`; `pageFromScroll(5000, 390, 2) === 1`; `pageFromScroll(-10, 390, 2) === 0`.
- `HomeScreen.test.tsx`:
  - `page 1 has a profile widget (button named "<profile.name>, <profile.headline> — open Resume") that opens Resume, and a calendar widget (weekday, day number, month — real date) that opens Calendar`.
  - `page 1 grid shows every mobileHomeApps() app as a button named after the app; tapping opens it`.
  - `page 2 shows mobileLinkApps() (LinkedIn, GitHub) which open in a new tab`.
  - `page dots are a tablist with 2 tabs; tapping dot 2 scrolls to page 2 and selects it`.
  - `the dock shows Contacts, Mail, Safari, Resume`.
  - `grid uses 4 columns in portrait and 6 when the viewport is landscape (width 844, height 390)`.
  - `pulling down on page 1 by more than 60px, or the "Search" button, opens search` (search itself in Task 4 — here assert the callback/state).
- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Wallpaper + scrim as on the lock screen; status bar; horizontal `snap-x snap-mandatory` scroller with 2 pages; widgets 2-wide in the grid (profile widget spans 4 columns, calendar widget 2×2 in portrait); app icons `AppIcon` 60px with 12px white label + text-shadow, cell ≥ 44px tap target; dock: glass bar (solid under reduce-transparency) with the 4 icons, `padding-bottom: env(safe-area-inset-bottom)`. Page dots: `role="tablist"` `aria-label="Home screen pages"`. A small `Search` pill above the dock (iOS 16 style) opens search.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add the iOS home screen`

---

### Task 4: Mobile search and deep links

**Files:**
- Create: `src/shells/mobile/MobileSearch.tsx`, `src/shells/mobile/MobileSearch.test.tsx`, `src/shells/mobile/MobileShell.test.tsx`
- Modify: `src/shells/mobile/MobileShell.tsx`, `src/shells/mobile/HomeScreen.tsx`

**Interfaces:**
- Consumes: `buildIndex`, `rank` (`src/system/search.ts`), `parseDeepLink` (`src/system/shell.ts`), `openMobileApp`.

- [ ] **Step 1: Write failing tests**
- `MobileSearch.test.tsx`: `full-screen sheet with a focused search field named "Search" and a Cancel button`; `typing lists ranked results (same items as Spotlight)`; `choosing an app result calls openMobileApp(appId)`; `choosing a content result (note/document/folder) opens its app with its props via openMobileApp`; `Cancel and Escape close it`.
- `MobileShell.test.tsx`:
  - `?app=resume while locked: after unlock Resume is open`.
  - `?app=mail opens the Mail sheet`; `?app=linkedin opens a new tab and stays home`; `?app=quicklook (hidden) stays home`; `?app=notes&item=working-style opens Notes with props.item`.
  - The deep link is handled once per page load (module flag, as in DesktopShell).
- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Search result commands: map `dock.activate` → `openMobileApp(appId)` and `app.open` → `openMobileApp(appId, props)`; other command types are ignored on mobile.
- Search sheet on `var(--window-bg)` with theme tokens; results as 56px rows (icon 36px, title, subtitle in `text-text-2`).

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add mobile search and deep links`

---

### Task 5: End-to-end coverage for Phase 5a

**Files:**
- Create: `e2e/mobile.spec.ts`
- Modify: `e2e/desktop.spec.ts` (remove the placeholder tests), `e2e/helpers.ts` (+ `unlockMobile(page)`: swipe up, fallback to the Unlock button)

- [ ] **Step 1: Write the tests** (viewports 390×844 and 844×390 via `test.use`; abort `https://api.github.com/**`)
- `swipe up unlocks` (touch/pointer drag from y=780 to y=300) and `a short swipe stays locked`.
- `home screen shows widgets, grid and dock; tapping Notes opens it full screen; Home returns`.
- `Resume → Email opens the Mail sheet; Close returns home`.
- `search finds "Working style" and opens Notes at that note`.
- `page 2 shows LinkedIn/GitHub` (tap dot 2).
- `landscape: lock screen shows side clock layout; home grid has 6 columns`.
- `?app=resume deep link opens Resume after unlock`.
- `axe passes on lock screen, home screen, an open app (Contacts) and the Mail sheet — light and dark`.
- [ ] **Step 2: Run** `npm run e2e` — all pass. Fix app code, not tests, for real bugs.
- [ ] **Step 3: Gate + build** — `npm run typecheck && npm run lint && npm test && npm run build`; shell ≤ 150 KB gzip.
- [ ] **Step 4: Commit** `test: add e2e coverage for the iOS shell`
