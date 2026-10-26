# bymaxOS — Design Spec

Date: 2026-10-26 · Status: approved in brainstorming (sections 1–3) · Owner: Maksymilian Wojnowski

## 1. Intent

A personal website that **is** a simulated operating system: macOS on desktop/tablet, iOS on phones. Visitors (mainly recruiters for Scrum Master / Product Manager / frontend roles, plus curious visitors) explore Maksymilian's profile, résumé, projects, hobbies and contact options through working simulated apps.

Success criteria:
- Desktop visit feels like using a Mac: menu bar, dock, windows, menus, shortcuts and overlays behave as one system.
- A recruiter reaches the résumé and a contact action in ≤ 2 clicks/taps (Resume desktop icon, dock, `?app=resume`, mobile widget/dock, skip link).
- Every visible control does something real or is visibly disabled.
- All personal content lives in typed `src/content/` files; components never hardcode it.
- Nothing is fabricated: no fake time slots, sent emails, metrics, photos, messages or playback.

Reference: https://frvky.online/ (interaction model only; no code or assets copied). We go beyond it with working File/Edit/View menus, Finder, Spotlight, app switcher, Mission Control and window resizing.

## 2. Decisions

| Topic | Decision |
|---|---|
| Stack | Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + Zustand. No Next.js (everything is client-side; avoids hydration issues with clocks/viewport). |
| Drag/resize | Own Pointer Events implementation (no `react-rnd`). |
| Animation | CSS transitions / Web Animations API. Genie effect via WebGL (see §7.4). No animation library unless a spike proves it necessary. |
| Icons | Original squircle app icons (SVG glyphs, Lucide for UI glyphs). No Apple icons, no Apple logo, no assets from the reference site. The "Apple menu" uses a custom "M" mark. |
| Fonts | System stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text"…`), Inter (self-hosted) as fallback. |
| Content language | English only now; content is locale-ready (`src/content/en/`, `getContent(locale)`). PL/PT/DE later. No language setting shown until a second locale exists. |
| Contact | Public email `maksymilianwojnowski@gmail.com`. **Phone not shown publicly.** Résumé PDF download only once a phone-free PDF is supplied (`resume.pdfUrl` unset → no download button). Cal.com URL: placeholder (unset → email fallback). |
| Desktop boot | macOS-style login screen; skipped for the rest of the browser session (`sessionStorage`). |
| Hosting | GitHub Pages via GitHub Actions; custom domain later. |
| Testing | Vitest + Testing Library (unit/TDD), Playwright (e2e, screenshots, `@axe-core/playwright`). |

## 3. Architecture

```
src/content/  ──►  src/apps/registry.ts  ──►  src/system/store.ts (Zustand)
                          │                          │
                          ▼                          ▼
     desktop shell: LoginScreen · MenuBar · Desktop · WindowLayer · Dock · Overlays
     mobile shell:  LockScreen · HomeScreen · AppScreen · NavStack
                          │
                          ▼
                 src/system/commands.ts (command bus)
```

### 3.1 Directory layout

```
src/
  content/            typed personal data (only place to edit content)
    en/               profile, experience, education, skills, projects, links,
                      notes, music, travel, photos, notifications, scheduling, resume
    types.ts          content types
    index.ts          getContent(locale)
  apps/
    registry.ts       AppDefinition[]
    <app>/            one folder per app: Desktop view, Mobile view (or shared body), menus, commands
  system/
    store.ts          window manager + system state
    commands.ts       command bus
    shortcuts.ts      key chord → command mapping
    vfs.ts            virtual filesystem built from content
    search.ts         Spotlight index + ranking
    persistence.ts    local/session storage helpers (try/catch wrapped)
  shells/
    desktop/          LoginScreen, MenuBar, Dock, Desktop, Window, WindowLayer,
                      ControlCenter, NotificationCenter, Spotlight, Launchpad,
                      MissionControl, AppSwitcher, ContextMenu
    mobile/           LockScreen, StatusBar, HomeScreen, AppScreen, NavStack, HomeIndicator
  ui/                 shared primitives (Menu, Popover, Button, Sheet, Toast, Icon, AppIcon)
  lib/                vcard.ts, mailto.ts, format.ts
  main.tsx, App.tsx   shell selection
public/               wallpapers, photos, resume PDF (when supplied)
```

