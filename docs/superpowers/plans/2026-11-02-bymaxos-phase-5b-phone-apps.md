# bymaxOS Phase 5b (Phone Apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every app usable on a phone: list → detail nav stack with "‹ Back" and left-edge swipe, 44px touch targets, no sideways overflow, Terminal quick-command chips, and apps that keep their state when you go home.

**Architecture:** Two tools, picked per app. Sizing and simple reflow use a CSS variant `phone:` driven by `data-shell="mobile"` on `<html>`, so desktop classes stay untouched and portalled sheets are covered. Apps whose layout really changes branch on `useShell() === 'mobile'` and render the shared `NavStack` from the same list and detail JSX the desktop layout uses. `AppScreen` keeps every visited window mounted and hides the inactive ones, so a new `props` object can reach a live app; `useOpenProps` handles that in one place.

**Tech Stack:** Existing stack. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` §6.3, §6.4, §5 (honesty rules). Conventions: `docs/superpowers/plans/2026-10-29-bymaxos-phase-5a-ios-shell.md`.

## Global Constraints

- All 5a Global Constraints apply (content via `getContent()`, validated storage reads, icon-only buttons have `aria-label`, style matches the file, commits are per task).
- Never run Prettier on whole files. Never leave debug probes behind. Run gate steps one at a time, never in parallel.
- Desktop rendering must not change: `phone:` classes and `useShell` branches only. Existing desktop unit and e2e tests stay green unedited, except where a task names an edit.
- Touch targets ≥ 44×44px. Inline links inside document text are exempt.
- Back button reads "Back" with a chevron, per spec "‹ Back". Slide-in 220ms; instant under reduce motion.
- Every gesture has a tap and keyboard alternative: Back button, and Escape while focus is inside the detail pane.
- Focus never drops to body. Keys from portalled sheets are ignored by the pane underneath (`e.currentTarget.contains(e.target)`). `flushSync` before focusing out of an inert pane.
- Nothing fabricated: no fake controls, and no desktop-only settings on the phone.

## Decisions taken in this plan

| Decision | Choice | Cost if wrong |
|---|---|---|
| Nav stack in landscape | Same stack as portrait | No split view on 844px; easy to add later |
| Photos on phone | Album chips above the grid, not list → grid; the lightbox is the detail | One more tap pattern than other apps |
| Maps on phone | One scrolling page: map, place card, timeline | None |
| Notes on phone | Folder pane dropped (there is one folder) | Returns when a second folder exists |
| Finder on phone | Single tap opens; no Quick Look or context menu, the file's app shows it | Quick Look unreachable on phone |
| Settings on phone | Dock section removed, since the phone has no dock | None |
| Kept apps | Audio in a loaded Spotify player keeps playing after going home, as on iOS | Going home does not stop it |

## Review Focus

1. **Search the same note twice, with Back in between** → the detail opens again, because the trigger is a new `props` object, not a changed id. Pinned in Tasks 3 and 5.
2. **Edge swipe that is really a scroll** (mid-screen start, diagonal, or mostly vertical) → stays in detail and the list still scrolls. Pinned by `shouldEdgeBack` tests in Task 4 and the touch e2e in Task 5.
3. **Deleting the note you are reading** → back on the list, focus on a real control, no blank editor. Pinned in Task 5.
4. **Rotating while a detail is open** → stays in detail, no sideways overflow, pane not stuck off-screen. Pinned in Task 5.
5. **Go home and come back mid-task** (Terminal history, Notes detail, Mail draft) → state intact, and hidden apps are unreachable by Tab and assistive tech. Pinned in Task 2.

---

## File Structure

```
src/App.tsx                       sets data-shell on <html>
src/styles/global.css             phone: variant; 16px inputs on phones (stops iOS focus zoom)
src/shells/mobile/AppScreen.tsx   keeps visited windows mounted, only one active
src/shells/mobile/MobileShell.tsx AppScreen always mounted; height follows visualViewport
src/shells/mobile/gestures.ts     + shouldEdgeBack
src/apps/useOpenProps.ts          fires when an open delivers new props to a live app
src/ui/NavStack.tsx               list → detail, Back, edge swipe, focus handling
src/apps/{notes,finder,music,settings,developer}/   render NavStack on phones
src/apps/{maps,photos,contacts,calendar,mail,resume,textedit,safari}/   phone: classes
src/apps/terminal/Terminal.tsx    quick-command chips
src/test/mockPhone.ts             makes useShell report mobile in unit tests (created in Task 5)
e2e/phone-apps.spec.ts            audit table: target size, overflow, axe per app state
```

---

### Task 1: Phone foundations and the audit

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/styles/global.css`, `e2e/helpers.ts`
- Create: `e2e/phone-apps.spec.ts`

