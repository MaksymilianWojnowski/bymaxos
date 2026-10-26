# bymaxOS Phases 1–2 (Foundation + Desktop System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Vite/React app whose desktop shell is a working macOS simulation — login screen, menu bar, dock, window manager, desktop icons, Finder with Quick Look, command bus, shortcuts, context menus, Control Center and About This Mac — driven by typed personal content.

**Architecture:** Pure, unit-tested window-manager functions (`src/system/wm.ts`) wrapped by one Zustand store (`src/system/store.ts`). Apps are declared in `src/apps/registry.ts`; menus, shortcuts, dock and context menus all dispatch `Command`s through `src/system/commands.ts`, which routes to global handlers or to the focused window's registered handlers and reports enablement so menus never show dead items. Personal data lives only in `src/content/en/*`, and the virtual filesystem (`src/system/vfs.ts`) is derived from it.

**Tech Stack:** Node 22, Vite (latest stable), React 19, TypeScript strict, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand 5, lucide-react, `@fontsource-variable/inter`, Vitest + @testing-library/react + jsdom + @testing-library/user-event, Playwright + @axe-core/playwright, ESLint (typescript-eslint).

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md`

## Global Constraints

- TypeScript `strict: true`; no `any` in `src/system/**` and `src/content/**`.
- Personal content only in `src/content/**`; components read it via `getContent()` — never hardcode names, links, dates.
- Never fabricate content. Unset optional field → render "Not configured yet" (exact copy) or omit the control.
- Phone number is never rendered or stored in content. Public email: `maksymilianwojnowski@gmail.com`.
- No Apple logos/icons and no assets copied from frvky.online. The top-left system menu uses a custom "M" mark.
- All `localStorage`/`sessionStorage` access goes through `src/system/storage.ts` (`safeStorage`), never directly.
- Menu items whose command cannot be dispatched render disabled (`aria-disabled="true"`); no clickable no-ops.
- Every window is rendered by `src/shells/desktop/Window.tsx`; apps never draw their own window chrome.
- Animations are skipped when `<html>` has class `reduce-motion`; glass becomes solid when it has class `reduce-transparency`.
- Asset URLs use `import.meta.env.BASE_URL` (GitHub Pages serves under `/bymaxos/`).
- Icon-only buttons have `aria-label`.
- Layout constants: menu bar `24px`, window title bar `28px`, dock reserve `84px` (bottom of work area), cascade offset `24px`, min visible title-bar width `80px`.
- Tests colocated as `src/**/*.test.ts(x)`; e2e in `e2e/*.spec.ts`.
- Commits: Conventional Commits; every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (after a blank line).

## Review Focus

1. **Viewport shrinks after windows are placed** (devtools opened, window resized 1440→1024) → every window is re-clamped so its title bar stays grabbable below the menu bar and above the dock. Pinned by `clampAll` tests (Task 5) and the e2e resize test (Task 16).
2. **Rapid repeated clicks** (double-click a dock icon, click minimize twice mid-animation) → no duplicate single-instance windows, no window stuck invisible. Pinned by `openWindow singleInstance` and `minimize twice` tests (Task 5) and the `Window` animation-guard test (Task 9).
3. **Storage unavailable** (Safari private mode, blocked site data — `localStorage` getter throws) → site loads with defaults. Pinned by `safeStorage` tests (Task 4).
4. **Shortcuts while typing** (⌥W in a text field types "∑" on macOS) → no window closes; Esc still works. Pinned by `matchShortcut` text-field tests (Task 6).
5. **Stale persisted state** (desktop icon positions for removed items, session window rects from a larger screen) → unknown ids dropped, rects clamped on load. Pinned by `loadIconPositions` (Task 12) and `hydrate` (Task 5) tests.

---

## File Structure

```
.github/workflows/ci.yml            typecheck, lint, unit, e2e, build
.github/workflows/deploy.yml        GitHub Pages deploy (workflow_dispatch only until Phase 5)
index.html                          meta, OG, noscript fallback
vite.config.ts  vitest.setup.ts  playwright.config.ts  eslint.config.js
src/
  main.tsx  App.tsx                 boot + shell selection
  styles/tokens.css                 CSS variables (light/dark, glass, radii, shadows) + Tailwind @theme
  styles/global.css                 base, reduce-motion / reduce-transparency rules, keyframes
  content/types.ts                  content types
  content/en/profile.ts links.ts experience.ts education.ts skills.ts projects.ts
             documents.ts site.ts   seeded content
  content/index.ts                  getContent(locale)
  content/content.test.ts           content validation
  system/types.ts                   Rect, Size, WindowState, WMState, WorkArea, AppId
  system/layout.ts                  constants + getWorkArea
  system/wm.ts                      pure window-manager functions
  system/storage.ts                 safeStorage
  system/settings.ts                Settings type, defaults, applyAppearance
  system/store.ts                   Zustand store (useSystem)
  system/commands.ts                command bus
  system/shortcuts.ts               matchShortcut, shortcutLabel, SHORTCUTS
  system/vfs.ts                     buildVfs
  system/shell.ts                   selectShell, parseDeepLink
  apps/types.ts                     AppDefinition, AppProps, MenuDef, MenuItemDef, MenuContext
  apps/registry.ts                  APPS, getApp, dockItems
  apps/finder/                      Finder.tsx, finderState.ts, menus.ts
  apps/quicklook/                   QuickLook.tsx (file preview app)
  apps/about/                       AboutThisMac.tsx
  ui/AppIcon.tsx  ui/Menu.tsx  ui/ContextMenu.tsx  ui/Popover.tsx  ui/Sheet.tsx
  shells/desktop/DesktopShell.tsx LoginScreen.tsx MenuBar.tsx StatusArea.tsx
                 Dock.tsx dock.ts Desktop.tsx desktopIcons.ts Window.tsx resize.ts
                 WindowLayer.tsx AppErrorBoundary.tsx ControlCenter.tsx
                 ShortcutsSheet.tsx fullscreen.ts
  shells/mobile/MobilePlaceholder.tsx
e2e/desktop.spec.ts
```

---

## Phase 1 — Foundation

### Task 1: Scaffold, tooling, CI

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `vitest.setup.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck` (`tsc -b --noEmit`), `lint`, `test` (`vitest run`), `e2e` (`playwright test`). `App` default export from `src/App.tsx`. Globals `__APP_VERSION__: string`, `__BUILD_DATE__: string` (via Vite `define`, declared in `src/vite-env.d.ts`).

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, then install: `zustand lucide-react @fontsource-variable/inter` and dev: `tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @axe-core/playwright`. Run `npx playwright install chromium`.
- [ ] **Step 2:** Configure `vite.config.ts`: plugins react + tailwind; `base: process.env.BASE_PATH ?? '/'`; `define` the two globals (version from package.json, ISO date); `test: { environment: 'jsdom', setupFiles: './vitest.setup.ts', include: ['src/**/*.test.{ts,tsx}'] }`. `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` and stubs `window.matchMedia` (returns `matches: false`).
- [ ] **Step 3: Write the failing test** `src/App.test.tsx`:

```tsx
it('renders the bymaxOS root', () => {
  render(<App />);
  expect(screen.getByTestId('bymaxos-root')).toBeInTheDocument();
});
```

- [ ] **Step 4:** Run `npm test` → FAIL (no test id).
- [ ] **Step 5:** Replace template `App.tsx` with `<div data-testid="bymaxos-root" className="h-dvh w-dvw overflow-hidden" />`; delete template CSS/assets. `index.html`: title "Maksymilian Wojnowski — bymaxOS", meta description, `viewport` with `viewport-fit=cover`, OG tags (title, description, type website), `<noscript>` with name, "Lead Frontend Developer", and links built from `src/content/en/links.ts` values (LinkedIn, GitHub, mailto) hard-copied there (the one allowed duplicate; add `<!-- keep in sync with src/content/en/links.ts -->`).
- [ ] **Step 6:** Run `npm test` → PASS; `npm run typecheck && npm run lint && npm run build` → all exit 0.
- [ ] **Step 7:** `playwright.config.ts`: `webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173, reuseExistingServer: !process.env.CI }`, `use.baseURL: 'http://localhost:4173'`, project chromium only.
- [ ] **Step 8:** `ci.yml`: on push/PR → Node 22, `npm ci`, typecheck, lint, test, `npx playwright install --with-deps chromium`, e2e (skip when `e2e/` has no specs: `--pass-with-no-tests`), build. `deploy.yml`: `workflow_dispatch` only; builds with `BASE_PATH=/bymaxos/`, uses `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [ ] **Step 9: Commit** `chore: scaffold vite react app with tooling and ci`.

### Task 2: Design tokens, settings, appearance

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/system/settings.ts`, `src/system/settings.test.ts`
- Modify: `src/main.tsx` (import styles, font)

