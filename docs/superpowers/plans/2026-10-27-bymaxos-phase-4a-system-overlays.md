# bymaxOS Phase 4a (System Overlays & Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The system layer that makes bymaxOS feel like macOS — Spotlight, Launchpad, Mission Control, the ⌥Tab app switcher, Notification Center and a System Settings app with accent colours.

**Architecture:** Phase 4 of the spec is split: **4a (this plan)** is the system layer; **4b** (Safari, Photos, Notes, Music, Maps, Terminal) gets its own plan written against the code 4a leaves. Every overlay is a value of the store's existing `overlay` field, opened through the existing `overlay.open` command and enabled by adding it to `AVAILABLE_OVERLAYS`, so ⌘K/⌥↑, menus and the Keyboard Shortcuts sheet light up automatically. Pure logic (search ranking, Mission Control layout, switcher ordering) lives in `src/system/` with unit tests; overlay components live in `src/shells/desktop/` and are mounted from one `Overlays.tsx`.

**Tech Stack:** Existing stack only. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` (§3.4 overlay state, §3.6 shortcuts, §4.2 menu bar, §4.3 Control Center, §4.4 Dock order, §4.7 Overlays, §5 System Settings row, §7.1). Conventions: phase 3 plan `docs/superpowers/plans/2026-10-27-bymaxos-phase-3-essential-apps.md`.

## Global Constraints

- All Phase 1–3 Global Constraints still apply (content only via `getContent()`; storage only via `safeStorage`; no dead menu items; icon-only buttons have `aria-label`; style matches the edited file, never Prettier whole files; gate `npm run typecheck && npm run lint && npm test` before each commit).
- Icons already exported: `src/assets/icons/launchpad.png`, `src/assets/icons/system-settings.png`. Do not re-run the export script.
- Only one overlay is open at a time (`overlay` is a single value). Esc closes any overlay via the existing `overlay.close` global.
- Overlays sit at `z-50` like the menu bar/dock and never cover the menu bar (`top >= MENU_BAR_H`) except Launchpad, which is full screen.
- Under `<html class="reduce-motion">` overlays appear without transitions; under `reduce-transparency` their glass is solid.
- AA contrast (≥ 4.5:1 for text) in light and dark for every new surface; filled accent backgrounds with white text use `--accent-strong`, text links use `--accent-link`.
- Commits: Conventional Commits; trailer = the attribution line the implementer's harness specifies.

## Review Focus

1. **Overlay collisions** (⌘K while Launchpad is open, ⌥Tab while Spotlight is open, clicking the clock while Control Center is open) → the new overlay replaces the old one; no stale switcher state. Pinned by the store test `setOverlay clears the app switcher` (Task 4).
2. **Spotlight queries with odd input** (`C++`, `(`, leading/trailing spaces, `wrocław` vs `Wrocław`) → no crash, literal case-insensitive matching, trimmed. Pinned by `rank` tests (Task 1).
3. **Alt released outside the page** (⌥Tab, then the browser window loses focus before ⌥ is released) → the switcher cancels on `blur`; no stuck overlay. Pinned by the DesktopShell switcher test (Task 4).
4. **Mission Control with minimized or zero windows, after a viewport resize** → minimized windows excluded, "No open windows" shown, layout computed from the current work area. Pinned by `missionLayout` and WindowLayer tests (Task 3).
5. **Stored settings from an older build** (no `accent`, or `accent: 'teal'`) → accent falls back to `blue`. Pinned by the settings test (Task 6).

---

## File Structure

```
src/system/search.ts                SearchItem, buildIndex, rank
src/system/missionLayout.ts         missionLayout
src/system/switcher.ts              runningAppsByRecency
src/system/store.ts                 + switcher state/actions; AVAILABLE_OVERLAYS grows per task
src/system/shortcuts.ts             + ⌥Tab / ⌥⇧Tab / ⌥` (shift flag on ShortcutDef)
src/system/settings.ts              + Accent, Settings.accent, data-accent
src/styles/tokens.css               + per-accent token blocks
src/shells/desktop/Overlays.tsx     mounts Spotlight, Launchpad, AppSwitcher, NotificationCenter by overlay value
src/shells/desktop/Spotlight.tsx
src/shells/desktop/Launchpad.tsx
src/shells/desktop/MissionControl.tsx   backdrop + labels (inside WindowLayer)
src/shells/desktop/AppSwitcher.tsx
src/shells/desktop/NotificationCenter.tsx
src/shells/desktop/WindowLayer.tsx, Window.tsx   Mission Control transforms
src/shells/desktop/StatusArea.tsx   clock becomes the Notification Center button
src/shells/desktop/ControlCenter.tsx  + Mission Control button; Toggle moves to src/ui/Switch.tsx
src/shells/desktop/dockLogic.ts, Dock.tsx  + overlay dock items
src/shells/desktop/menus.tsx        "System Settings…" opens the Settings app
src/apps/types.ts, registry.ts      + overlay?, launchpad?: false; launchpadApps(); launchpad + settings entries
src/apps/settings/Settings.tsx
src/content/types.ts, en/notifications.ts, index.ts   NotificationItem[]
src/system/storage.ts               + KEYS.notifications
e2e/system.spec.ts
```

Dock after this phase: Launchpad (system 0) · Finder (system 1) · Resume (system 2) │ Mail · Contacts · Calendar · Developer · System Settings (apps 1–5) │ LinkedIn · GitHub │ Trash.

---

### Task 1: Spotlight

**Files:**
- Create: `src/system/search.ts`, `src/system/search.test.ts`, `src/shells/desktop/Spotlight.tsx`, `src/shells/desktop/Spotlight.test.tsx`, `src/shells/desktop/Overlays.tsx`
- Modify: `src/system/store.ts` (`AVAILABLE_OVERLAYS` + `'spotlight'`), `src/shells/desktop/DesktopShell.tsx` (mount `<Overlays />` after `<Banners />`)

**Interfaces:**
- Produces:
  ```ts
  export type SearchKind = 'app' | 'document' | 'project' | 'experience' | 'skill' | 'folder'
  export interface SearchItem { id: string; title: string; subtitle: string; kind: SearchKind; command: Command; appId?: AppId; nodeId?: string }
  export function buildIndex(content: Content, apps: AppDefinition[]): SearchItem[]
  export function rank(items: SearchItem[], query: string, limit?: number): SearchItem[]   // limit default 8
  ```
  `Overlays.tsx` exports `Overlays()` — later tasks add their overlay to it.

- [ ] **Step 1: Write failing tests**

`search.test.ts` (use real `getContent()` and `APPS`):
- `indexes launchable apps with dock.activate` — item `{ kind: 'app', title: 'Mail', command: { type: 'dock.activate', appId: 'mail' }, appId: 'mail' }`; no items for `quicklook` or `textedit` (both `deepLink: false`).
- `indexes about documents, projects, experience, skills and folders with their open commands` — `Hello.md` → `{ type: 'app.open', appId: 'textedit', props: { fileId: 'doc-hello' } }`; each project → fileId `project-<id>`; each experience (title `${role} — ${company}`, subtitle `company`) → fileId `work-<id>`; each skill item (subtitle = group label) → fileId `doc-skills`, a skill listed in two groups appears once; folders `About Me`, `Work`, `Projects`, `Documents` → `{ type: 'app.open', appId: 'finder', props: { folderId } }`, `nodeId` set.
- `rank prefers title prefix, then word prefix, then substring, then subtitle` — query `re` orders `Resume` before an item whose second word starts with `re` before one containing `re` mid-word before a subtitle-only match.
- `rank breaks ties by kind (app, document, project, experience, skill, folder) then title`.
- `rank is case-insensitive, trims, and treats regex characters literally` — `'  RESUME '` finds Resume; `'C++'` and `'('` return arrays without throwing; `'wrocław'` matches a subtitle `Wrocław`.
- `rank returns [] for an empty query and caps at limit`.

`Spotlight.test.tsx` (store overlay = `'spotlight'`):
- `focuses the search field on open` — `role="combobox"` named `Spotlight Search` has focus.
- `typing lists results; ArrowDown/ArrowUp move the active option with wrap; Enter runs it and closes` — type `resume` → first option `Resume` active (`aria-activedescendant`); Enter → a `resume` window exists and `overlay` is `null`.
- `clicking a result runs it` and `clicking outside the panel closes Spotlight`.
- `shows No Results for a query with no match`.

- [ ] **Step 2: Run** `npx vitest run src/system/search.test.ts src/shells/desktop/Spotlight.test.tsx` — FAIL.

- [ ] **Step 3: Implement**
- Apps indexed: `(load && deepLink !== false) || external || alias` (Task 2 extends this to overlay apps). Command for every app: `{ type: 'dock.activate', appId }` (the Dock's existing global handles open/focus/restore/external/alias).
- Score: 0 title starts with q; 1 a word of the title starts with q; 2 title contains q; 3 subtitle contains q; otherwise excluded. Compare with `toLocaleLowerCase('en')`; no RegExp built from the query.
- UI: fixed click-catcher `inset-0 z-50` (transparent, closes on mousedown outside the panel); panel `top: 20vh`, centred, `w-[640px] max-w-[calc(100vw-32px)]`, glass like Control Center, 20px input with a `Search` glyph; results `role="listbox"` (max 8), each row: icon (`AppIcon` size 28 for `appId`, `<img src={iconFor(node)}>` for `nodeId`, else nothing), title, subtitle in `text-text-2`; active row `bg-accent-strong text-white`. Dispatch via `dispatch`, then `setOverlay(null)`.
- `AVAILABLE_OVERLAYS` gains `'spotlight'` (⌘K and the menu-bar Spotlight icon become enabled with no further code).

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Spotlight search`

---

### Task 2: Launchpad

**Files:**
- Create: `src/shells/desktop/Launchpad.tsx`, `src/shells/desktop/Launchpad.test.tsx`
- Modify: `src/apps/types.ts`, `src/apps/registry.ts`, `src/apps/registry.test.ts`, `src/shells/desktop/dockLogic.ts`, `src/shells/desktop/dockLogic.test.ts`, `src/shells/desktop/Dock.tsx`, `src/shells/desktop/Dock.test.tsx`, `src/shells/desktop/Overlays.tsx`, `src/system/store.ts`, `src/system/search.ts` (+test)

**Interfaces:**
- Consumes: `Overlays` (Task 1), `buildIndex` (Task 1).
- Produces: `AppDefinition.overlay?: Exclude<Overlay, null>`; `AppDefinition.launchpad?: false`; `launchpadApps(): AppDefinition[]` in registry; `DockAction` gains `{ type: 'overlay'; overlay: Exclude<Overlay, null> }`.

- [ ] **Step 1: Write failing tests**
- `dockLogic.test.ts`: `an overlay app opens its overlay` — `dockClickAction(wm, launchpadApp)` → `{ type: 'overlay', overlay: 'launchpad' }`.
- `registry.test.ts`: dock order starts `['launchpad', 'finder', 'resume', …]`; `launchpadApps()` returns names sorted alphabetically, includes `Mail`, `LinkedIn`, `TextEdit` is excluded (deepLink false), and excludes `launchpad`, `quicklook`, `about`, `trash`.
- `search.test.ts`: `Launchpad is searchable and opens via dock.activate`.
- `Launchpad.test.tsx` (overlay = `'launchpad'`):
  - `shows every launchpadApps() entry as a button named after the app`.
  - `the search field filters by name, case-insensitive; no match shows No Results`.
  - `clicking an app activates it and closes Launchpad` — click `Mail` → a `mail` window, `overlay` null.
  - `clicking the background closes Launchpad`; the search field has focus on open.
- `Dock.test.tsx`: clicking the Launchpad dock icon sets `overlay` to `'launchpad'`; clicking it again while open closes it.

- [ ] **Step 2: Run** the touched test files — FAIL.

- [ ] **Step 3: Implement**
- `dockClickAction`: `if (app.overlay) return { type: 'overlay', overlay: app.overlay }` first; Dock's executor toggles: same overlay open → `setOverlay(null)`, else `setOverlay(overlay)`. Overlay apps show no running dot and their dock context menu is just `Open`.
- `launchpadApps()`: `(load && deepLink !== false) || external || alias` minus `launchpad === false`, sorted by `name` (`localeCompare`). Mark `about` and `trash` with `launchpad: false`.
- Registry entry: `{ id: 'launchpad', name: 'Launchpad', icon: { image: launchpadIcon }, overlay: 'launchpad', launchpad: false, dock: { order: 0, group: 'system' } }`.
- Search index: apps with `overlay` are indexed too.
- `Launchpad.tsx`: `fixed inset-0 z-50`, full-screen backdrop `bg-black/30` + `backdrop-blur-2xl` (solid `bg-[#1e1e1e]/95` under reduce-transparency), search field top-centre (`aria-label="Search apps"`, 220px), grid `grid-cols-[repeat(auto-fill,minmax(120px,1fr))]` max-width 960 centred; each app a button with `AppIcon` size 80 and a white 13px label with text-shadow; open/close fade 150ms. Activation = `dispatch({ type: 'dock.activate', appId })` then `setOverlay(null)`.
- `AVAILABLE_OVERLAYS` gains `'launchpad'`; Overlays mounts Launchpad.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Launchpad and overlay dock items`

---

### Task 3: Mission Control

**Files:**
- Create: `src/system/missionLayout.ts`, `src/system/missionLayout.test.ts`, `src/shells/desktop/MissionControl.tsx`
- Modify: `src/shells/desktop/WindowLayer.tsx`, `src/shells/desktop/Window.tsx`, `src/shells/desktop/WindowLayer.test.tsx` (create if absent), `src/shells/desktop/ControlCenter.tsx` (+test), `src/system/store.ts`

**Interfaces:**
- Produces: `missionLayout(items: { id: string; w: number; h: number }[], area: Rect, gap?: number): Record<string, Rect>` (gap default 32); `Window` prop `mission?: { target: Rect; onPick: () => void }`.

- [ ] **Step 1: Write failing tests**

`missionLayout.test.ts`:
- `centres a single window at scale 1 when it fits` — `[{ id: 'a', w: 800, h: 600 }]`, area `{ x: 0, y: 0, w: 1200, h: 800 }` → `{ a: { x: 200, y: 100, w: 800, h: 600 } }`.
- `fits four windows into a 2×2 grid` — four `1000×800`, same area → `a: { x: 88, y: 32, w: 440, h: 352 }`, `b.x === 672`, `c.y === 416`.
- `never scales up` and `returns {} for no windows`; `respects area.x/area.y offsets` (area `{ x: 0, y: 24, … }` shifts every `y` by 24).

`WindowLayer.test.tsx` (open three windows through the store, minimize one, set overlay `'missionControl'`):
- `only non-minimized windows get a Show button` — buttons `Show <title>` for the two visible windows; the minimized one has none.
- `picking a window focuses it and closes Mission Control`.
- `with no visible windows shows No open windows`; `clicking the backdrop closes Mission Control`.
- `window content is inert while Mission Control is open` (`inert` attribute on the content wrapper).

`ControlCenter.test.tsx`: `Mission Control button opens Mission Control and closes Control Center`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Layout: `cols = ceil(sqrt(n))`, `rows = ceil(n / cols)`; `cellW = (area.w - gap * (cols + 1)) / cols`, `cellH` likewise; `scale = min(1, cellW / w, cellH / h)`; rect centred in its cell; items in the given order (WindowLayer passes windows sorted by `z` ascending).
- `WindowLayer`: when `overlay === 'missionControl'`, compute targets from `getWorkArea(viewport)` (store viewport, `src/system/layout.ts`) and render `<MissionControl>` (backdrop `absolute inset-0 bg-black/45 pointer-events-auto`, closes on click; "No open windows" centred white text when empty; a white 13px title label under each target rect) *before* the windows.
- `Window` with `mission`: `transform-origin: 0 0`, `transform: translate(target.x - rect.x px, target.y - rect.y px) scale(target.w / rect.w)`, `transition: transform 300ms ease` (no transition under `.reduce-motion`), content wrapper `inert`, plus an absolutely positioned `<button aria-label={\`Show ${win.title}\`}>` covering the window (hover/focus: `ring-4 ring-accent`) calling `onPick`.
- `onPick`: `focus(id)` then `setOverlay(null)`.
- Control Center: a full-width tile button `Mission Control` dispatching `{ type: 'overlay.open', overlay: 'missionControl' }`.
- `AVAILABLE_OVERLAYS` gains `'missionControl'` (⌥↑ and the Shortcuts sheet row light up).

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Mission Control`

---

### Task 4: App switcher (⌥Tab)

**Files:**
- Create: `src/system/switcher.ts`, `src/system/switcher.test.ts`, `src/shells/desktop/AppSwitcher.tsx`, `src/shells/desktop/AppSwitcher.test.tsx`
- Modify: `src/system/store.ts` (+test), `src/system/shortcuts.ts` (+test), `src/system/commands.ts` (+test), `src/shells/desktop/DesktopShell.tsx` (+test), `src/shells/desktop/ShortcutsSheet.tsx`, `src/shells/desktop/Overlays.tsx`

**Interfaces:**
- Produces: `runningAppsByRecency(wm: WMState): AppId[]`; store `switcher: { appIds: AppId[]; index: number } | null`, `switcherStep(dir: 1 | -1): void`, `switcherCommit(index?: number): void`; commands `switcher.next`, `switcher.prev`; `ShortcutDef.shift?: true`.

- [ ] **Step 1: Write failing tests**
- `switcher.test.ts`: `orders apps by their highest window z, most recent first, including apps whose windows are all minimized; each app once`.
- `shortcuts.test.ts`: `⌥Tab → switcher.next`, `⌥\` (code Backquote) → switcher.next`, `⌥⇧Tab → switcher.prev`; `⌥Tab with ctrl or meta does not match`; `⇧Tab alone does not match`.
- `store.test.ts`:
  - `first switcherStep(1) opens the switcher on the second most recent app` (`overlay === 'appSwitcher'`, `index === 1`); with one running app `index === 0`; `switcherStep(-1)` first opens on the last app.
  - `further steps wrap`.
  - `switcherCommit focuses the chosen app's top visible window, or restores its top minimized window, and closes the switcher`.
  - `setOverlay clears the app switcher` (e.g. `setOverlay('spotlight')` → `switcher === null`).
- `commands.test.ts`: `switcher.next is disabled with no windows`.
- `DesktopShell.test.tsx`: `releasing Alt commits the switcher` (keydown Alt+Tab twice, keyup `Alt` → second app focused); `window blur cancels the switcher` (`overlay` null, focus unchanged).
- `AppSwitcher.test.tsx`: `renders a listbox named App Switcher with one option per app, the selected option aria-selected and its name visible`; `clicking an option commits that app`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Shortcuts: add `{ combo: '⌥Tab', code: 'Tab', modifier: 'alt', command: { type: 'switcher.next' }, when: 'always' }`, `{ combo: '⌥⇧Tab', code: 'Tab', modifier: 'alt', shift: true, command: { type: 'switcher.prev' }, … }`, `{ combo: '⌥\`', code: 'Backquote', modifier: 'alt', command: { type: 'switcher.next' }, … }`; `modifiersMatch` requires `e.shiftKey === Boolean(s.shift)`.
- Globals `switcher.next` / `switcher.prev` → `switcherStep(±1)`, enabled when `wm.windows.length > 0`.
- `setOverlay(o)` sets `switcher: null` unless `o === 'appSwitcher'`. `switcherCommit` uses the wm functions the Dock uses for focus/restore (`raiseAppWindows` / `restoreWindow`), then clears.
- DesktopShell: `keyup` with `e.key === 'Alt'` while `switcher` is set → `switcherCommit()`; `window` `blur` → `setOverlay(null)`.
- ShortcutsSheet labels: `'switcher.next': 'Switch apps'`, `'switcher.prev': 'Switch apps backwards'`.
- `AppSwitcher.tsx`: centred fixed glass panel (radius 18, padding 12), row of `AppIcon` size 96 inside 112px cells; selected cell `bg-white/25 rounded-[14px]`; app name under the row (white 13px on the glass, selected app only); `role="listbox"` `aria-label="App Switcher"`, options `aria-selected`. No transition.
- `AVAILABLE_OVERLAYS` gains `'appSwitcher'`; Overlays mounts it.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add the ⌥Tab app switcher`

---

### Task 5: Notification Center

**Files:**
- Create: `src/content/en/notifications.ts`, `src/shells/desktop/NotificationCenter.tsx`, `src/shells/desktop/NotificationCenter.test.tsx`
- Modify: `src/content/types.ts`, `src/content/index.ts`, `src/content/content.test.ts`, `src/system/storage.ts` (`KEYS.notifications: 'bymaxos.notifications'`), `src/shells/desktop/StatusArea.tsx` (+test), `src/shells/desktop/Overlays.tsx`, `src/system/store.ts`

**Interfaces:**
- Produces: content `interface NotificationItem { id: string; title: string; body: string; appId?: string }`, `Content.notifications: NotificationItem[]`.

- [ ] **Step 1: Write failing tests**
- `content.test.ts`: `notification ids are unique, titles and bodies non-empty, appIds exist in the registry`.
- `StatusArea.test.tsx`: `the clock is a button named Notification Center that toggles the panel` (`aria-expanded`).
- `NotificationCenter.test.tsx` (overlay `'notificationCenter'`, sessionStorage cleared):
  - `lists every content notification under a Notifications heading`.
  - `clicking a card with appId opens that app and closes the panel`.
  - `Dismiss <title> removes one card and the dismissal survives reopening` (stored under `KEYS.notifications` in session storage).
  - `Clear All dismisses every card and shows No Notifications`.
  - `Escape and an outside click close the panel`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Seed (exact copy; `// TODO(content): review notification copy`):
  1. `{ id: 'welcome', title: 'Welcome to bymaxOS', body: 'This Mac is my portfolio. Open Resume for the short version, or explore Finder.', appId: 'resume' }`
  2. `{ id: 'open-to-work', title: 'Open to new roles', body: profile.lookingFor, appId: 'mail' }`
  3. `{ id: 'github', title: 'Code on GitHub', body: 'Developer lists my public repositories, straight from GitHub.', appId: 'developer' }`
- No timestamps are shown (nothing invented).
- Panel: fixed `right: 8`, `top: MENU_BAR_H + 8`, `w-[356px]`, `max-h-[calc(100vh-MENU_BAR_H-16px)]` scrollable; heading `Notifications` and a `Clear All` text button; cards = glass rows with the app icon (24px), title (13px semibold), body (13px); each card is a button when it has `appId`, with a separate `Dismiss <title>` ✕ button; slide in from the right 200ms (none under reduce-motion). Outside mousedown closes (ignore clicks on the clock button itself, which toggles).
- Clock: wrap the existing `<time>` in `<button aria-label="Notification Center" aria-expanded>` toggling `'notificationCenter'`.
- `AVAILABLE_OVERLAYS` gains `'notificationCenter'`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Notification Center`

---

### Task 6: Accent colours and System Settings

**Files:**
- Create: `src/ui/Switch.tsx`, `src/apps/settings/Settings.tsx`, `src/apps/settings/Settings.test.tsx`
- Modify: `src/system/settings.ts` (+test), `src/system/store.ts` (settings merge), `src/styles/tokens.css`, `src/styles/styles.test.ts`, `src/shells/desktop/ControlCenter.tsx` (use `Switch`), `src/shells/desktop/menus.tsx` (+test), `src/apps/registry.ts` (+test), `src/shells/desktop/Dock.test.tsx`

**Interfaces:**
- Produces: `export type Accent = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'graphite'`; `export const ACCENTS: Accent[]` (that order); `Settings.accent: Accent` (default `'blue'`); `applyAppearance` sets `root.dataset.accent`; `Switch({ label, checked, onChange })` (the Control Center `Toggle`, moved).

- [ ] **Step 1: Write failing tests**
- `settings.test.ts`: `default accent is blue`; `applyAppearance sets data-accent`.
- `store.test.ts` (or the settings-loading test that exists): `stored settings without accent, or with an unknown accent, load as blue`.
- `styles.test.ts`: for every non-blue accent, parse `tokens.css` and assert `--accent-strong` vs `#ffffff` ≥ 4.5, light `--accent-link` vs `#ececec` ≥ 4.5, dark `--accent-link` vs `#1e1e1e` ≥ 4.5.
- `menus.test.ts` (or `menus.tsx` test): `System Settings… opens the settings app` (command `{ type: 'app.open', appId: 'settings' }`, enabled).
- `Settings.test.tsx`:
  - `sidebar sections Appearance, Wallpaper, Accessibility, Dock; Appearance is selected first (aria-current)`; no Language section.
  - `props.item 'dock' opens the Dock section` (deep link `?app=settings&item=dock`).
  - `Appearance: Light/Dark/Auto radios update settings.appearance`; `accent swatches are a radiogroup named Accent colour with one radio per ACCENTS entry (accessible names Blue, Purple, …) updating settings.accent`.
  - `Wallpaper: one radio per site wallpaper, named by wallpaper name`.
  - `Accessibility: Reduce motion and Reduce transparency switches`.
  - `Dock: Size slider (min 40, max 72, step 4) updates settings.dockSize; Magnification switch updates settings.dockMagnification`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Token blocks (blue keeps today's values; `--accent` is the swatch colour):

  | accent | `--accent` | `--accent-strong` | light `--accent-link` | dark `--accent-link` |
  |---|---|---|---|---|
  | purple | `#a550a7` | `#a550a7` | `#994a9b` | `#b76cb9` |
  | pink | `#f74f9e` | `#e20a70` | `#cd0965` | `#f74f9e` |
  | red | `#ff5257` | `#eb0007` | `#d40006` | `#ff5257` |
  | orange | `#f7821b` | `#ba5a07` | `#a65106` | `#f7821b` |
  | yellow | `#ffc600` | `#8f6f00` | `#826500` | `#ffc600` |
  | green | `#62ba46` | `#458331` | `#3e762c` | `#62ba46` |
  | graphite | `#8c8c8c` | `#757575` | `#686868` | `#8c8c8c` |

  Selectors: `:root[data-accent='purple'] { … }` and `:root[data-theme='dark'][data-accent='purple'] { --accent-link: … }`, placed after the theme blocks.
- Settings merge: unknown/missing `accent` → `'blue'` (validate against `ACCENTS`).
- `Settings.tsx` default export `SettingsApp({ windowId, props })`: left sidebar (180px, buttons with `aria-current="page"` on the active one), right pane with an `h2` per section; controls bind to `useSystem` `settings` / `updateSettings`. Wallpaper radios reuse the Control Center wallpaper thumbnails' look. No Language section (single locale).
- Registry: `{ id: 'settings', name: 'System Settings', icon: { image: systemSettingsIcon }, load, window: { defaultSize: { w: 680, h: 520 }, minSize: { w: 560, h: 420 }, resizable: true, singleInstance: true }, dock: { order: 5, group: 'apps' } }`.
- `menus.tsx`: `System Settings…` → `{ type: 'app.open', appId: 'settings' }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add System Settings with accent colours`

---

### Task 7: End-to-end coverage for Phase 4a

**Files:**
- Create: `e2e/system.spec.ts`

**Interfaces:**
- Consumes: `unlock`, `settle`, `openDock` from `e2e/helpers.ts`; the axe pattern in `e2e/apps.spec.ts`.

- [ ] **Step 1: Write the tests** (abort `https://api.github.com/**` in `beforeEach`)
- `⌘K opens Spotlight; typing resume and Enter opens Resume`.
- `the Spotlight menu-bar icon opens Spotlight; Esc closes it`.
- `Launchpad from the dock opens Mail and closes`.
- `⌥↑ shows Mission Control; clicking a window focuses it` — open Finder and Mail, press `Alt+ArrowUp`, click the `Show …` button of the Finder window (its title is the folder name, e.g. `Show Desktop`) → that window is focused, overlay gone.
- `⌥Tab switches to the previous app` — open Finder then Mail; `keyboard.down('Alt')`, `press('Tab')`, `up('Alt')` → Finder focused.
- `Notification Center: dismissing a card persists after reopening`.
- `System Settings: choosing Purple changes --accent-strong to #a550a7; Dock size slider resizes the dock` (compare a dock button's width before/after).
- `axe passes with Spotlight (with results), Launchpad, Notification Center and System Settings open` — light and dark.

- [ ] **Step 2: Run** `npm run e2e` — all pass (32 existing + new). Fix app code, not tests, for real bugs.
- [ ] **Step 3: Gate + build** — `npm run typecheck && npm run lint && npm test && npm run build`; shell chunk ≤ 150 KB gzip.
- [ ] **Step 4: Commit** `test: add e2e coverage for system overlays and settings`