**Interfaces:**
- Produces: `phone:` Tailwind variant; `html[data-shell]`; `phoneAudit(page): Promise<{ smallTargets: string[]; overflowing: string[] }>`; the `PHONE_STATES` table that later tasks append to.

- [ ] **Step 1: Write the failing tests.** `App.test.tsx`: `sets data-shell to desktop, and to mobile after the narrow query flips` (use the file's existing `narrow` and `listeners`). `e2e/phone-apps.spec.ts` at 390×844, `hasTouch: true`: `an input on a phone renders at 16px or more`, unlocking, opening home search and reading its input.
- [ ] **Step 2: Run them.** `npx vitest run src/App.test.tsx`, `npx playwright test e2e/phone-apps.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `App.tsx`: `useLayoutEffect(() => { document.documentElement.dataset.shell = shell }, [shell])`.
  - `global.css`, next to the `dark` variant: `@custom-variant phone (&:where([data-shell=mobile] *));`
  - `global.css`, unlayered so it outranks utilities: `[data-shell='mobile'] :is(input, textarea, select) { font-size: max(16px, 1em); }` with a one-line comment that iOS Safari zooms the page when it focuses a smaller field.
- [ ] **Step 4: Add `phoneAudit` to `e2e/helpers.ts`.**
  - `smallTargets`: visible `button, a[href], input, select, textarea, [role=option], [role=tab], [role=radio], [role=switch]` whose box is under 44 in width or height. Skip `article a` (inline links). Each entry reads `tag "name" WxH`.
  - `overflowing`: elements whose right edge passes `innerWidth` by more than 1px, excluding those inside a horizontally scrolling ancestor and those inside an inert pane; plus `document.documentElement.scrollWidth > innerWidth`.
- [ ] **Step 5: Add the table to `e2e/phone-apps.spec.ts`.**
  `const PHONE_STATES: { name: string; open: (page: Page) => Promise<void> }[] = []`, starting with `Home screen`. Generate one test per state: `<name> has 44px targets and no sideways overflow` at 390×844, and `<name> has no sideways overflow` at 320×568. Each later task appends its states and they must fail before that task's change.
- [ ] **Step 6: Run and commit.** `npx vitest run src/App.test.tsx`, `npx playwright test e2e/phone-apps.spec.ts`. Fix what the home state reports. Commit: `feat: add phone variant, 16px inputs and the phone audit`.

### Task 2: Keep visited apps mounted; follow the keyboard

**Files:**
- Modify: `src/shells/mobile/AppScreen.tsx`, `AppScreen.test.tsx`, `MobileShell.tsx`, `MobileShell.test.tsx`; append to `e2e/mobile.spec.ts`

**Interfaces:**
- Produces: `AppScreen()` (no props, always mounted by `MobileShell`) renders one internal `WindowScreen({ win, active })` per visited window. `active` is `!mobileHome && win.id === focusedId`.

- [ ] **Step 1: Write the failing tests.**
  - `AppScreen.test.tsx`: `keeps an app's local state after going home and coming back`; `hides an inactive app from Tab and assistive tech` (`inert`, `invisible`, and `getByRole('region', { name })` finds nothing); `does not mount a window never shown on the phone` (two windows from a desktop session, only the focused one mounts); `drops a closed window`.
  - `AppScreen.test.tsx`: `moves focus to the region each time the app becomes active, and replays no animation while inactive`.
  - `MobileShell.test.tsx`: `root height follows visualViewport when the keyboard opens` (stub `window.visualViewport` with `height: 400`, `scale: 1`, fire `resize`, expect `400px`); `ignores visualViewport while pinch-zoomed` (`scale: 2`, height unchanged); `works when visualViewport is undefined`.
  - `e2e/mobile.spec.ts`: `Terminal keeps its output, and the Mail draft survives closing the sheet`.
- [ ] **Step 2: Run them.** `npx vitest run src/shells/mobile`. Expected: FAIL.
- [ ] **Step 3: Implement `AppScreen`.**
  - Keep a `visited: string[]` state, adding the active window's id during render (the `seenItem` pattern).
  - Render `wm.windows.filter(visited)`. Each stays absolutely positioned; inactive gets `invisible`, `inert`, `aria-hidden="true"`.
  - Use `invisible`, not `hidden`, so scroll positions survive.
  - The focus and animation effect keys on `active`, not `winId`.
- [ ] **Step 4: Implement `MobileShell`.**
  - Always render `<AppScreen />`. The home-screen rules are unchanged.
  - Add a `visualViewport` effect on the root ref: on `resize` and `scroll`, if `scale <= 1.01` set `el.style.height` to `${vv.height}px` and call `window.scrollTo(0, 0)`. Comment why: iOS `100dvh` does not shrink for the keyboard. Clean up listeners and the inline height.
- [ ] **Step 5: Run and commit.** `npx vitest run src/shells/mobile`, `npx playwright test e2e/mobile.spec.ts`. Fix tests that relied on unmounting. Commit: `feat: keep visited phone apps mounted and fit the shell above the keyboard`.

### Task 3: Deliver new props to live apps

**Files:**
- Create: `src/apps/useOpenProps.ts`, `src/apps/useOpenProps.test.tsx`
- Modify: `src/apps/{notes/Notes,maps/Maps,music/Music,photos/Photos,settings/Settings,safari/Safari,finder/Finder}.tsx` and `src/apps/finder/finderState.ts` with their tests

**Interfaces:**
- Produces: `useOpenProps(props: AppProps['props'], apply: (props: Record<string, unknown>) => void): void`. Runs `apply` during render on the first render with props and whenever the `props` object identity changes. `apply` may only call this component's setters.
- Produces: `FinderAction` `{ type: 'root'; folderId: string }`, which resets to `history: [folderId], index: 0, selected: null`.

- [ ] **Step 1: Write the failing tests.**
  - `useOpenProps.test.tsx`: `applies on mount`; `applies again for a new object with the same item`; `does not apply on a re-render with the same object`; `does nothing without props`.
  - `Notes.test.tsx`: `reselects a note opened again with the same item after picking another`. Same test in `Maps`, `Music`, `Photos`.
  - `Settings.test.tsx`: `a new item switches section while mounted`.
  - `Safari.test.tsx`: `a new url prop navigates while mounted`; `the first render does not navigate twice`.
  - `Finder.test.tsx`: `a new folderId prop moves a mounted window there`.
  - `finderState` test: `root resets history`.
- [ ] **Step 2: Run them.** `npx vitest run src/apps`. Expected: FAIL.
- [ ] **Step 3: Implement the hook and convert the apps.**
  - Replace each `seenItem` block with `useOpenProps`, keeping its existing validity checks and comment reason.
  - Settings, Safari and Finder gain the hook because they read props only at init until now.
  - Safari skips when the url equals the active tab's. Finder dispatches `root` only when `folderId` differs from the current folder.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps`. Commit: `refactor: deliver repeat opens to live apps through useOpenProps`.

### Task 4: NavStack

**Files:**
- Create: `src/ui/NavStack.tsx`, `src/ui/NavStack.test.tsx`
- Modify: `src/shells/mobile/gestures.ts`, `gestures.test.ts` (real touch is pinned in Task 5's e2e, the first app on the stack)

**Interfaces:**
- Produces: `shouldEdgeBack(startX: number, dx: number, dy: number, width: number, velocity: number): boolean`. True when `startX <= 24`, `dx > 0`, `dx > |dy|`, and either `dx >= width * 0.3` or (`velocity >= 0.5` and `dx >= width * 0.05`).
- Produces:

```ts
export function NavStack(props: {
  title: string
  listActions?: ReactNode
  list: ReactNode
  open: boolean
  detailTitle: string
  detailActions?: ReactNode
  onBack: () => void
  detail: ReactNode
}): JSX.Element
```

- [ ] **Step 1: Write the failing tests.**
  - `gestures.test.ts`: `edge swipe past 30% goes back`; `a flick past 5% goes back`; `a start beyond 24px does not`; `a mostly vertical drag does not`; `a leftward drag does not`.
  - `NavStack.test.tsx`:
    - `shows the list with its title, and hides the detail from assistive tech while closed`
    - `open shows detail title and Back; the list is inert`
    - `Back calls onBack and returns focus to the row that opened the detail`
    - `falls back to the first list control when that row is gone`
    - `focuses the detail heading when opened, and not on first mount`
    - `a child focusing its own field on open keeps that focus`
    - `Escape inside the detail goes back`
    - `Escape from a portalled sheet does not`
    - `a left-edge pointer drag goes back; one from mid-screen does not`
    - `a cancelled pointer clears the inline transform`
- [ ] **Step 2: Run them.** `npx vitest run src/ui/NavStack.test.tsx src/shells/mobile/gestures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `shouldEdgeBack`.** Velocity reuses `releaseVelocity` with `{ y: -x, t }` samples.
- [ ] **Step 4: Implement `NavStack`.**
  - Root is `relative h-full overflow-hidden`, holding two `absolute inset-0 flex flex-col bg-window` panes, each with a 44px header (`h2`, centred, truncated).
  - Detail pane: `transition-[transform,visibility] duration-200`, `translate-x-full invisible` when closed, `touch-pan-y`.
  - List pane is `inert` and `aria-hidden` while open; detail likewise while closed.
  - Record the opener with `onClickCapture` on the list pane (`e.target.closest('button')`).
  - Back runs `flushSync(onBack)`, then focuses the opener if connected, else the first `button, input` in the list pane.
  - Drag: on pointer down within the edge zone capture the pointer and sample; on move, once `dx > |dy|`, set inline `transform` and `transition: none`; on up decide with `shouldEdgeBack`; clear the inline styles on up and cancel.
  - Width comes from the root's `offsetWidth` at release, so rotation cannot leave a stale value and nothing is stored for later.
- [ ] **Step 5: Run and commit.** Same command, expected PASS. Commit: `feat: add NavStack with Back, Escape and left-edge swipe`.

### Task 5: Notes on the phone

**Files:**
- Modify: `src/apps/notes/Notes.tsx`, `Notes.test.tsx`; append to `e2e/phone-apps.spec.ts`, `e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: `NavStack`, `useShell`, `useOpenProps`.

- [ ] **Step 1: Write the failing tests.** Add a small `mockPhone()` to `Notes.test.tsx` that spies `window.matchMedia` so `(max-width: 767px)` matches, following `App.test.tsx`. Move it to `src/test/mockPhone.ts` for reuse by later tasks.
  - `phone: starts on the list, and tapping a note opens its editor`
  - `phone: New Note opens the editor with the body focused`
  - `phone: deleting the open note returns to the list with focus on a control`
  - `phone: opening with an item starts in the editor`
  - `phone: a repeat open with the same item reopens the editor after Back`
  - `phone: no Folders list is rendered`
  - `phone: Restore originals stays on the list screen`
  - Desktop tests stay unedited.
  - `e2e/mobile.spec.ts`, real touch at 390×844: `Notes: edge swipe returns to the list; a mid-screen swipe does not`; `rotating with a note open keeps it open with no overflow`; `search opens the note, Back, same search opens it again`.
  - `PHONE_STATES`: `Notes list`, `Notes editor`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Extract `list`, `editor` and `footer` as local JSX used by both layouts. The desktop tree stays the same.
  - On phones return `NavStack` with: `title="Notes"`, `listActions` = New Note, list = search, notes and footer; `detailTitle` = note title or `Untitled`; `detailActions` = Delete note.
  - Add `detailOpen` state, set by row tap, `newNote`, and `useOpenProps`; cleared by Back and `remove`.
  - `phone:` classes bring icon buttons, rows, search and Restore to 44px.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps/notes`, `npx playwright test e2e/mobile.spec.ts e2e/phone-apps.spec.ts`. Commit: `feat: give Notes a list and editor stack on phones`.

### Task 6: Finder on the phone

**Files:**
- Modify: `src/apps/finder/Finder.tsx`, `Finder.test.tsx`; append to `e2e/phone-apps.spec.ts`

- [ ] **Step 1: Write the failing tests.**
  - `phone: starts on the locations list`
  - `phone: tapping a location opens that folder`
  - `phone: one tap on a subfolder enters it, and Back returns to the parent`
  - `phone: Back from the first folder returns to the locations, not an earlier location` (Work, Back, Documents, Back)
  - `phone: one tap on a file dispatches its open target`
  - `phone: opening with a folderId starts inside that folder`
  - `phone: an empty folder shows its placeholder`
  - `phone: items are buttons with no context menu`
  - `PHONE_STATES`: `Finder locations`, `Finder folder icons`, `Finder folder list`, `TextEdit document` (open via About Me). Add `phone:px-5` to the TextEdit article here so that state passes.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** On phones return `NavStack`.
  - `title="Finder"`; list = the `SIDEBAR` groups as 44px rows dispatching `root`.
  - `detailTitle` = `folderName`; `detailActions` = the Icons/List toggle.
  - Detail renders plain `<button>` items in the existing icons grid or a two-line list. No listbox, toolbar or path bar.
  - `onBack`: `canBack ? send({ type: 'back' }) : setDetailOpen(false)`.
  - Desktop keeps its tree and tests.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps/finder`, `npx playwright test e2e/phone-apps.spec.ts`. Commit: `feat: give Finder a locations and folder stack on phones`.

### Task 7: Music and Settings on the phone

**Files:**
- Modify: `src/apps/music/Music.tsx`, `Music.test.tsx`, `src/apps/settings/Settings.tsx`, `Settings.test.tsx`, `src/ui/Switch.tsx`; append to `e2e/phone-apps.spec.ts`

- [ ] **Step 1: Write the failing tests.**
  - Music: `phone: starts on the library, and a row opens its detail`; `phone: opening with an item starts in the detail`; `phone: the empty state still renders`; `phone: the Spotify player loads only after its button is tapped`.
  - Settings: `phone: lists Appearance, Wallpaper and Accessibility, and no Dock`; `phone: a section opens and Back returns`; `phone: item=dock stays on the list`; `phone: opening with item=wallpaper starts in that section`.
  - `PHONE_STATES`: `Music empty state`, `Settings list`, `Settings Appearance`, `Settings Wallpaper`, `Settings Accessibility`. Seeded music content is empty, so the Music stack is pinned by unit tests with mocked content only.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Music: `NavStack` with the existing sidebar and detail JSX; `choose` opens the detail on phones.
  - Settings: `SECTIONS` filtered on phones; the section heading moves to `detailTitle`.
  - `phone:` classes: rows 44px, Mode group `phone:w-full`, radios `phone:h-11`, swatches `phone:h-11 phone:w-11`, `Switch` `phone:h-11`, `BUTTON` in Music `phone:min-h-11`.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps/music src/apps/settings`, `npx playwright test e2e/phone-apps.spec.ts`. Commit: `feat: give Music and Settings list and detail stacks on phones`.

### Task 8: Developer on the phone

**Files:**
- Modify: `src/apps/developer/Developer.tsx`, `Developer.test.tsx`; append to `e2e/phone-apps.spec.ts`

- [ ] **Step 1: Write the failing tests.**
  - `phone: starts on the repository list, and a row opens its details`
  - `phone: rows are buttons, not a listbox`
  - `phone: the fallback notice shows on the list`
  - `phone: an empty list shows its message with no detail`
  - `phone: the loading state renders`
  - `PHONE_STATES`: `Developer list`, `Developer detail`, with `api.github.com` routed to `e2e/fixtures/repos.json` as `e2e/apps.spec.ts` does.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** `NavStack` with `title="Developer"`, rows as 44px buttons setting `picked` and opening; `detailTitle` = repo name; the `h2` is dropped from the detail on phones. The API numbers rule is unchanged. `phone:min-h-11` on `BUTTON`.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps/developer`, `npx playwright test e2e/phone-apps.spec.ts`. Commit: `feat: give Developer a list and detail stack on phones`.

### Task 9: Apps that only need to fit

**Files:**
- Modify: `src/apps/{maps/Maps,photos/Photos,contacts/Contacts,calendar/Calendar,mail/Mail,resume/Resume,safari/Safari}.tsx`; append to `e2e/phone-apps.spec.ts`, `e2e/mobile.spec.ts`

- [ ] **Step 1: Write the failing tests.** Append to `PHONE_STATES`: `Maps`, `Photos empty state`, `Contacts`, `Calendar`, `Mail sheet`, `Resume`, `Safari favorites`. `e2e/mobile.spec.ts`: `Maps: the map fills the width with the timeline below it`; `Resume: the page is at least 340px wide at 390`. Seeded photo content is empty, so the Photos chips and lightbox classes get no browser check until real photos exist; say so in the phase report.
- [ ] **Step 2: Run them.** `npx playwright test e2e/phone-apps.spec.ts`. Expected: FAIL, and the failure list is the to-do list.
- [ ] **Step 3: Apply `phone:` classes only. No `useShell` here.**
  - Maps: root `phone:flex-col phone:overflow-auto`; nav `phone:order-last phone:w-full phone:border-r-0 phone:overflow-visible`; section `phone:overflow-visible`; rows `phone:min-h-11`; pins `phone:h-11 phone:w-11`.
  - Photos: root `phone:flex-col`; albums nav `phone:w-full phone:border-r-0 phone:border-b`, list `phone:flex-row phone:overflow-x-auto`, chips `phone:min-h-11 phone:w-auto phone:shrink-0`; lightbox `NAV` `phone:h-11 phone:w-11` and overlaid on the image (`phone:absolute`, left and right, with the row `relative`).
  - Contacts: copy buttons and `BUTTON` 44px.
  - Calendar: `ICON_BUTTON` and `BUTTON` 44px.
  - Mail: Send `phone:h-11 phone:w-11`, fields `phone:min-h-11`, textarea `phone:min-h-[120px]`, form `phone:overflow-auto`.
  - Resume: toolbar `phone:flex-nowrap phone:justify-start phone:overflow-x-auto`, `BUTTON` `phone:min-h-11 phone:shrink-0`; scroll area `phone:p-0`; article `phone:p-5`.
  - Safari: `PILL`, `ICON_BUTTON`, address and bookmarks to 44px; bookmarks bar `[@media(max-height:500px)]:hidden`.
  - Shared `Sheet`: Done button `phone:min-h-11` so `Mail` and `Notes` sheets pass.
- [ ] **Step 4: Run and commit.** `npx playwright test e2e/phone-apps.spec.ts e2e/mobile.spec.ts`, `npx vitest run src/apps src/ui`. Commit: `feat: fit Maps, Photos, Contacts, Calendar, Mail, Resume and Safari to phones`.

### Task 10: Terminal chips

**Files:**
- Modify: `src/apps/terminal/Terminal.tsx`, `Terminal.test.tsx`; append to `e2e/phone-apps.spec.ts`

**Interfaces:**
- Produces: `QUICK_COMMANDS = ['help', 'whoami', 'about', 'experience', 'projects', 'skills', 'contact', 'clear']`, exported from `Terminal.tsx`.

- [ ] **Step 1: Write the failing tests.**
  - `phone: chips sit between the output and the input`
  - `desktop: no chips`
  - `phone: tapping a chip runs it, echoes it and adds it to history`
  - `phone: the clear chip empties the output`
  - `every quick command is a real command` (each `runCommand` result has no "command not found" line)
  - `phone: a typed draft survives a chip tap`
  - `PHONE_STATES`: `Terminal`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Split `submit` into `run(line: string)`; the form calls `run(input)` and clears the input, chips call `run(chip)` and leave the draft. Chips are a `role="toolbar"` `aria-label="Quick commands"` with `overflow-x-auto`, rendered when `useShell() === 'mobile'`, 44px high, styled for the dark terminal background.
- [ ] **Step 4: Run and commit.** `npx vitest run src/apps/terminal`, `npx playwright test e2e/phone-apps.spec.ts`. Commit: `feat: add Terminal quick-command chips on phones`.

### Task 11: Whole-phone pass

**Files:**
- Modify: `e2e/phone-apps.spec.ts`, plus whatever the checks expose

- [ ] **Step 1: Add axe.** For every `PHONE_STATES` entry, `axe passes in light and dark` using `seriousViolations` and `settleAnimations` (move the latter from `e2e/mobile.spec.ts` to `e2e/helpers.ts`).
- [ ] **Step 2: Add landscape.** Every state at 844×390 with `hasTouch` has no sideways overflow and keeps its Home button in view.
- [ ] **Step 3: Run the states and fix findings at the source.** `npx playwright test e2e/phone-apps.spec.ts`. Expected: all pass after fixes; each fix carries its own test.
- [ ] **Step 4: Run the gate sequentially.** `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`. Expected: each exits 0, checked by exit code without piping to `tail`.
- [ ] **Step 5: Commit.** Commit: `test: audit every app state on phones in both themes and orientations`.

### Task 12: Real iOS Safari check (needs the owner)

Chromium cannot prove these. No iOS runtime is installed on this Mac, so the check runs on a real iPhone over the local network, or in the Simulator if the owner installs the iOS platform.

- [ ] **Step 1: Serve the build.** `npm run build`, then `npm run preview -- --host`.
- [ ] **Step 2: Check on iPhone Safari and record each result in the phase report.**
  - Left-edge swipe in Notes: does Safari's own history gesture take it?
  - Terminal: are the chips above the keyboard?
  - Notes and Mail: does focusing a field zoom the page?
  - Lock screen swipe and home indicator swipe.
- [ ] **Step 3: Fix or report.** If Safari takes the edge swipe, widen nothing and rely on the Back button; report it as a platform limit.