**Interfaces:**
- Produces:
  ```ts
  export type Appearance = 'light' | 'dark' | 'auto';
  export interface Settings { appearance: Appearance; reduceMotion: boolean; reduceTransparency: boolean;
    wallpaperId: string; dockMagnification: boolean; dockSize: number /* px, 40–72 */ }
  export function defaultSettings(env: { prefersReducedMotion: boolean }): Settings // appearance 'auto', wallpaperId 'default', dockMagnification true, dockSize 52
  export function applyAppearance(s: Settings, prefersDark: boolean, root?: HTMLElement): void
  ```
  CSS variables (consumed everywhere): `--mb-h:24px; --tb-h:28px; --dock-reserve:84px; --radius-window:12px; --radius-menu:8px; --glass-bg; --glass-border; --glass-blur:24px; --menu-bg; --window-bg; --window-fg; --sidebar-bg; --text-1; --text-2; --accent:#0a84ff; --shadow-window; --shadow-window-inactive; --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", system-ui, sans-serif`. Light values under `:root[data-theme="light"]`, dark under `:root[data-theme="dark"]`. Tailwind v4 `@theme` maps colors/fonts/radii to these variables.

- [ ] **Step 1: Write failing tests** `settings.test.ts`:
  - `applyAppearance` with `appearance:'auto'` and `prefersDark:true` → `root.dataset.theme === 'dark'`; with `'light'` and `prefersDark:true` → `'light'`.
  - `reduceMotion:true` → `root.classList.contains('reduce-motion')`; flipping to false removes it. Same for `reduceTransparency` → `reduce-transparency`.
  - `defaultSettings({prefersReducedMotion:true}).reduceMotion === true`; `dockSize === 52`.
- [ ] **Step 2:** `npm test -- settings` → FAIL.
- [ ] **Step 3:** Implement `settings.ts` and the two CSS files. `global.css`: `html.reduce-motion *{animation:none!important;transition:none!important}`; `html.reduce-transparency` sets `--glass-bg` to opaque `--window-bg` and `--glass-blur:0px`; keyframes `window-open` (from `opacity:0; transform:scale(.95)` to identity, 160ms ease-out). Body: `font-family: var(--font-ui); -webkit-font-smoothing: antialiased; overscroll-behavior:none; user-select:none` (text selection re-enabled inside `[data-selectable]`).
- [ ] **Step 4:** `npm test -- settings` → PASS.
- [ ] **Step 5: Commit** `feat: add design tokens and appearance settings`.

### Task 3: Content types and seeded content

**Files:**
- Create: `src/content/types.ts`, `src/content/en/{profile,links,experience,education,skills,projects,documents,site}.ts`, `src/content/index.ts`, `src/content/content.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Profile { name: string; headline: string; location: string; email: string; avatarUrl?: string; summary: string; lookingFor: string }
  export interface Link { id: 'linkedin' | 'github' | string; label: string; url: string; kind: 'social' | 'code' | 'other' }
  export interface Experience { id: string; company: string; role: string; start: string /* 'YYYY-MM' */; end?: string; location: string; highlights: { title: string; text: string }[] }
  export interface Education { id: string; school: string; degree?: string; start: string; end?: string; location: string; notes: string[]; grade?: string }
  export interface SkillGroup { id: string; label: string; items: string[] }
  export interface Language { name: string; level: string }
  export interface Project { id: string; title: string; summary: string; bullets: string[]; tech: string[]; links: { repo?: string; demo?: string; info?: string } }
  export interface DocumentFile { id: string; folder: 'about' | 'interests'; name: string /* e.g. 'Hello.md' */; body: string /* light markdown: '# ', '- ', blank-line paragraphs */ }
  export interface Wallpaper { id: string; name: string; src?: string; gradient: string }
  export interface Site { repoUrl?: string; wallpapers: Wallpaper[]; resume: { pdfUrl?: string }; scheduling: { calUrl?: string } }
  export interface Content { profile: Profile; links: Link[]; experience: Experience[]; education: Education[]; skills: SkillGroup[];
    softSkills: string[]; languages: Language[]; projects: Project[]; documents: DocumentFile[]; site: Site }
  export type Locale = 'en';
  export function getContent(locale?: Locale): Content
  ```

- [ ] **Step 1: Write failing tests** `content.test.ts` (iterate `getContent()`):
  - every URL in `links`, `projects[].links`, `site.repoUrl`, `site.resume.pdfUrl`, `site.scheduling.calUrl` (when defined) matches `/^https:\/\//`.
  - `profile.email === 'maksymilianwojnowski@gmail.com'`; no string anywhere in `JSON.stringify(getContent())` matches `/\+48|535\s?982/` (phone guard).
  - ids unique within each array; `name`, `headline`, `summary` non-empty; each `experience.start` matches `/^\d{4}-\d{2}$/`.
  - `site.wallpapers` has an entry with id `'default'`.
- [ ] **Step 2:** `npm test -- content` → FAIL.
- [ ] **Step 3:** Write the content files with these values (copy text verbatim; source: `/Users/maksymilianwojnowski/Documents/Organization/Professional/Wojnowski_CV.pdf`):
  - **profile:** name "Maksymilian Wojnowski"; headline "Lead Frontend Developer at Nokia · M.Sc. Project Management student"; location "Wrocław, Poland"; email as above; `avatarUrl` unset with `// TODO(content): avatar photo`; summary = CV "About Me" paragraph verbatim; lookingFor "Scrum Master and Product Manager roles".
  - **links:** linkedin `https://www.linkedin.com/in/maksymilian-wojnowski-647585254/` (social), github `https://github.com/MaksymilianWojnowski` (code).
  - **experience:** `nokia` — Nokia, Lead Frontend Developer, 2025-10, no end, "Wrocław, Poland", 5 highlights (Ceremonies & facilitation / Technical ownership / Stakeholder collaboration / External code review / Documentation & quality, text verbatim from CV). `code-technica` — Code Technica, Frontend Developer, 2024-07 → 2025-09, "Miami, USA (Hybrid)", 3 highlights (Feature development / UX & workflow improvements / Performance & maintainability).
  - **education:** `wust-msc` (M.Sc. in Project Management, 2026-03 →, coursework + competencies notes), `wust-beng` (B.Eng. in Technical Computer Science — Graphics & Multimedia Systems, 2022-10 → 2026-02, grade "5/5"), `shibaura` (Shibaura Institute of Technology, 2025-03 → 2025-08, "Tokyo, Japan", coursework note).
  - **skills:** groups `pm` "PM / Scrum Master", `data` "BI / Data", `frontend` "Frontend", `tools` "Tools" — items split from CV lines. **softSkills:** the 6 CV soft skills. **languages:** Polish native; English fluent (C1/C2); Portuguese basic (A2).
  - **projects:** `thesis` (Engineering Thesis — Multidimensional analysis in data warehouses using BI tools; 3 bullets), `solve-unite` (Solve & Unite! — International Hackathon; 2 bullets; links.info `https://unite.pwr.edu.pl/oferty/unite-seed-fund-ideathon-przeksztalc-pomysly-w-projekty-o-zasiegu-miedzynarodowym/`), `ligapwr` (LigaPWr Web App; tech Django, HTML, CSS, GitHub Projects; repo `https://github.com/informatyzacja/LigaPWr`).
  - **documents:** id `hello` about/`Hello.md` (headline + summary), id `skills` about/`Skills.md` (groups as `# ` + `- ` list), id `languages` about/`Languages.md`. Interests folder empty with `// TODO(content): interests notes`.
  - **site:** `repoUrl` unset (TODO), wallpapers: `default` "Sonoma Dusk" gradient `linear-gradient(160deg,#1b2a4a 0%,#3b3f8f 35%,#c0587e 70%,#f2a65a 100%)` and `graphite` "Graphite" `linear-gradient(160deg,#2b2b2e,#4a4a52 60%,#6b6b75)`; both `src` unset (`// TODO(content): personal wallpaper`). `resume.pdfUrl` unset (`// TODO(content): phone-free PDF`), `scheduling.calUrl` unset.
- [ ] **Step 4:** `npm test -- content` → PASS.
- [ ] **Step 5: Commit** `feat: add typed personal content seeded from cv`.

### Task 4: Safe storage

**Files:**
- Create: `src/system/storage.ts`, `src/system/storage.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const safeStorage: {
    get<T>(area: 'local' | 'session', key: string, fallback: T): T;   // JSON.parse; fallback on any throw/missing
    set(area: 'local' | 'session', key: string, value: unknown): void; // swallow errors
    remove(area: 'local' | 'session', key: string): void;
  };
  export const KEYS = { settings: 'bymaxos.settings', unlocked: 'bymaxos.unlocked', windows: 'bymaxos.windows', icons: 'bymaxos.icons' } as const;
  ```