### 3.2 Content (`src/content/`)

Typed TS objects. Optional fields are `undefined` when not configured; apps then render an honest "Not configured yet" state. Seeded from the CV (Nokia Lead Frontend Developer 10/2025–present; Code Technica 07/2024–09/2025; WUST M.Sc. Project Management 03/2026–present; WUST B.Eng. 10/2022–02/2026; Shibaura Institute of Technology 03/2025–08/2025; projects: Engineering Thesis (NBA BI analysis), Solve & Unite! hackathon, LigaPWr; skills; languages PL native / EN C1–C2 / PT A2). Links: LinkedIn `https://www.linkedin.com/in/maksymilian-wojnowski-647585254/`, GitHub `https://github.com/MaksymilianWojnowski`. Unknown items (photos, music, travel memories, notes, Cal.com URL, wallpaper) are clearly marked placeholders with `// TODO(content):` comments.

A content validation test enforces: all URLs are `https:` (or `mailto:`), required fields non-empty, ids unique.

### 3.3 App registry

```ts
interface AppDefinition {
  id: AppId; name: string; icon: AppIconSpec;
  component?: LazyExoticComponent<AppComponent>;   // absent for external links
  external?: string;                                // opens new tab
  window?: { defaultSize: Size; minSize: Size; resizable: boolean; singleInstance: boolean };
  menus?: (ctx: MenuContext) => MenuDef[];          // File/Edit/View/Go/... for this app
  dock?: { pinned: boolean; order: number; group: 'system' | 'apps' | 'links' | 'trash' };
  mobile?: { presentation: 'fullscreen' | 'sheet' | 'external' | 'hidden'; homePage: number; inDock?: boolean };
  search?: (content: Content) => SearchItem[];      // Spotlight entries
}
```

### 3.4 System store

State: `windows: WindowState[]` (`id, appId, title, rect, state: 'normal'|'minimized'|'maximized', prevRect, z, props`), `focusedWindowId | null`, `lock: 'locked'|'unlocked'`, `overlay: null | 'spotlight'|'launchpad'|'missionControl'|'notificationCenter'|'controlCenter'|'appSwitcher'`, `openMenu`, `settings` (appearance, accent, wallpaper, reduceMotion, reduceTransparency, dockSize, dockMagnification), `desktopIconPositions`, `notifications`.

Actions (pure, unit-tested via TDD): `openApp(appId, props?)` (focuses existing window if `singleInstance`), `focus`, `close`, `closeApp`, `minimize`, `restore`, `toggleMaximize`, `move`, `resize`, `cycleApps(dir)`, `clampAll(viewport)`.

Invariants:
- z-order is a stack; focus brings to top.
- Windows are clamped to the work area (below menu bar, above dock) on open, move end, resize end and every viewport change; at least 80px of title bar stays visible.
- New windows cascade +24px from the last; last rect per app remembered for the session.
- Closing/minimizing the focused window focuses the next visible window, else the desktop (active app = Finder).

### 3.5 Command bus

Menus, shortcuts, context menus, dock menus and Spotlight dispatch commands (`{ type: 'window.close' }`, `{ type: 'app.open', appId, props }`, `{ type: 'notes.newNote' }`). Global commands are handled by the store; app commands are routed to the focused window, whose app registers handlers via `useAppCommands(windowId, handlers)`. A menu item whose command has no available handler renders **disabled** — no dead items.

### 3.6 Shortcuts