- [ ] **Step 1: Write failing tests:** returns fallback when key missing; round-trips an object; returns fallback when stored value is invalid JSON; with `Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied') } })` → `get` returns fallback and `set` does not throw.
- [ ] **Step 2:** `npm test -- storage` → FAIL.
- [ ] **Step 3:** Implement (access `window.localStorage` inside try for every call).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: add safe storage wrapper`.

### Task 5: Window-manager core (pure) and system store

**Files:**
- Create: `src/system/types.ts`, `src/system/layout.ts`, `src/system/wm.ts`, `src/system/wm.test.ts`, `src/system/store.ts`, `src/system/store.test.ts`

**Interfaces:**
- Consumes: `safeStorage`, `KEYS` (Task 4); `Settings`, `defaultSettings`, `applyAppearance` (Task 2).
- Produces:
  ```ts
  // types.ts
  export type AppId = string;
  export interface Rect { x: number; y: number; w: number; h: number }
  export interface Size { w: number; h: number }
  export type WindowMode = 'normal' | 'minimized' | 'maximized';
  export interface WindowState { id: string; appId: AppId; title: string; rect: Rect; mode: WindowMode; prevRect?: Rect; restoreTo?: 'normal' | 'maximized'; z: number; props?: Record<string, unknown> }
  export interface WMState { windows: WindowState[]; focusedId: string | null; nextZ: number; seq: number; lastRectByApp: Record<AppId, Rect> }
  export interface WindowSpec { appId: AppId; title: string; defaultSize: Size; minSize: Size; singleInstance: boolean }
  // layout.ts
  export const MENU_BAR_H = 24, TITLE_BAR_H = 28, DOCK_RESERVE = 84, CASCADE = 24, MIN_VISIBLE = 80;
  export function getWorkArea(vw: number, vh: number): Rect // {x:0,y:24,w:vw,h:vh-24-84}
  // wm.ts
  export const emptyWM: WMState;
  export function clampRect(r: Rect, area: Rect, minSize?: Size): Rect;
  export function openWindow(s: WMState, spec: WindowSpec, area: Rect, props?: Record<string, unknown>): WMState;
  export function focusWindow(s: WMState, id: string): WMState;
  export function closeWindow(s: WMState, id: string): WMState;
  export function closeApp(s: WMState, appId: AppId): WMState;
  export function minimizeWindow(s: WMState, id: string): WMState;
  export function restoreWindow(s: WMState, id: string): WMState;
  export function toggleMaximize(s: WMState, id: string, area: Rect): WMState;
  export function moveWindow(s: WMState, id: string, x: number, y: number, area: Rect): WMState;
  export function setWindowRect(s: WMState, id: string, rect: Rect, minSize: Size, area: Rect): WMState;
  export function setWindowTitle(s: WMState, id: string, title: string): WMState;
  export function clampAll(s: WMState, area: Rect): WMState;
  export function activeAppId(s: WMState): AppId;           // focused window's app, else 'finder'
  export function topWindowOfApp(s: WMState, appId: AppId, includeMinimized?: boolean): WindowState | undefined;
  export function hydrate(saved: unknown, area: Rect): Pick<WMState, 'lastRectByApp'>; // validates shape, clamps rects, drops garbage
  // store.ts
  export type Overlay = null | 'controlCenter' | 'shortcuts' | 'spotlight' | 'launchpad' | 'missionControl' | 'notificationCenter' | 'appSwitcher';
  export interface SystemState {
    wm: WMState; viewport: Size; locked: boolean; overlay: Overlay; openMenuId: string | null;
    settings: Settings; keyboardLocked: boolean; selectedDesktopIcon: string | null;
    setViewport(w: number, h: number): void; openApp(appId: AppId, props?: Record<string, unknown>): string | null;
    focus(id: string): void; close(id: string): void; quitApp(appId: AppId): void; minimize(id: string): void; restore(id: string): void;
    toggleMaximize(id: string): void; move(id: string, x: number, y: number): void; setRect(id: string, r: Rect): void; setTitle(id: string, t: string): void;
    blurWindows(): void; unlock(): void; lock(): void; setOverlay(o: Overlay): void; setOpenMenu(id: string | null): void;
    updateSettings(p: Partial<Settings>): void; setKeyboardLocked(v: boolean): void; selectDesktopIcon(id: string | null): void;
  }
  export const useSystem: UseBoundStore<StoreApi<SystemState>>;
  export function resetSystem(): void; // test helper: fresh initial state
  export const AVAILABLE_OVERLAYS: Set<Exclude<Overlay, null>>; // Phase 2: 'controlCenter', 'shortcuts'; later phases add theirs
  ```
  `openApp` resolves `WindowSpec` via `getApp(appId)` from Task 7's registry — to avoid a cycle, the store takes a resolver: `export function setAppResolver(fn: (id: AppId) => WindowSpec | undefined): void`; registry calls it at module load. Unknown app → returns `null`, state unchanged.

Rules `wm.ts` must satisfy (each is a test in Step 1):

- [ ] **Step 1: Write failing tests** `wm.test.ts` with `area = {x:0,y:24,w:1440,h:792}`, `spec = {appId:'finder', title:'Finder', defaultSize:{w:800,h:500}, minSize:{w:400,h:260}, singleInstance:false}`:
  - `openWindow` on empty state → 1 window, `rect` centered: `{x:320, y:24+146, w:800, h:500}`, `mode:'normal'`, `focusedId` = its id, `z` = 1.
  - second `openWindow` same app → rect offset `+24,+24` from the previous window; focused; higher `z`.
  - cascade wraps: when offset rect would exceed area bottom/right, place at `{x: area.x + 24, y: area.y + 24}`.
  - `singleInstance:true` opened twice → still 1 window, focused, and if it was minimized it becomes `normal`.
  - uses `lastRectByApp[appId]` (clamped) for the first window of an app when present.
  - `focusWindow` on a lower window → it gets the max `z`, `focusedId` updates.
  - `closeWindow(focused)` → `focusedId` becomes the highest-`z` non-minimized remaining window, or `null`; `lastRectByApp` records the closed rect.
  - `minimizeWindow` → `mode:'minimized'`, focus moves like close; calling it twice leaves state equal (idempotent).
  - `restoreWindow` → `mode` = `restoreTo` recorded by `minimizeWindow` (`'maximized'` if it was maximized, else `'normal'`), focused, top `z`.
  - `toggleMaximize` → rect equals `area`, `prevRect` saved, `mode:'maximized'`; again → rect = `prevRect`, `mode:'normal'`.
  - `clampRect`: `y < area.y` → `y = area.y`; `y > area.y + area.h - 28` → that bound; `x < area.x - (w - 80)` → that bound; `x > area.x + area.w - 80` → that bound; `w > area.w` → `area.w`; `h > area.h` → `area.h`; `w < minSize.w` → `minSize.w`.
  - `clampAll` after shrinking area to `{x:0,y:24,w:1024,h:600}` with a window at `{x:1300,y:700,w:800,h:500}` → every window satisfies `clampRect`; maximized windows get rect = new area.
  - `closeApp('finder')` removes all finder windows only.
  - `activeAppId` → `'finder'` when `focusedId` is null.
  - `hydrate({finder:{x:5000,y:-10,w:800,h:500}}, area)` → finder rect clamped; `hydrate('garbage', area)` → `{lastRectByApp:{}}`; entries with non-number fields dropped.
- [ ] **Step 2:** `npm test -- wm` → FAIL.
- [ ] **Step 3:** Implement `types.ts`, `layout.ts`, `wm.ts` (all functions return new objects; never mutate input).
- [ ] **Step 4:** `npm test -- wm` → PASS.
- [ ] **Step 5: Write failing tests** `store.test.ts` (call `resetSystem()` in `beforeEach`, `setAppResolver` with the `spec` above for `'finder'`):
  - `openApp('finder')` returns an id and `wm.windows.length === 1`; `openApp('nope')` returns `null`.
  - `setViewport(1024, 600)` re-clamps existing windows (uses `clampAll`).
  - `updateSettings({reduceMotion:true})` persists to `safeStorage` key `bymaxos.settings` and `document.documentElement` gets `reduce-motion`.
  - `unlock()` sets `locked:false` and session key `bymaxos.unlocked` to `true`; initial `locked` is `false` when that session key is `true`.
  - `close` writes `lastRectByApp` to session key `bymaxos.windows`.
  - `blurWindows()` → `focusedId === null` and `activeAppId(wm) === 'finder'`.
- [ ] **Step 6:** → FAIL. **Step 7:** Implement `store.ts` (Zustand `create`; initial `viewport` from `window.innerWidth/innerHeight`; settings from storage merged over `defaultSettings`). **Step 8:** → PASS.
- [ ] **Step 9: Commit** `feat: add pure window manager and system store`.

### Task 6: Command bus and shortcuts

**Files:**
- Create: `src/system/commands.ts`, `src/system/commands.test.ts`, `src/system/shortcuts.ts`, `src/system/shortcuts.test.ts`

**Interfaces:**
- Consumes: `useSystem` (Task 5).
- Produces:
  ```ts
  // commands.ts
  export type Command = { type: string; [key: string]: unknown };
  export type Handler = (cmd: Command) => void;
  export function registerGlobal(type: string, handler: Handler, enabled?: (cmd: Command) => boolean): () => void;
  export function registerWindowHandlers(windowId: string, handlers: Record<string, Handler>): () => void;
  export function canDispatch(cmd: Command): boolean; // global: enabled() ?? true; else focused window has handler
  export function dispatch(cmd: Command): boolean;    // false when not handled
  export function useWindowCommands(windowId: string, handlers: Record<string, Handler>): void; // React hook, registers on mount, unregisters on unmount; handlers read via ref (no re-register per render)
  export function installSystemCommands(): () => void; // registers the globals below against useSystem
  // shortcuts.ts
  export interface KeyLike { code: string; key: string; altKey: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }
  export interface ShortcutDef { combo: string /* display, e.g. '⌥W' */; command: Command; when: 'always' | 'keyboardLocked' }
  export const SHORTCUTS: ShortcutDef[];
  export function matchShortcut(e: KeyLike, ctx: { inTextField: boolean; keyboardLocked: boolean }): Command | null;
  export function shortcutLabel(type: string, keyboardLocked: boolean): string | undefined;
  export function isTextField(el: Element | null): boolean; // input (text-like), textarea, [contenteditable]
  ```
  Global command types registered by `installSystemCommands` (enabled rule in parentheses): `window.close` (focused window exists), `window.minimize` (same), `window.zoom` (same), `window.focus` {id}, `window.bringAllToFront` (any window), `app.open` {appId, props?}, `app.quit` {appId?} (defaults to active app; enabled when it has windows), `app.hide` (same; minimizes all its windows), `system.lock`, `system.restart` (sets `locked:true` and clears session unlock key), `overlay.open` {overlay} (enabled only when `AVAILABLE_OVERLAYS.has(cmd.overlay)`, so e.g. Spotlight is disabled until Phase 4), `overlay.close` (enabled when an overlay or menu is open).

  `SHORTCUTS` table (always): `⌥W`→`window.close`, `⌥M`→`window.minimize`, `⌥Q`→`app.quit`, `⌘K`→`overlay.open {overlay:'spotlight'}`, `⌥↑`→`overlay.open {overlay:'missionControl'}`, `⌥1`→`view.icons`, `⌥2`→`view.list`, `⌥N`→`file.newWindow`, `Esc`→`overlay.close`. (keyboardLocked): `⌘W`→`window.close`, `⌘M`→`window.minimize`, `⌘Q`→`app.quit`, `⌘1`→`view.icons`, `⌘2`→`view.list`, `⌘N`→`file.newWindow`. (⌃↑/F3 and ⌘1/⌘2/⌘N are taken by macOS/Chrome, hence the ⌥ variants — spec §3.6 updated accordingly.) Matching uses `e.code` (`KeyW`, `ArrowUp`, `Digit1`, `F3`, `Escape`) and exact modifier sets.

- [ ] **Step 1: Write failing tests** `commands.test.ts`:
  - `dispatch({type:'x'})` with no handlers → `false`; `canDispatch` → `false`.
  - window handler for `'notes.newNote'` on window `w1` runs only when `w1` is focused (set `useSystem` state); `canDispatch` mirrors that.
  - unregister function removes the handler.
  - global with `enabled: () => false` → `canDispatch` false and `dispatch` returns false without calling handler.
  - after `installSystemCommands()`: `canDispatch({type:'overlay.open', overlay:'spotlight'})` → false; `…overlay:'controlCenter'` → true.
  - after `installSystemCommands()` with one focused window: `dispatch({type:'window.close'})` → window gone; with none: `canDispatch({type:'window.close'})` → false.
- [ ] **Step 2: Write failing tests** `shortcuts.test.ts`:
  - `{code:'KeyW', key:'∑', altKey:true}` → `{type:'window.close'}` (macOS ⌥ changes `key`).
  - same event with `inTextField:true` → `null`; `Escape` with `inTextField:true` → `overlay.close`; `⌘K` with `inTextField:true` → spotlight command.
  - `{code:'KeyW', metaKey:true}` → `null` unless `keyboardLocked:true`.
  - `{code:'KeyW', altKey:true, shiftKey:true}` → `null` (exact modifiers).
  - `shortcutLabel('window.close', false) === '⌥W'`; `shortcutLabel('window.close', true) === '⌘W'`.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add command bus and keyboard shortcut mapping`.

### Task 7: App registry, menus types, AppIcon

**Files:**
- Create: `src/apps/types.ts`, `src/apps/registry.ts`, `src/apps/registry.test.ts`, `src/ui/AppIcon.tsx`

**Interfaces:**
- Consumes: `WindowSpec`, `setAppResolver` (Task 5); `Command`, `shortcutLabel` (Task 6); `getContent` (Task 3).
- Produces:
  ```ts
  // apps/types.ts
  export interface AppProps { windowId: string; props?: Record<string, unknown> }
  export type MenuItemDef = { label: string; command?: Command; shortcut?: string; checked?: boolean; disabled?: boolean } | { separator: true };
  export interface MenuDef { id: string; label: string; items: MenuItemDef[] }
  export interface MenuContext { focused: WindowState | null; windows: WindowState[]; keyboardLocked: boolean }
  export interface AppIconSpec { glyph: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; background: string; color?: string }
  export interface AppDefinition {
    id: AppId; name: string; icon: AppIconSpec;
    load?: () => Promise<{ default: ComponentType<AppProps> }>;
    external?: string;                                  // opens new tab instead of a window
    alias?: { appId: AppId; props?: Record<string, unknown> }; // e.g. Trash → Finder at 'trash'
    window?: { defaultSize: Size; minSize: Size; resizable: boolean; singleInstance: boolean };
    menus?: (ctx: MenuContext) => MenuDef[];           // menus after the bold app menu
    dock?: { order: number; group: 'system' | 'apps' | 'links' | 'trash' };
    mobile?: { presentation: 'fullscreen' | 'sheet' | 'external' | 'hidden' };
  }
  // registry.ts
  export const APPS: AppDefinition[];
  export function getApp(id: AppId): AppDefinition | undefined;
  export function dockItems(): AppDefinition[]; // has dock; sorted by group (system<apps<links<trash) then order
  export function defaultMenus(ctx: MenuContext): MenuDef[]; // File/Edit/View/Window/Help used when app.menus is absent, and merged: app menus replace same-id defaults
  ```
  Phase-2 registry entries: `finder` (Finder, 900×560 / min 520×320, resizable, multi-instance, dock system/1), `quicklook` (Quick Look, 640×520 / min 360×280, resizable, multi-instance, no dock), `about` ("About This Mac", 340×420 fixed, single-instance, no dock), `linkedin` and `github` (external from `getContent().links`, dock links/1–2), `trash` (alias `{appId:'finder', props:{folderId:'trash'}}`, dock trash/1). `defaultMenus`: File [New Window (`file.newWindow`), Close Window (`window.close`)], Edit [Undo `edit.undo`, Redo `edit.redo`, sep, Cut `edit.cut`, Copy `edit.copy`, Paste `edit.paste`, Select All `edit.selectAll`], View [], Window [Minimize, Zoom, sep, Bring All to Front, sep, one item per window: label = title, `checked` when focused, command `window.focus {id}`], Help [Keyboard Shortcuts (`overlay.open {overlay:'shortcuts'}`), About bymaxOS (`app.open {appId:'about'}`)]. Menus with no items are omitted. Each item's `shortcut` comes from `shortcutLabel`.
  `AppIcon({ app, size }: { app: AppDefinition; size: number })` renders a squircle (`border-radius: 22.5%`) with `app.icon.background`, centered glyph at 55% size, subtle inner highlight + drop shadow; `aria-hidden` (labels come from parents).