Browser/OS-reserved chords (`⌘W`, `⌘Tab`, `⌘Space`, `⌘Q`) cannot be intercepted. Primary shortcuts: `⌥W` close, `⌥M` minimize, `⌥Tab` / `` ⌥` `` app switcher, `⌘K` Spotlight, `⌃↑` / F3 Mission Control, `⌥Q` quit app, `⌘1/⌘2` Finder views, `Esc` closes overlays. Chords match on `event.code` (⌥ changes `event.key` on macOS) and are ignored while focus is in a text field, except `Esc` and `⌘K`. Menus display the shortcut that actually works. In browser full screen (Control Center → Full Screen) on Chromium, the Keyboard Lock API is requested so native `⌘W`/`⌘Tab`/`⌘Q` work too; the menu hints switch accordingly.

### 3.7 Persistence

`localStorage`: settings, desktop icon positions, visitor-edited notes. `sessionStorage`: unlocked flag, window rects for the session, GitHub API cache. Every access wrapped in try/catch; the app works with storage unavailable.

### 3.8 Shell selection & deep links

Mobile (iOS) shell when `(max-width: 767px)` or `(pointer: coarse) and (max-height: 500px)`; otherwise desktop. Re-evaluated live on resize. `?app=<id>` (and optional `&item=<id>`) opens that app on load in either shell (still behind the lock screen on first visit, which unlocks straight into the app).

## 4. Desktop experience

### 4.1 Login screen
Blurred wallpaper, avatar (initials "MW" placeholder until a photo is set), name, clock/date. Unlock by click, Enter or upward scroll/swipe. Reduced motion → fade.

### 4.2 Menu bar (24px, translucent)
- "M" menu: About This Mac, System Settings…, Lock Screen, Restart (re-runs boot).
- App menu (bold app name): About <App>, Hide (minimize all its windows), Quit (close all its windows).
- File / Edit / View / Go / Window / Help from the active app's `menus()`; Window lists open windows plus Minimize, Zoom, Bring All to Front; Help → Keyboard Shortcuts sheet, About bymaxOS.
- Right: Wi‑Fi (`navigator.onLine`), battery (Battery Status API; hidden when unavailable), Control Center, Spotlight, clock/date (click → Notification Center).
- Behaviour: click opens; while open, hovering switches menus; arrow keys navigate; Enter activates; Esc/outside click dismiss. ARIA `menubar`/`menu`/`menuitem`.

### 4.3 Control Center
Appearance (light/dark/auto), Reduce motion, wallpaper picker, Full Screen toggle (Fullscreen API + Keyboard Lock where supported), Mission Control button.

### 4.4 Dock
Order: Launchpad · Finder · Resume · apps │ LinkedIn ↗ · GitHub ↗ │ Trash. Translucent, hover tooltips, distance-based magnification (setting; off with reduced motion), running-dot indicators. Click: not running → open; minimized → restore; running → focus its top window. Right-click: Open / Show All Windows / Quit. External links carry a ↗ badge and open in a new tab.

### 4.5 Desktop
Icons in the right column: `Resume.pdf`, `About Me`, `Projects`, `Contact.vcf`. Click selects, double-click/Enter opens, drag rearranges with grid snap (persisted). Icon context menu: Open / Get Info. Desktop context menu: Change Wallpaper… / Clean Up / About bymaxOS.

### 4.6 Windows
28px title bar, traffic lights with hover glyphs, inactive windows greyed. Title double-click = Zoom (fill work area / restore). Drag by title bar, 8 resize handles, min size. Open animation: scale 0.95 + fade. Minimize: Genie (§7.4) with Scale fallback. Each window has an error boundary showing "<App> quit unexpectedly" with Reopen.

### 4.7 Overlays
- **App switcher** (`⌥Tab`): hold ⌥, Tab cycles, release focuses.
- **Mission Control**: scaled grid of open windows; click focuses; Esc exits.
- **Spotlight** (`⌘K`, menu bar icon): searches apps, projects, skills, notes, experience, folders; arrow keys + Enter open the specific target (e.g., Notes at a given note). Simple prefix/substring ranking, no library.
- **Launchpad**: full-screen app grid with search; Esc closes.
- **Notification Center**: dismissible cards from `content/notifications`; system banners top-right (e.g., "Draft opened in your email app — nothing has been sent yet").

## 5. Applications

| App | Desktop behaviour | Honesty rule |
|---|---|---|
| **Resume** (Preview-style) | Document with About, Experience, Skills, Education, Projects, Languages. Toolbar: Download PDF, LinkedIn, GitHub, Email, Book a call, Print (`window.print` + print CSS). | Download button only when `resume.pdfUrl` is set. |
| **Finder** | Sidebar (Desktop, Documents, About Me, Work, Projects, Photos, Interests, Trash), back/forward, icon/list views (`⌘1/⌘2`), path bar, Quick Look (Space). Files open their app: `.md`→TextEdit, `.pdf`→Resume, `.vcf`→Contacts, `.webloc`→Safari, images→Photos. | Virtual FS from content only; never touches visitor files. |
| **TextEdit** (read-only) | Renders About Me documents (intro, skills, languages, facts). | — |
| **Contacts** | Card: name, role, email, LinkedIn, GitHub, Wrocław. Copy per field (banner), Download vCard 3.0, Share via `navigator.share` when available. | No phone. Unconfigured fields omitted. |
| **Mail** | Compose: To (locked), Your name, Subject, Message; validation. Send builds `mailto:` and shows a sheet explaining the hand-off, with "Copy address". | Never claims an email was sent. |
| **Calendar** | Real current month; meeting types from content; each opens the Cal.com URL. | No fake slots/bookings; email fallback when URL unset. |
| **Developer** (GitHub Desktop-style) | Repo list from GitHub REST API (`MaksymilianWojnowski`, session cache) with static fallback; details: description, languages, topics, links, updated date. | Only API-returned numbers; none invented. |
| **Safari** | Tabs/bookmarks bar, Favorites start page. Sites marked `embeddable: true` load in a real iframe; others show "This site can't be shown inside bymaxOS — Open in new tab ↗". | Never fakes loading an external site. |
| **Photos** | Albums, lazy grid, lightbox (arrows, Esc, swipe). | Placeholders labelled as placeholders until real photos are added. |
| **Notes** | Folders · list · editor. Visitors can edit/add notes locally ("Your edits stay on this device"), with Restore originals. Edit > Copy/Paste via command bus. | — |
| **Music** | Artists, albums, playlists with Spotify/Apple Music links; Spotify Embed only after a click and only for a configured playlist. | Nothing pretends to play. |
| **Maps** | Own SVG world map with pins + travel timeline. Seeded: Wrocław, Tokyo (Shibaura 2025). | Only configured places. |
| **Terminal** | `maks@bymaxos ~ %`; `help, whoami, about, experience, projects, skills, contact, resume, open <app>, ls, cd, cat, neofetch, clear, history, sudo` (easter egg); ↑↓ history, Tab completion. | Pure parser; never executes anything on a host. |
| **System Settings** | Appearance, accent, wallpaper, reduce motion/transparency, dock size/magnification. | Language section appears only when a 2nd locale exists. |
| **About This Mac** | "bymaxOS 1.0", author, stack, repo link, build date. | No fake hardware specs. |
| **Launchpad / Spotlight / Trash** | System apps per §4. Trash opens an empty Finder location. | — |

## 6. Mobile (iOS) experience

### 6.1 Lock screen
Wallpaper; status bar (real time, online, battery when available); date + large clock; notification stack (swipe left or ✕ to dismiss); bottom buttons: Flashlight (white-screen torch effect) and Camera (opens Photos). Swipe-up unlock with rubber-band resistance, 30% height or velocity threshold, spring-back; bouncing chevron + "Swipe up to unlock"; tap/Enter alternative. Unlocked state kept for the session.

### 6.2 Home screen
Page 1: profile widget ("Maksymilian · Lead Frontend Developer @ Nokia → Resume"), calendar widget, 4-column app grid. Page 2: social links. Page dots (swipe or tap). Dock: Contacts · Mail · Safari · Resume. Pull-down opens mobile search (Spotlight index).

### 6.3 Apps
Open with zoom-from-icon; return home by swiping up on or tapping the home indicator. In-app nav stack: list → detail slide-in, "‹ Back" button, left-edge swipe back. Mail opens as a sheet; others full screen; external links open a new tab. Terminal shows quick-command chips above the keyboard. Desktop-only features (Mission Control, dock, menu bar) are absent.

### 6.4 Details
`viewport-fit=cover`, `env(safe-area-inset-*)`, `100dvh`; touch targets ≥ 44px; landscape: 6–7 column grid, side clock on lock screen. Visual-only press feedback (no hardware haptics claimed, no permissions requested). Tablets (≥ 768px) get the desktop shell.

## 7. Quality

### 7.1 Accessibility
Labelled controls, visible focus rings, windows as non-modal `role="dialog"` with `aria-labelledby`; focus moves into an opened window and returns on close. Visually-hidden-until-focused "Skip to Resume" link. Reduce motion and reduce transparency honoured (solid surfaces). Glass contrast ≥ 4.5:1 for text, with a darker tint layer where needed. Every gesture has a tap/keyboard alternative.

### 7.2 Performance
Each app is a lazy chunk; shell ≤ 150 KB gzip JS. Wallpapers in AVIF/WebP with sizes; optional video wallpaper paused under reduced motion / Save-Data. Target Lighthouse ≥ 90 for Performance and Accessibility.

### 7.3 Errors & fallbacks
Per-window error boundary ("quit unexpectedly" + Reopen). Empty and "not configured" states in every app. GitHub API failure → static data with a subtle note. `<noscript>` block with résumé summary links (LinkedIn, GitHub, email). OG/Twitter meta for link previews.

### 7.4 Genie effect (required)
Minimize/restore animates the window into its dock icon with a Genie warp: snapshot the window to a texture, render a WebGL mesh that funnels toward the dock icon over ~450ms. A spike validates the snapshot approach first (risk: cross-origin iframes in Safari/Music cannot be captured). Fallback to the Scale effect when snapshotting fails, WebGL is unavailable, or reduced motion is on. Delivered in the polish phase; Scale ships first.

## 8. Testing & delivery

- **Unit (Vitest, TDD):** store actions & invariants, command routing/disabled state, shortcut mapping, vCard, mailto, Spotlight ranking, Terminal parser, VFS, content validation.
- **E2E (Playwright):** desktop — unlock, open via dock/desktop/Spotlight, drag/resize/minimize/restore/zoom, menu commands, `⌥W`; mobile — swipe unlock, open app, back, home; vCard download; axe scan; screenshots at 1440×900, 1280×720, 390×844, 844×390.
- **CI:** GitHub Actions runs typecheck, lint, unit, e2e, build; deploys `main` to GitHub Pages.
- **Execution:** implementer subagents on Haiku (medium), reviewers on Sonnet (high), planning on Opus (high).

## 9. Phases (one implementation plan per phase)

1. **Foundation** — scaffold, tooling, CI, design tokens, content types + seeded content, registry skeleton.
2. **Desktop system** — login, menu bar, dock, window manager, desktop icons, Finder, command bus, shortcuts, context menus, Control Center.
3. **Essential apps** — Resume, TextEdit, Developer, Mail, Contacts, Calendar.
4. **More apps & system** — Safari, Photos, Notes, Music, Maps, Terminal, Spotlight, Launchpad, Mission Control, App switcher, Notification Center, System Settings, About This Mac.
5. **Mobile** — lock screen, notifications, swipe unlock, home screen, mobile app presentations, nav stack.
6. **Polish & verification** — Genie effect, fidelity review vs reference, edge cases, a11y/perf audits, final e2e and screenshots.

## 10. Out of scope (for now)

Marquee multi-select of desktop icons; real/writable filesystem; folder editing; additional locales (structure ready); backend of any kind; email sending service; real booking integration beyond linking to Cal.com.

## 11. Open content items (owner: Maksymilian)

Wallpaper(s) and avatar photo · photos for Photos · phone-free résumé PDF · Cal.com URL and meeting types · music artists/albums/playlists · travel places and memories · notes content · Safari bookmarks beyond LinkedIn/GitHub · repo list overrides/demo URLs.