- [ ] **Step 1: Write failing tests** `registry.test.ts`:
  - `dockItems().map(a => a.id)` equals `['finder','linkedin','github','trash']`.
  - every app with `load` has `window`; every `external` is `https:`.
  - `defaultMenus(ctx)` with two windows, second focused → Window menu contains both titles, second `checked:true`; View menu omitted (empty).
  - importing the registry calls `setAppResolver` so `useSystem.getState().openApp('finder')` returns an id and `openApp('linkedin')` returns `null`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implement (glyphs from lucide: Finder `Smile`, Quick Look `Eye`, About `Info`, LinkedIn `Linkedin`, GitHub `Github`, Trash `Trash2`; Finder/Quick Look/About components can be `() => import(...)` of files created in Tasks 13–15 — create minimal `export default function X(){ return null }` stubs now so the build passes). **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: add app registry, menu definitions and app icons`.

### Task 8: Shell selection, deep link, boot, login screen

**Files:**
- Create: `src/system/shell.ts`, `src/system/shell.test.ts`, `src/shells/desktop/DesktopShell.tsx`, `src/shells/desktop/LoginScreen.tsx`, `src/shells/desktop/LoginScreen.test.tsx`, `src/shells/mobile/MobilePlaceholder.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useSystem`, `getContent`, `getApp`, `installSystemCommands`.
- Produces:
  ```ts
  export function selectShell(v: { width: number; height: number; coarse: boolean }): 'desktop' | 'mobile';
  export function useShell(): 'desktop' | 'mobile'; // matchMedia listeners, re-evaluates live
  export function parseDeepLink(search: string): { appId: AppId; item?: string } | null; // only registered, non-external apps
  export function LoginScreen(props: { onUnlock: () => void }): JSX.Element;
  export function DesktopShell(): JSX.Element; // renders LoginScreen while locked, else MenuBar/Desktop/WindowLayer/Dock (added in later tasks)
  ```
  `App`: `useShell()` → `DesktopShell` or `MobilePlaceholder`. `DesktopShell` on mount: `installSystemCommands()`, `setViewport` on `resize`, and after unlock opens the deep-link app once (`openApp(appId, item ? {item} : undefined)`).
  `MobilePlaceholder` copy (exact): heading "bymaxOS for iPhone is on its way", text "Meanwhile, here's how to reach me:", then links built from content (LinkedIn, GitHub, email).
  `LoginScreen`: wallpaper (current `settings.wallpaperId` → gradient/src) with `backdrop-filter: blur(40px)`, live clock (large, `h:mm`) and date (`EEEE, MMMM d` via `Intl.DateTimeFormat('en-US', …)`), avatar (img when `avatarUrl`, else circle with initials from `profile.name`), name, hint "Click or press Enter to unlock". Root is a `button`-semantics region (`role="button"`, `aria-label="Unlock"`, `tabIndex=0`, autofocus); unlocks on click, Enter, Space, or `wheel` with `deltaY < 0`. Unlock animation: fade + scale-up 300ms (skipped under reduce-motion), then `onUnlock`.

- [ ] **Step 1: Write failing tests** `shell.test.ts`:
  - `selectShell({width:390,height:844,coarse:true})` → `'mobile'`; `{844,390,coarse:true}` → `'mobile'`; `{700,900,coarse:false}` → `'mobile'`; `{1024,768,coarse:true}` → `'desktop'`; `{800,600,coarse:false}` → `'desktop'`.
  - `parseDeepLink('?app=finder')` → `{appId:'finder'}`; `'?app=finder&item=projects'` → with item; `'?app=linkedin'` → `null`; `'?app=<script>'` → `null`; `''` → `null`.
- [ ] **Step 2: Write failing tests** `LoginScreen.test.tsx`: renders profile name and initials "MW"; pressing Enter calls `onUnlock` (use fake timers / `reduce-motion` class to skip animation); clicking calls `onUnlock`.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS; `npm run build` exits 0.
- [ ] **Step 6: Commit** `feat: add shell selection, deep links and login screen`.

---

## Phase 2 — Desktop System

### Task 9: Window component and window layer

**Files:**
- Create: `src/shells/desktop/resize.ts`, `src/shells/desktop/resize.test.ts`, `src/shells/desktop/Window.tsx`, `src/shells/desktop/Window.test.tsx`, `src/shells/desktop/WindowLayer.tsx`, `src/shells/desktop/AppErrorBoundary.tsx`
- Modify: `src/shells/desktop/DesktopShell.tsx`

**Interfaces:**
- Consumes: `useSystem`, `getApp`, `TITLE_BAR_H`, `getWorkArea`, `useWindowCommands`.
- Produces:
  ```ts
  export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  export function resizeRect(start: Rect, dir: ResizeDir, dx: number, dy: number, min: Size): Rect;
  export function Window(props: { win: WindowState; app: AppDefinition; focused: boolean; children: ReactNode }): JSX.Element;
  export function WindowLayer(): JSX.Element; // renders every non-minimized window via Window + Suspense + AppErrorBoundary + lazy(app.load)
  export const dockIconRects: Map<AppId, DOMRect>; // written by Dock (Task 11), read for minimize animation
  ```
  Window behaviour:
  - `role="dialog"`, `aria-modal="false"`, `aria-labelledby` → title element id; `style` `left/top/width/height` from `win.rect`, `zIndex = win.z`; class `window-open` keyframe on mount.
  - `pointerdown` anywhere → `focus(id)` (if not focused).
  - Title bar (`height: var(--tb-h)`): traffic lights left (close red `#ff5f57`, minimize yellow `#febc2e`, zoom green `#28c840`; grey `#c7c7c7`/dark `#4d4d4d` when not focused; glyphs × − + appear on group hover; `aria-label`s "Close", "Minimize", "Zoom"; zoom hidden-disabled when `!app.window.resizable`), centered title. Drag with pointer capture on title bar (ignored when target is a traffic-light button) calls `move` on each `pointermove`. Double-click on title bar → `toggleMaximize` (only if resizable).
  - 8 resize handles (6px edges, 12px corners) when resizable; `pointermove` → `setRect(id, resizeRect(...))`.
  - Minimize: if reduce-motion or no `dockIconRects.get(appId)` → `minimize(id)` immediately; else WAAPI animation (220ms) translating/scaling to the dock icon center with opacity → 0, then `minimize(id)`. A ref flag ignores further minimize clicks while animating.
  - Registers window handlers via `useWindowCommands` for `window.zoom` passthrough is NOT needed (global). On mount focus the window element (`tabIndex=-1`); on unmount restore focus to `document.activeElement` captured at mount if still in the document.
  - `AppErrorBoundary`: on error renders "<App name> quit unexpectedly." and a "Reopen" button that resets the boundary.
  - Content area: `overflow:auto`, `data-selectable`.

- [ ] **Step 1: Write failing tests** `resize.test.ts`: `resizeRect({x:100,y:100,w:500,h:400},'se',50,30,min)` → `{x:100,y:100,w:550,h:430}`; `'nw', 50, 30` → `{x:150,y:130,w:450,h:370}`; `'w', 400, 0` with `min.w=300` → `w:300, x:300` (x stops moving when min hit).
- [ ] **Step 2: Write failing tests** `Window.test.tsx` (render `WindowLayer` after `openApp('finder')` with a stub app registered via `setAppResolver`/mock `getApp` whose component renders text "stub"):
  - dialog with accessible name "Finder" is shown, with "stub" content.
  - clicking "Close" removes the dialog.
  - clicking "Minimize" with `reduce-motion` class → dialog not rendered and `wm.windows[0].mode === 'minimized'`; second click before the first finished does not throw (call twice synchronously).
  - double-clicking the title bar → `mode === 'maximized'`; again → `'normal'`.
  - `pointerDown` at (200,200) on title bar, `pointerMove` to (260,230), `pointerUp` → `rect.x` increased by 60 and `rect.y` by 30.
  - a component that throws renders "Finder quit unexpectedly." and a "Reopen" button.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement; mount `WindowLayer` in `DesktopShell`. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add window chrome, drag, resize and window layer`.

### Task 10: Menu primitives and context menu

**Files:**
- Create: `src/ui/Menu.tsx`, `src/ui/Menu.test.tsx`, `src/ui/ContextMenu.tsx`, `src/ui/Popover.tsx`

**Interfaces:**
- Consumes: `MenuDef`, `MenuItemDef` (Task 7); `canDispatch`, `dispatch` (Task 6); `useSystem().openMenuId/setOpenMenu`.
- Produces:
  ```ts
  export function MenuBarMenus(props: { menus: MenuDef[]; leading?: ReactNode }): JSX.Element; // role="menubar"
  export function MenuList(props: { items: MenuItemDef[]; onClose: () => void; labelledBy?: string }): JSX.Element; // role="menu"
  export function ContextMenu(props: { x: number; y: number; items: MenuItemDef[]; onClose: () => void }): JSX.Element; // portal, kept inside viewport
  export function useContextMenu(): { open: (e: React.MouseEvent, items: MenuItemDef[]) => void; element: ReactNode };
  export function Popover(props: { anchor: DOMRect; onClose: () => void; children: ReactNode; label: string }): JSX.Element; // outside-click + Esc close, role="dialog"
  ```
  Behaviour: top-level button click toggles its menu (`openMenuId = menu.id`); while any menu is open, `pointerenter` on another top-level button switches to it; ←/→ move between top-level menus; ↓/↑ move between enabled items; Enter/Space activates; Esc closes and returns focus to the top-level button; outside `pointerdown` closes. Item enabled = `!disabled && (!command || canDispatch(command))`; disabled items have `aria-disabled="true"` and ignore activation. `checked` renders ✓ (`role="menuitemcheckbox"`, `aria-checked`). Activation: `dispatch(command)` then close. Shortcut text right-aligned, muted. Separator `role="separator"`. Glass style: `background: var(--menu-bg); backdrop-filter: blur(var(--glass-blur))`, radius `var(--radius-menu)`, 4px padding, items 22px tall, highlight with `--accent` and white text.

- [ ] **Step 1: Write failing tests** `Menu.test.tsx` (register a global `test.ok` handler; `test.no` has none):
  - clicking "File" opens a `menu`; clicking an enabled item dispatches it (handler called) and closes the menu.
  - item with command `test.no` has `aria-disabled="true"`; clicking does nothing and menu stays open.
  - with "File" open, hovering "Edit" shows Edit's menu and hides File's.
  - ArrowDown focuses the first enabled item (skips disabled); Escape closes and focuses the "File" button.
  - `pointerdown` on `document.body` closes the menu.
  - `ContextMenu` at `x = window.innerWidth - 10` renders with its right edge inside the viewport (check computed `left` ≤ `innerWidth - menuWidth`; in jsdom mock `getBoundingClientRect` width 200).
- [ ] **Step 2:** → FAIL. **Step 3:** Implement. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: add accessible menu, context menu and popover primitives`.

### Task 11: Menu bar, status area, shortcuts sheet

**Files:**
- Create: `src/shells/desktop/MenuBar.tsx`, `src/shells/desktop/MenuBar.test.tsx`, `src/shells/desktop/StatusArea.tsx`, `src/shells/desktop/clock.ts`, `src/shells/desktop/clock.test.ts`, `src/shells/desktop/ShortcutsSheet.tsx`, `src/ui/Sheet.tsx`
- Modify: `src/shells/desktop/DesktopShell.tsx` (mount MenuBar, global keydown listener)

**Interfaces:**
- Consumes: `MenuBarMenus` (Task 10); `getApp`, `defaultMenus` (Task 7); `activeAppId` (Task 5); `matchShortcut`, `isTextField`, `SHORTCUTS` (Task 6).
- Produces:
  ```ts
  export function formatMenuClock(d: Date): string; // 'Mon Oct 26  5:08 PM' (two spaces before time), en-US
  export function buildMenus(ctx: MenuContext, appId: AppId): MenuDef[]; // [systemMenu, appMenu, ...merged(defaultMenus, app.menus)]
  export function MenuBar(): JSX.Element;
  export function useBattery(): { level: number; charging: boolean } | null; // null when navigator.getBattery missing
  export function useOnline(): boolean;
  export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }): JSX.Element; // centered modal, focus trap, Esc closes
  ```
  System menu (id `system`, label is an inline SVG "M" mark with `aria-label="bymaxOS"`): About This Mac (`app.open {appId:'about'}`), sep, System Settings… (`overlay.open {overlay:'controlCenter'}` until Phase 4), sep, Lock Screen (`system.lock`), Restart… (`system.restart`). App menu (id `app`, bold label = app name; Finder when none focused): About <name> (`app.open {appId:'about'}`), sep, Hide <name> (`app.hide`), Quit <name> (`app.quit`). Height `var(--mb-h)`, glass, 13px text.
  Status area (right, in order): Wi‑Fi icon (`Wifi` / `WifiOff`, `aria-label` "Wi‑Fi: connected"/"offline"), battery (only when `useBattery()` non-null; `aria-label` "Battery 82%"), Control Center button (`aria-label` "Control Center", opens overlay), Spotlight button (`aria-label` "Spotlight", dispatches spotlight command; disabled until Phase 4 because no handler — render `aria-disabled`), clock text (updates each 15s).
  Global keydown (in `DesktopShell`): `const cmd = matchShortcut(e, {inTextField: isTextField(document.activeElement), keyboardLocked})`; if `cmd && dispatch(cmd)` → `e.preventDefault()`.
  `ShortcutsSheet` (overlay `'shortcuts'`): table of `SHORTCUTS` filtered by current `keyboardLocked` (combo + human label), plus the note (exact): "Some macOS shortcuts (⌘W, ⌘Tab, ⌘Space) are reserved by your browser. Enter full screen from Control Center to use them in Chrome."

- [ ] **Step 1: Write failing tests** `clock.test.ts`: `formatMenuClock(new Date(2026, 9, 26, 17, 8))` → `'Mon Oct 26  5:08 PM'`.
- [ ] **Step 2: Write failing tests** `MenuBar.test.tsx`:
  - with no windows the bold app menu button reads "Finder"; after `openApp('about')` it reads "About This Mac".
  - Window menu lists both open window titles.
  - pressing ⌥W (`fireEvent.keyDown(window, {code:'KeyW', key:'∑', altKey:true})`) closes the focused window; same event while an `<input>` is focused does not.
  - Help > Keyboard Shortcuts opens a dialog titled "Keyboard Shortcuts"; Escape closes it.
  - System menu > Lock Screen sets `locked:true`.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add menu bar with app-aware menus, status area and shortcuts sheet`.

### Task 12: Dock

**Files:**
- Create: `src/shells/desktop/dock.ts`, `src/shells/desktop/dock.test.ts`, `src/shells/desktop/Dock.tsx`, `src/shells/desktop/Dock.test.tsx`
- Modify: `src/shells/desktop/DesktopShell.tsx`

**Interfaces:**
- Consumes: `dockItems`, `getApp` (Task 7); `topWindowOfApp` (Task 5); `useContextMenu` (Task 10); `dockIconRects` (Task 9); `AppIcon`.
- Produces:
  ```ts
  export type DockAction = { type: 'open' } | { type: 'focus'; id: string } | { type: 'restore'; id: string } | { type: 'external'; url: string } | { type: 'alias'; appId: AppId; props?: Record<string, unknown> };
  export function dockClickAction(wm: WMState, app: AppDefinition): DockAction;
  export function magnifyScale(distance: number, max?: number /* 1.6 */, range?: number /* 120 */): number;
  export function Dock(): JSX.Element;
  ```
  `dockClickAction` rules (in order): `external` → external; `alias` → alias; no windows of app → open; any non-minimized window → focus the highest-`z` one; else restore the highest-`z` minimized one.
  `magnifyScale`: `d >= range → 1`; else `1 + (max - 1) * (Math.cos((d / range) * Math.PI) + 1) / 2`.
  Dock UI: centered bottom, 8px from bottom, glass pill (radius 18px, 1px `--glass-border`), icons `settings.dockSize`, gap 6px, separators (1px vertical line) between groups. Each item is a `button` with `aria-label` = app name (+ " (opens in new tab)" for external); tooltip (name) above on hover/focus; running dot (4px) under apps with ≥1 window; external items show a small ↗ badge. Magnification only when `settings.dockMagnification && !settings.reduceMotion`, computed from pointer x on `pointermove`, reset on leave; scale applied via `transform` with `transform-origin: bottom`. After layout, write each icon's `getBoundingClientRect()` to `dockIconRects`. External → `window.open(url, '_blank', 'noopener,noreferrer')`. Right-click → context menu: Open (`app.open`), Show All Windows (restore all of app; disabled when none), Quit (`app.quit {appId}`; disabled when none).

- [ ] **Step 1: Write failing tests** `dock.test.ts`:
  - no windows → `{type:'open'}`; one normal window → `{type:'focus', id}`; only minimized → `{type:'restore', id}`; two windows (one minimized, one normal) → focus the normal one; external app → `{type:'external', url}`; trash → `{type:'alias', appId:'finder', props:{folderId:'trash'}}`.
  - `magnifyScale(0) === 1.6`; `magnifyScale(120) === 1`; `magnifyScale(200) === 1`; `magnifyScale(30) > magnifyScale(60)`.
- [ ] **Step 2: Write failing tests** `Dock.test.tsx`: renders buttons "Finder", "LinkedIn (opens in new tab)", "GitHub (opens in new tab)", "Trash" in that order; clicking Finder twice (singleInstance false) results in exactly one window the first time and focuses it the second time (`wm.windows.length === 1`); clicking LinkedIn calls `window.open` with the content URL; a running dot (`data-testid="running-dot-finder"`) appears after opening.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add dock with launch, focus, restore and magnification`.

### Task 13: Virtual filesystem

**Files:**
- Create: `src/system/vfs.ts`, `src/system/vfs.test.ts`

**Interfaces:**
- Consumes: `Content`, `getContent` (Task 3).
- Produces:
  ```ts
  export type FileType = 'md' | 'pdf' | 'vcf' | 'webloc';
  export type Preview = { kind: 'text'; title: string; body: string } | { kind: 'link'; title: string; url: string; description: string };
  export type VNode =
    | { id: string; name: string; kind: 'folder'; children: string[]; placeholder?: string }
    | { id: string; name: string; kind: 'file'; fileType: FileType; open: { appId: AppId; props?: Record<string, unknown> }; preview: Preview };
  export interface Vfs { nodes: Record<string, VNode>; sidebar: string[]; desktop: string[] }
  export function buildVfs(c: Content): Vfs;
  export function pathTo(vfs: Vfs, id: string): string[]; // ancestor ids from 'root'
  ```
  Tree (ids in backticks): `root` → `desktop`, `documents`, `about`, `work`, `projects`, `photos`, `interests`, `trash`.
  - `documents`: `resume-pdf` "Resume.pdf" (open `{appId:'resume'}`, preview text = profile headline + summary), `contact-vcf` "Contact.vcf" (open `{appId:'contacts'}`, preview text name/email/location — no phone).
  - `about`: one `md` per `documents` with folder `about` (id `doc-<id>`, open `{appId:'textedit', props:{docId}}`, preview text = body).
  - `work`: one `md` per experience "<Company> — <Role>.md" (preview text: dates · location + highlights as `- ` lines).
  - `projects`: one `md` per project "<Title>.md" (preview text) plus one `webloc` per defined `links.repo|demo|info` "<Title> (repo|demo|info).webloc" (open `{appId:'safari', props:{url}}`, preview link).
  - `photos`, `interests` (when no interest docs), `trash`: empty folders with `placeholder` copy: photos "Photos will appear here once they're added.", interests "Interests are coming soon.", trash "Trash is empty."
  - `sidebar`: `['desktop','documents','about','work','projects','photos','interests','trash']`; `desktop` children = `['resume-pdf','about','projects','contact-vcf']` (folders appear as children of both `root` and `desktop`; that is fine — they are aliases).
  Files whose `open.appId` is not registered yet are opened by Finder in Quick Look (Task 14).

- [ ] **Step 1: Write failing tests**: `buildVfs(getContent())` → `nodes.desktop.children` equals `['resume-pdf','about','projects','contact-vcf']`; `work` has 2 children; every child id resolves to a node; the Nokia file name is `'Nokia — Lead Frontend Developer.md'`; LigaPWr has a `webloc` whose preview url is the repo URL; `JSON.stringify(vfs)` contains no `+48`; `pathTo(vfs,'doc-hello')` → `['root','about','doc-hello']`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implement. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: derive virtual filesystem from content`.

### Task 14: Finder and Quick Look

**Files:**
- Create: `src/apps/finder/finderState.ts`, `src/apps/finder/finderState.test.ts`, `src/apps/finder/Finder.tsx`, `src/apps/finder/Finder.test.tsx`, `src/apps/finder/menus.ts`, `src/apps/quicklook/QuickLook.tsx`, `src/ui/LightMarkdown.tsx`
- Modify: `src/apps/registry.ts` (Finder `menus`, real `load`s)

**Interfaces:**
- Consumes: `buildVfs`, `VNode` (Task 13); `useWindowCommands`, `dispatch` (Task 6); `useContextMenu` (Task 10); `getApp`; `setTitle`.
- Produces:
  ```ts
  export interface FinderState { history: string[]; index: number; view: 'icons' | 'list'; selected: string | null }
  export function initFinder(folderId?: string): FinderState;          // defaults to 'desktop'
  export function navigate(s: FinderState, folderId: string): FinderState; // truncates forward history
  export function back(s: FinderState): FinderState;
  export function forward(s: FinderState): FinderState;
  export function openTarget(node: VNode): Command; // folder → finder.navigate; file with registered app → app.open; else app.open quicklook {nodeId}
  export function finderMenus(ctx: MenuContext): MenuDef[]; // File: New Finder Window (file.newWindow), Open (finder.open), Close Window; View: as Icons ✓ (view.icons), as List (view.list) — shortcut labels via `shortcutLabel`; Go: Back (finder.back), Forward (finder.forward), Desktop/Documents/About Me/Work/Projects (finder.navigate {folderId})
  export function LightMarkdown(props: { source: string }): JSX.Element; // '# ' → h2, '- ' runs → ul, blank-line paragraphs; text only, no HTML injection
  ```
  Finder window: toolbar (back/forward buttons with `aria-label`s, current folder title, view toggle segmented control), sidebar ("Favorites": Desktop, Documents; "bymaxOS": About Me, Work, Projects, Photos, Interests; "Locations": Trash) with lucide icons, content area (icons view: 96px grid, folder/file icons by type; list view: table Name / Kind), path bar at bottom (ancestor names, each clickable). Window title = current folder name (`setTitle`). Selection: click; open: double-click or Enter; Space → Quick Look of selected file; arrow keys move selection in icons view (row-major). Empty folder shows its `placeholder`. Initial folder from `props.folderId` (Trash dock alias) else `desktop`. Registers window handlers: `file.newWindow` (→ `app.open finder`), `finder.open`, `finder.back`, `finder.forward`, `finder.navigate`, `view.icons`, `view.list`; `back/forward` handlers absent (unregistered) when not possible so menu items disable. Context menu on item: Open, Quick Look, Get Info (Quick Look too).
  `QuickLook` app: reads `props.nodeId`, renders `preview` (`text` via `LightMarkdown`; `link` → title, description, URL, button "Open in new tab ↗" calling `window.open`), title = file name, footer note when the file's own app is not yet available (exact): "Preview — the full app is coming soon."

- [ ] **Step 1: Write failing tests** `finderState.test.ts`: `navigate` then `back` then `forward` returns to the second folder; `navigate` after `back` drops forward history; `back` at index 0 is a no-op; `openTarget(folder)` → `{type:'finder.navigate', folderId}`; `openTarget(resume-pdf)` → `{type:'app.open', appId:'quicklook', props:{nodeId:'resume-pdf'}}` (resume not registered in Phase 2).
- [ ] **Step 2: Write failing tests** `Finder.test.tsx` (render `WindowLayer` after `openApp('finder')`):
  - shows the Desktop folder items "Resume.pdf", "About Me", "Projects", "Contact.vcf"; window title "Desktop".
  - double-click "Projects" → shows "LigaPWr Web App.md"; title "Projects"; clicking Back returns to Desktop.
  - `dispatch({type:'view.list'})` renders a `table` with column header "Name".
  - select "Resume.pdf", press Space → a second dialog titled "Resume.pdf" with the summary text and the "coming soon" note.
  - `openApp('finder', {folderId:'trash'})` shows "Trash is empty."
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add finder with navigation, views and quick look`.

### Task 15: Desktop surface, wallpaper and icons

**Files:**
- Create: `src/shells/desktop/desktopIcons.ts`, `src/shells/desktop/desktopIcons.test.ts`, `src/shells/desktop/Desktop.tsx`, `src/shells/desktop/Desktop.test.tsx`
- Modify: `src/shells/desktop/DesktopShell.tsx`

**Interfaces:**
- Consumes: `buildVfs` (Task 13); `openTarget` (Task 14); `safeStorage`, `KEYS.icons`; `useContextMenu`; `getWorkArea`.
- Produces:
  ```ts
  export interface Cell { col: number; row: number } // col 0 = rightmost column
  export const CELL = { w: 96, h: 100, pad: 12 };
  export function defaultPositions(ids: string[]): Record<string, Cell>;        // col 0, rows 0..n-1
  export function cellToPx(c: Cell, area: Rect): { x: number; y: number };     // x = area.x + area.w - pad - (col+1)*w, y = area.y + pad + row*h
  export function pxToCell(x: number, y: number, area: Rect): Cell;            // nearest cell, clamped to grid inside area
  export function placeIcon(pos: Record<string, Cell>, id: string, target: Cell, area: Rect): Record<string, Cell>; // if occupied, next free row in same col, then next col
  export function loadIconPositions(ids: string[]): Record<string, Cell>;      // from storage; drops unknown ids; fills missing with defaults
  export function Desktop(): JSX.Element;
  ```
  Desktop renders wallpaper (`src` image `object-fit: cover` with gradient beneath; under the menu bar too), icons (64px icon + label with text shadow; selected → rounded tinted background and label with accent pill), `role="listbox"`/`role="option"` semantics with `aria-label` "Desktop". Click selects (`selectDesktopIcon`), click on empty space deselects and calls `blurWindows()` (Task 5), so the active app becomes Finder. Double-click / Enter → `dispatch(openTarget(node))`. Drag (pointer, 4px threshold) → on drop `placeIcon(pxToCell(...))` and persist. Context menus: icon → Open, Get Info (`app.open quicklook {nodeId}`); empty space → "Change Wallpaper…" (submenu-free: opens Control Center overlay), "Clean Up" (reset to `defaultPositions` and persist), sep, "About bymaxOS" (`app.open about`).

- [ ] **Step 1: Write failing tests** `desktopIcons.test.ts` (`area = {x:0,y:24,w:1440,h:792}`):
  - `defaultPositions(['a','b'])` → `{a:{col:0,row:0}, b:{col:0,row:1}}`.
  - `cellToPx({col:0,row:0}, area)` → `{x:1440-12-96, y:36}`; `pxToCell` of that point → `{col:0,row:0}`.
  - `placeIcon` onto an occupied cell → moved icon lands in next free row of that column.
  - `loadIconPositions(['a'])` with stored `{a:{col:2,row:1}, ghost:{col:0,row:0}}` → `{a:{col:2,row:1}}`; with stored garbage → defaults.
- [ ] **Step 2: Write failing tests** `Desktop.test.tsx`: 4 options rendered in order; double-clicking "Projects" opens a Finder dialog titled "Projects"; right-click on empty space shows "Clean Up"; clicking empty space after opening a window makes the menu bar app name "Finder" (render `MenuBar` too).
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add desktop wallpaper and interactive icons`.

### Task 16: Control Center, full screen, About This Mac

**Files:**
- Create: `src/shells/desktop/fullscreen.ts`, `src/shells/desktop/fullscreen.test.ts`, `src/shells/desktop/ControlCenter.tsx`, `src/shells/desktop/ControlCenter.test.tsx`, `src/apps/about/AboutThisMac.tsx`
- Modify: `src/shells/desktop/DesktopShell.tsx`, `src/shells/desktop/StatusArea.tsx`

**Interfaces:**
- Consumes: `Popover` (Task 10); `useSystem` settings/keyboardLocked; `getContent().site.wallpapers`.
- Produces:
  ```ts
  export async function enterFullScreen(doc?: Document, nav?: Navigator): Promise<{ fullscreen: boolean; keyboardLocked: boolean }>;
  export async function exitFullScreen(doc?: Document, nav?: Navigator): Promise<void>;
  export function ControlCenter(): JSX.Element; // shown when overlay === 'controlCenter', anchored under its status button
  ```
  `enterFullScreen`: `await doc.documentElement.requestFullscreen()`; then if `nav.keyboard?.lock` → `await lock(['MetaLeft','MetaRight','KeyW','KeyQ','KeyM','KeyN','Digit1','Digit2','Tab','Space'])`, `keyboardLocked = true`; any rejection → `false` (never throws). `DesktopShell` listens to `fullscreenchange` and calls `setKeyboardLocked(false)` when `document.fullscreenElement` becomes null.
  Control Center tiles (glass, 320px wide): Appearance segmented (Light / Dark / Auto), toggles "Reduce motion", "Reduce transparency", "Dock magnification", Wallpaper swatches (one per content wallpaper, `aria-pressed` on current), button "Enter Full Screen" / "Exit Full Screen" (hidden when `document.fullscreenEnabled` is false). Mission Control tile is added in Phase 4 (not rendered now).
  About This Mac: "M" mark, "bymaxOS", "Version {__APP_VERSION__}", rows: "Built by" → profile name, "Stack" → "React · TypeScript · Vite · Tailwind CSS", "Build" → `__BUILD_DATE__` formatted `MMM d, yyyy`, "Source" → link to `site.repoUrl` only when set. Button "More Info…" opens a new tab to the GitHub link from content. No hardware specs.

- [ ] **Step 1: Write failing tests** `fullscreen.test.ts`: with fake `doc` (requestFullscreen resolves) and `nav.keyboard.lock` resolving → `{fullscreen:true, keyboardLocked:true}`; without `keyboard` → `{true,false}`; `requestFullscreen` rejecting → `{false,false}` and no throw.
- [ ] **Step 2: Write failing tests** `ControlCenter.test.tsx`: clicking status button "Control Center" opens a dialog "Control Center"; choosing "Dark" sets `document.documentElement.dataset.theme === 'dark'`; toggling "Reduce motion" adds `reduce-motion`; clicking the "Graphite" swatch sets `settings.wallpaperId === 'graphite'`; Escape closes it.
- [ ] **Step 3:** → FAIL. **Step 4:** Implement. **Step 5:** → PASS.
- [ ] **Step 6: Commit** `feat: add control center, full screen keyboard lock and about this mac`.

### Task 17: End-to-end verification of the desktop system

**Files:**
- Create: `e2e/desktop.spec.ts`, `e2e/helpers.ts`

**Interfaces:**
- Consumes: the running app (Playwright `webServer`).
- Produces: `unlock(page)` helper (goto `/`, press Enter, wait for `role=menubar`).

- [ ] **Step 1: Write the e2e specs** (viewport 1440×900 unless noted):
  - `login then desktop`: login shows the name; Enter → menubar visible; reload → no login (session).
  - `dock opens finder`: click dock "Finder" → dialog "Desktop"; menubar app button text "Finder".
  - `drag window`: drag title bar by (+200,+100) → dialog bounding box moved by ≈(200,100) (±2px).
  - `drag cannot hide title bar`: drag title bar to y = -500 → dialog top ≥ 24.
  - `resize window`: drag the `se` handle by (+120,+80) → size grows ≈ by that.
  - `minimize and restore`: click "Minimize" → dialog hidden; click dock "Finder" → visible again.
  - `zoom`: double-click title bar → dialog box equals work area (x 0, y 24, width 1440, height 900-24-84).
  - `menu commands`: File > New Finder Window → 2 dialogs; Window menu lists 2; ⌥W (`page.keyboard.press('Alt+KeyW')`) → 1 dialog.
  - `viewport shrink clamps`: open Finder, move to bottom-right, `page.setViewportSize({width:1024,height:640})` → dialog title bar fully above `640-84` and left ≤ `1024-80`.
  - `desktop icon opens quick look`: double-click "Resume.pdf" → dialog "Resume.pdf" containing "Scrum Master".
  - `control center dark mode`: open Control Center, click Dark → `html[data-theme="dark"]`.
  - `mobile placeholder`: viewport 390×844 → text "bymaxOS for iPhone is on its way".
  - `axe`: after unlock with Finder open, `new AxeBuilder({page}).analyze()` → zero violations with impact `serious` or `critical`.
  - `screenshots`: save full-page screenshots for 1440×900 and 1280×720 (desktop with Finder open) to `test-results/screens/` (artifacts, not assertions).
- [ ] **Step 2:** Run `npm run e2e` → all pass. Fix defects found via superpowers:systematic-debugging (fix in the owning file, add a unit test reproducing each defect).
- [ ] **Step 3:** Run the full gate: `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → all exit 0. Report actual counts.
- [ ] **Step 4: Commit** `test: add desktop e2e coverage and accessibility scan`.

---

## Spec coverage map (Phases 1–2)

| Spec section | Task(s) |
|---|---|
| §2 stack, fonts, icons, contact, hosting, testing | 1, 2, 3, 7 |
| §3.1–3.2 layout, content, validation | 1, 3 |
| §3.3 registry | 7 |
| §3.4 store + invariants | 5 |
| §3.5 command bus | 6, 10 |
| §3.6 shortcuts + keyboard lock | 6, 11, 16 |
| §3.7 persistence | 4, 5, 15 |
| §3.8 shell selection, deep links | 8 |
| §4.1 login | 8 |
| §4.2 menu bar | 10, 11 |
| §4.3 Control Center | 16 |
| §4.4 dock | 12 |
| §4.5 desktop | 15 |
| §4.6 windows (Scale minimize; Genie in Phase 6) | 9 |
| §5 Finder, Quick Look (TextEdit/Resume/Contacts/Safari open via Quick Look until Phase 3–4), About This Mac | 13, 14, 16 |
| §7.1 a11y (dialogs, focus, labels, reduce motion/transparency) | 2, 9, 10, 17 |
| §7.3 error boundary, noscript, OG | 1, 9 |
| §8 unit + e2e + CI | every task, 1, 17 |

Deferred by design to later plans: Spotlight, Launchpad, Mission Control, App switcher, Notification Center, System Settings app (Phase 4); essential apps (Phase 3); mobile shell (Phase 5); Genie, "Skip to Resume" link (needs Resume, Phase 3), Lighthouse/perf audit (Phase 6).
