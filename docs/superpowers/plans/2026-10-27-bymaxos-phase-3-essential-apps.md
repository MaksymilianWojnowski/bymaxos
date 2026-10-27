# bymaxOS Phase 3 (Essential Apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six working apps on the desktop shell — Resume, TextEdit, Mail, Contacts, Calendar, Developer — plus system banners, so a recruiter can read the résumé, contact Maksymilian and browse his code without leaving bymaxOS.

**Architecture:** Each app is a lazy chunk in `src/apps/<app>/`, registered in `src/apps/registry.ts` and opened through the existing window manager and command bus. Pure helpers (mailto, vCard, month grid, date format, GitHub client, clipboard) live in `src/lib/` with unit tests. Apps talk to the system only through `useSystem` actions and `dispatch`; honest feedback ("copied", "draft handed to your email app") goes through a new banner queue in the store.

**Tech Stack:** Existing stack (Vite, React 19, TypeScript strict, Tailwind v4, Zustand 5, lucide-react, Vitest + Testing Library, Playwright + axe). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` (§5 Applications, §4.7 banners, §7). Phase 1–2 plan for conventions: `docs/superpowers/plans/2026-10-26-bymaxos-phase-1-2-foundation-desktop.md`.

## Global Constraints

- All Phase 1–2 Global Constraints still apply, except the icon rule: app/folder/document icons are macOS artwork PNGs already exported to `src/assets/icons/` (`textedit.png`, `mail.png`, `contacts.png`, `calendar.png`, `xcode.png`, `preview.png`, …). Import them as modules (`import mailIcon from '../assets/icons/mail.png'`) and register as `icon: { image: mailIcon }`. Do not re-run the export script.
- Code style: match the file you edit (most files: single quotes, no semicolons; `src/system/types.ts`, `wm.ts`, `storage.ts` use semicolons). Never run Prettier over whole files — the repo has no Prettier config.
- Personal data only via `getContent()`; never hardcode name, email, links, dates.
- Never fabricate: no "sent" claims, no fake slots/bookings, no invented GitHub numbers. Unset optional content → omit the control or show the exact copy given in the task.
- No phone number anywhere (vCard included).
- External URLs open with `window.open(url, '_blank', 'noopener,noreferrer')`; `mailto:` opens with `window.open(url, '_self')`.
- Session/local storage only through `safeStorage` (`src/system/storage.ts`).
- Menu items an app adds must have a registered handler (`useWindowCommands`) or they render disabled — no dead items.
- Icon-only buttons have `aria-label`; text inputs have visible labels.
- Commits: Conventional Commits; message ends with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gate before each commit: `npm run typecheck && npm run lint && npm test` all pass.

## Review Focus

1. **Same document opened twice** (double-click `Hello.md` in Finder, then on the desktop) → the existing TextEdit window is focused, no duplicate. Pinned by `openWindow documentKey` tests (Task 2).
2. **Clipboard unavailable or denied** (insecure context, Firefox permission, `navigator.clipboard` undefined) → banner says copying failed; nothing claims "copied". Pinned by `copyText` tests (Task 1) and Contacts copy-failure test (Task 4).
3. **GitHub API rate-limited (403) or offline** → saved list from content with the note "GitHub is unreachable — showing a saved list."; no stars/forks/dates shown for saved entries. Pinned by `loadRepos` fallback tests and Developer fallback test (Task 7).
4. **Mail with whitespace-only fields or special characters** (`&`, `#`, `?`, emoji, newlines) → whitespace counts as empty; the mailto URL round-trips every character. Pinned by `buildMailto` and Mail validation tests (Task 3).
5. **Calendar across a year boundary** (December → next → January of next year; Today from another month) → correct month/year heading and today marker. Pinned by Calendar navigation tests (Task 5).

---

## File Structure

```
src/lib/clipboard.ts      copyText
src/lib/mailto.ts         buildMailto
src/lib/vcard.ts          buildVCard, downloadText
src/lib/calendar.ts       monthGrid
src/lib/format.ts         formatMonth, formatRange, formatDate
src/lib/github.ts         Repo, githubUser, fetchRepos, fetchLanguages, fallbackRepos, loadRepos
src/system/store.ts       + banners, notify, dismissBanner
src/system/types.ts       + WindowSpec.documentKey
src/system/wm.ts          + documentKey dedupe in openWindow
src/system/vfs.ts         docFile props → { fileId }
src/system/storage.ts     + KEYS.github
src/shells/desktop/Banners.tsx       banner stack (top-right)
src/shells/desktop/DesktopShell.tsx  + <Banners/>, + Skip to Resume link
src/content/types.ts, en/site.ts     + MeetingType, scheduling.meetingTypes
src/apps/textedit/TextEdit.tsx
src/apps/mail/Mail.tsx
src/apps/contacts/Contacts.tsx
src/apps/calendar/Calendar.tsx
src/apps/resume/Resume.tsx, ResumeDocument.tsx, menus.ts
src/apps/developer/Developer.tsx
src/styles/global.css     + print rules
e2e/apps.spec.ts
```

Dock order after this phase: Finder (system 1) · Resume (system 2) │ Mail (apps 1) · Contacts (apps 2) · Calendar (apps 3) · Developer (apps 4) │ LinkedIn · GitHub │ Trash.

---

### Task 1: System banners and clipboard helper

**Files:**
- Create: `src/lib/clipboard.ts`, `src/lib/clipboard.test.ts`, `src/shells/desktop/Banners.tsx`, `src/shells/desktop/Banners.test.tsx`
- Modify: `src/system/store.ts`, `src/system/store.test.ts`, `src/shells/desktop/DesktopShell.tsx`

**Interfaces:**
- Produces: `copyText(text: string): Promise<boolean>`; store `banners: Banner[]`, `notify(title: string, body?: string): string` (returns banner id), `dismissBanner(id: string): void`; `export interface Banner { id: string; title: string; body?: string }` exported from `store.ts`; `BANNER_MS = 5000` exported from `Banners.tsx`.

- [ ] **Step 1: Write failing tests**

`clipboard.test.ts`:
- `resolves true when navigator.clipboard.writeText resolves` — stub `navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }`; expect `await copyText('a@b.c')` → `true` and `writeText` called with `'a@b.c'`.
- `resolves false when writeText rejects` → `false`.
- `resolves false when navigator.clipboard is undefined` → `false`.

`store.test.ts` (add):
- `notify appends a banner with title and body` → `banners` has `{ title: 'Contacts', body: 'Email copied.' }`, returned id equals its `id`.
- `dismissBanner removes only that banner`.
- `keeps at most 3 banners, dropping the oldest` — notify 4 times → titles of `banners` are the last 3 in order.

`Banners.test.tsx` (fake timers):
- `renders banners in a polite status region` — `getByRole('status')` has `aria-live="polite"`, shows title and body.
- `dismiss button removes the banner` — button name `Dismiss notification`.
- `auto-dismisses after BANNER_MS` — `vi.advanceTimersByTime(BANNER_MS)` → banner gone.

- [ ] **Step 2: Run** `npx vitest run src/lib/clipboard.test.ts src/system/store.test.ts src/shells/desktop/Banners.test.tsx` — expect FAIL (missing exports).

- [ ] **Step 3: Implement**
- `copyText`: `navigator.clipboard?.writeText` in try/catch.
- Store: ids from a module counter `banner-${n}`; cap `MAX_BANNERS = 3`. `banners` is not persisted.
- `Banners`: fixed, `top: MENU_BAR_H + 8`, `right: 8`, `z` above windows (use the same z constant the menu bar/overlays use, not a magic number); glass card `w-[340px]`, title semibold 13px, body 12px `text-text-2`; per-banner `setTimeout(BANNER_MS)` started on mount, cleared on unmount. Region is always mounted (empty when no banners) so screen readers announce additions.
- Mount `<Banners />` in `DesktopShell` after `<Dock />`.

- [ ] **Step 4: Run** the same tests — PASS. Then the gate.
- [ ] **Step 5: Commit** `feat: add system banners and clipboard helper`

---

### Task 2: TextEdit (read-only) and per-document windows

**Files:**
- Create: `src/apps/textedit/TextEdit.tsx`, `src/apps/textedit/TextEdit.test.tsx`
- Modify: `src/system/types.ts` (WindowSpec), `src/system/wm.ts`, `src/system/wm.test.ts`, `src/apps/types.ts` (`window.documentKey?`), `src/apps/registry.ts`, `src/system/vfs.ts`, `src/system/vfs.test.ts`

**Interfaces:**
- Produces: `WindowSpec.documentKey?: string` and `AppDefinition['window'].documentKey?: string` — name of the prop that identifies a document; `resolveWindowSpec` copies it. TextEdit props: `{ fileId: string }` (a VFS node id) for every `.md` file.

- [ ] **Step 1: Write failing tests**

`wm.test.ts`:
- `openWindow with documentKey focuses the window already showing that document` — spec `{ appId: 'textedit', singleInstance: false, documentKey: 'fileId', … }`; open with `{ fileId: 'doc-hello' }`, open another app window, open textedit `{ fileId: 'doc-hello' }` again → still 1 textedit window, it is `focusedId` and top of z-order.
- `openWindow with documentKey opens a new window for a different document` → 2 textedit windows.
- `openWindow with documentKey restores a minimized window of that document` → state `'normal'`.

`vfs.test.ts`: update existing `docId` expectations → `open.props` is `{ fileId: 'doc-hello' }` for `Hello.md`.

`TextEdit.test.tsx` (render with `windowId="w1"`):
- `renders the document body for a fileId` — props `{ fileId: 'doc-hello' }` → heading equal to `getContent().profile.headline`.
- `sets the window title to the file name` — spy `useSystem.getState().setTitle` (or check store title after opening via `openApp`) → `'Hello.md'`.
- `shows Not configured yet for an unknown fileId` → text `Not configured yet`.
- `renders work files` — `{ fileId: 'work-<first experience id>' }` shows that role.

- [ ] **Step 2: Run** `npx vitest run src/system/wm.test.ts src/system/vfs.test.ts src/apps/textedit` — FAIL.

- [ ] **Step 3: Implement**
- `wm.openWindow`: before the cascade branch, if `spec.documentKey && props?.[spec.documentKey] !== undefined`, find an existing window with the same `appId` and equal `props[documentKey]`; if found return `restoreWindow(s, existing.id)` (same path singleInstance uses).
- `vfs.docFile`: props `{ fileId: \`doc-${d.id}\` }`.
- `TextEdit.tsx` default export `TextEditApp({ windowId, props }: AppProps)`: look up `nodeById(props?.fileId)` from `../finder/vfsInstance`; accept only `kind: 'file'` with `preview.kind === 'text'`; `setTitle(windowId, file.name)` in an effect (as QuickLook does); body: white "paper" (`bg-white text-black dark:bg-[#1e1e1e] dark:text-white`), `max-w-[680px]` centred, padding 40px, `<LightMarkdown source={preview.body} />`, text selectable.
- Registry entry: `id: 'textedit'`, `name: 'TextEdit'`, `icon: { image: texteditIcon }`, `load: () => import('./textedit/TextEdit')`, `deepLink: false`, `window: { defaultSize: { w: 620, h: 560 }, minSize: { w: 360, h: 280 }, resizable: true, singleInstance: false, documentKey: 'fileId' }`. No dock entry.

- [ ] **Step 4: Run** the tests — PASS; gate.
- [ ] **Step 5: Commit** `feat: add read-only TextEdit with one window per document`

---

### Task 3: Mail compose

**Files:**
- Create: `src/lib/mailto.ts`, `src/lib/mailto.test.ts`, `src/apps/mail/Mail.tsx`, `src/apps/mail/Mail.test.tsx`
- Modify: `src/apps/registry.ts`

**Interfaces:**
- Consumes: `copyText`, `notify` (Task 1), `Sheet` (`src/ui/Sheet.tsx`, props `title`, `onClose`, `children`).
- Produces: `buildMailto(m: { to: string; subject: string; body: string }): string`; window command `mail.send`.

- [ ] **Step 1: Write failing tests**

`mailto.test.ts`:
- `encodes subject and body` — `buildMailto({ to: 'maksymilianwojnowski@gmail.com', subject: 'Hi & bye?', body: 'Line 1\nLine 2 #1' })` → `'mailto:maksymilianwojnowski@gmail.com?subject=Hi%20%26%20bye%3F&body=Line%201%0D%0ALine%202%20%231'`.
- `round-trips emoji and unicode` — `decodeURIComponent` of the body param equals the input with `\r\n` line breaks (`'Cześć 👋\r\nOK'`).

`Mail.test.tsx` (spy `window.open`, stub clipboard):
- `To is the profile email and read-only` — textbox `To` has value `getContent().profile.email` and `readOnly`.
- `Send with empty or whitespace-only subject and message shows both errors and opens nothing` — type `'   '` in Subject → click `Send` → `Add a subject.` and `Write a message.` visible, fields `aria-invalid="true"`, `window.open` not called.
- `Send opens the mailto draft in the same tab` — Subject `Hello`, Your name `Ann`, Message `Hi` → `window.open` called with `buildMailto({ to: email, subject: 'Hello', body: 'Hi\n\n— Ann' })` and `'_self'`.
- `after Send a sheet explains nothing was sent` — dialog named `Finish in your email app` contains `nothing has been sent` ; a banner titled `Mail` with body `Draft opened in your email app — nothing has been sent yet.` is in the store.
- `Copy address in the sheet reports success or failure honestly` — resolved clipboard → banner body `Email address copied.`; rejected → `Couldn't copy the address — select it and copy it manually.`

- [ ] **Step 2: Run** `npx vitest run src/lib/mailto.test.ts src/apps/mail` — FAIL.

- [ ] **Step 3: Implement**
- `buildMailto`: normalise `\r?\n` → `\r\n`, `encodeURIComponent` for subject and body.
- `Mail.tsx` default export `MailApp({ windowId }: AppProps)`: toolbar with a Send button (`aria-label="Send"`, paper-plane glyph); form rows `To` (read-only), `Your name` (optional), `Subject`, `Message` (textarea, fills remaining height). Validation on Send only, trimmed; errors linked with `aria-describedby`. Body = message + (name ? `\n\n— ${name}` : ''). Register `useWindowCommands(windowId, { 'mail.send': send })`.
- Sheet copy (exact): title `Finish in your email app`; text `bymaxOS doesn't send email. Your draft was handed to your default email app — nothing has been sent yet. Review it there and press Send. If no app opened, write to ${email}.`; buttons `Copy address`, `Done`.
- Registry: `id: 'mail'`, `name: 'Mail'`, `icon: { image: mailIcon }`, `window: { defaultSize: { w: 640, h: 520 }, minSize: { w: 420, h: 360 }, resizable: true, singleInstance: true }`, `dock: { order: 1, group: 'apps' }`, `menus`: File menu with `Send` (`mail.send`) and `Close Window` (`window.close`).

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Mail compose that hands off to the email app`

---

### Task 4: Contacts and vCard

**Files:**
- Create: `src/lib/vcard.ts`, `src/lib/vcard.test.ts`, `src/apps/contacts/Contacts.tsx`, `src/apps/contacts/Contacts.test.tsx`
- Modify: `src/apps/registry.ts`

**Interfaces:**
- Consumes: `copyText`, `notify` (Task 1); `dispatch({ type: 'app.open', appId: 'mail' })`.
- Produces: `buildVCard(c: { name: string; title: string; email: string; location: string; urls: { label: string; url: string }[] }): string`; `downloadText(filename: string, text: string, mime: string): void`.

- [ ] **Step 1: Write failing tests**

`vcard.test.ts`:
- `builds a vCard 3.0 with CRLF line endings` — input name `Maksymilian Wojnowski`, title `Lead Frontend Developer`, email `maksymilianwojnowski@gmail.com`, location `Wrocław, Poland`, urls `[{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/x/' }]` → exactly:
  ```
  BEGIN:VCARD\r\nVERSION:3.0\r\nN:Wojnowski;Maksymilian;;;\r\nFN:Maksymilian Wojnowski\r\nTITLE:Lead Frontend Developer\r\nEMAIL;TYPE=INTERNET:maksymilianwojnowski@gmail.com\r\nADR;TYPE=WORK:;;;Wrocław\, Poland;;;\r\nitem1.URL:https://www.linkedin.com/in/x/\r\nitem1.X-ABLabel:LinkedIn\r\nEND:VCARD\r\n
  ```
- `escapes backslash, comma, semicolon and newline in text values` — as JS literals: title `'A; B, C\\D\nE'` → output contains the line `'TITLE:A\\; B\\, C\\\\D\\nE'` (on the wire: `A\; B\, C\\D\nE`).
- `puts the location in the ADR locality field` (4th of 7 components, as in the example above).
- `never contains a TEL line`.

`Contacts.test.tsx`:
- `shows name, headline, email, location, LinkedIn and GitHub from content`.
- `Copy email copies and confirms` — button `Copy email` → `copyText` value is the email; banner body `Email copied.`
- `Copy failure is reported, not hidden` — clipboard undefined → banner body `Couldn't copy email — select it and copy it manually.`
- `Download vCard creates a .vcf download` — spy `URL.createObjectURL` / `HTMLAnchorElement.prototype.click`; anchor `download` is `${profile.name}.vcf`.
- `Share is shown only when navigator.share exists` — absent → no `Share` button; present → click calls it with `{ title: profile.name, text: \`${profile.name} — ${profile.headline}\n${profile.email}\` }`; an `AbortError` rejection shows no banner.
- `Message opens Mail` — button `Message` dispatches `app.open` with `appId: 'mail'`.

- [ ] **Step 2: Run** `npx vitest run src/lib/vcard.test.ts src/apps/contacts` — FAIL.

- [ ] **Step 3: Implement**
- `buildVCard`: family name = last word of `name`, given = the rest; escape text values (not URLs); one `itemN.URL` + `itemN.X-ABLabel` pair per url.
- `downloadText`: Blob with `mime`, object URL, temporary `<a download>`, click, revoke.
- `Contacts.tsx` default export: card with initials avatar (or `profile.avatarUrl` when set), name (h2), headline; rows `email`, `LinkedIn`, `GitHub`, `location` (row label lower-case like macOS Contacts), each with a `Copy <label>` icon button; links open in a new tab; actions row: `Message`, `Download vCard`, `Share` (conditional). vCard urls = all `getContent().links`. Mime `text/vcard;charset=utf-8`.
- Registry: `id: 'contacts'`, `name: 'Contacts'`, `icon: { image: contactsIcon }`, `window: { defaultSize: { w: 480, h: 520 }, minSize: { w: 380, h: 420 }, resizable: true, singleInstance: true }`, `dock: { order: 2, group: 'apps' }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Contacts with copy, vCard download and share`

---

### Task 5: Calendar

**Files:**
- Create: `src/lib/calendar.ts`, `src/lib/calendar.test.ts`, `src/apps/calendar/Calendar.tsx`, `src/apps/calendar/Calendar.test.tsx`
- Modify: `src/content/types.ts`, `src/content/en/site.ts`, `src/content/content.test.ts`, `src/apps/registry.ts`

**Interfaces:**
- Produces: `monthGrid(year: number, month: number): (number | null)[][]` (month 0–11, weeks start Sunday, every row length 7); content `interface MeetingType { id: string; title: string; minutes: number; description: string; slug: string }`, `Site.scheduling: { calUrl?: string; meetingTypes: MeetingType[] }`.

- [ ] **Step 1: Write failing tests**

`calendar.test.ts`:
- `October 2026 starts on Thursday` — `monthGrid(2026, 9)[0]` → `[null, null, null, null, 1, 2, 3]`; 5 rows; last row `[25, 26, 27, 28, 29, 30, 31]`.
- `February 2026 fills exactly four rows` — 4 rows, first `[1..7]`, last ends with `28`.
- `pads the last row with null` — `monthGrid(2026, 10)` (November) last row `[29, 30, null, null, null, null, null]`.

`content.test.ts`: `meeting type ids are unique and slugs non-empty`.

`Calendar.test.tsx` (`vi.setSystemTime(new Date(2026, 11, 15))`):
- `shows the current month and marks today` — heading `December 2026`; cell `15` has `aria-current="date"`.
- `Next from December goes to January of the next year` → heading `January 2027`; no `aria-current` cell.
- `Today returns to the current month` → `December 2026`.
- `without calUrl offers email instead of booking` — text `Online booking isn't set up yet — email to arrange a time.`; button `Email Maksymilian` (first name from `profile.name`) dispatches `app.open` `mail`; no booking buttons.
- `with calUrl and meeting types, each type opens its Cal.com page` — mock `getContent` (vi.mock of `../../content` returning a copy with `calUrl: 'https://cal.com/maks'`, one type `{ slug: 'intro', title: 'Intro call', minutes: 30, … }`) → button `Intro call · 30 min` → `window.open('https://cal.com/maks/intro', '_blank', 'noopener,noreferrer')`.
- `with calUrl and no types, a single Book a call opens calUrl`.

- [ ] **Step 2: Run** `npx vitest run src/lib/calendar.test.ts src/content src/apps/calendar` — FAIL.

- [ ] **Step 3: Implement**
- Content: `meetingTypes: []` with `// TODO(content): meeting types (Cal.com event slugs)`.
- `Calendar.tsx`: state `{ year, month }` from `new Date()` at mount; header with month name (`Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })`) as `h2`, buttons `Previous month`, `Today`, `Next month`; `role="grid"` table with weekday column headers `Sun`…`Sat`; day cells are not interactive (no fake slots). Side panel "Meet Maksymilian" with the booking rules from the tests; URL join strips a trailing `/` from `calUrl`.
- Registry: `id: 'calendar'`, `name: 'Calendar'`, `icon: { image: calendarIcon }`, `window: { defaultSize: { w: 760, h: 540 }, minSize: { w: 560, h: 420 }, resizable: true, singleInstance: true }`, `dock: { order: 3, group: 'apps' }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Calendar with honest booking links`

---

### Task 6: Resume, print and Skip to Resume

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`, `src/apps/resume/ResumeDocument.tsx`, `src/apps/resume/Resume.tsx`, `src/apps/resume/Resume.test.tsx`, `src/apps/resume/menus.ts`
- Modify: `src/apps/registry.ts`, `src/styles/global.css`, `src/shells/desktop/DesktopShell.tsx`, `src/shells/desktop/DesktopShell.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `dispatch` (`app.open` for `mail`, `calendar`), registry ids from Tasks 3 and 5.
- Produces: `formatMonth(ym: string): string` (`'2025-10'` → `'Oct 2025'`), `formatRange(start: string, end?: string): string` (`'Oct 2025 – Present'`), `formatDate(iso: string): string` (`'2026-10-12T12:00:00Z'` → `'Oct 12, 2026'`, en-US, local time zone; used by Task 7); window command `resume.print`.

- [ ] **Step 1: Write failing tests**

`format.test.ts`: the three examples above, plus `formatRange('2024-07', '2025-09')` → `'Jul 2024 – Sep 2025'` (en dash with spaces).

`Resume.test.tsx`:
- `renders all sections in order` — headings `About`, `Experience`, `Skills`, `Education`, `Projects`, `Languages` appear in that DOM order; `h1` is `profile.name`.
- `experience shows role, company and date range` — first experience: text `formatRange(start, end)`.
- `Download PDF appears only when resume.pdfUrl is set` — default content → no `Download PDF`; mocked `pdfUrl: 'resume.pdf'` → link `Download PDF` with `href` `${import.meta.env.BASE_URL}resume.pdf` and `download` attribute; `https://…` URLs are used as-is.
- `Print calls window.print` — and dispatching `{ type: 'resume.print' }` while the window is focused also calls it.
- `Email opens Mail and Book a call opens Calendar` — dispatched `app.open` with `appId` `mail` / `calendar`.
- `LinkedIn and GitHub open in a new tab`.
- `renders a print-only copy into document.body` — `document.body.querySelector('.print-only h1')` text is `profile.name` while mounted; removed after unmount.

`DesktopShell.test.tsx`:
- `Skip to Resume is the first focusable element and opens Resume` — unlocked shell; first `Tab` focuses link `Skip to Resume`; Enter → a window with app id `resume` exists.

- [ ] **Step 2: Run** `npx vitest run src/lib/format.test.ts src/apps/resume src/shells/desktop/DesktopShell.test.tsx` — FAIL.

- [ ] **Step 3: Implement**
- `ResumeDocument` (pure, no hooks besides `getContent`): sections above; Skills lists each `SkillGroup` plus `softSkills`; Education with degree, range, location, notes, optional grade; Projects with summary, bullets, tech and links (new-tab anchors); Languages `name — level`.
- `Resume.tsx` default export: toolbar `role="toolbar"` `aria-label="Resume"` with `Download PDF` (conditional), `LinkedIn`, `GitHub`, `Email`, `Book a call`, `Print`; scrollable page (white paper, `max-w-[760px]`); `createPortal(<div className="print-only"><ResumeDocument /></div>, document.body)`; `useWindowCommands(windowId, { 'resume.print': () => window.print() })`.
- `menus.ts` `resumeMenus(ctx)`: File → `Print…` (`resume.print`), separator, `Close Window`.
- `global.css`: `.print-only { display: none }` and `@media print { #root { display: none !important } .print-only { display: block; color: #000; background: #fff } }`.
- Registry: `id: 'resume'`, `name: 'Resume'`, `icon: { image: previewIcon }`, `load`, `menus: resumeMenus`, `window: { defaultSize: { w: 780, h: 720 }, minSize: { w: 480, h: 400 }, resizable: true, singleInstance: true }`, `dock: { order: 2, group: 'system' }`.
- `DesktopShell`: first child `<a href="?app=resume">Skip to Resume</a>`, visually hidden until focused (`sr-only focus:not-sr-only` + fixed top-left glass pill above the menu bar z), `onClick` → `preventDefault`, `openApp('resume')`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Resume app with print and skip link`

---

### Task 7: Developer (GitHub repositories)

**Files:**
- Create: `src/lib/github.ts`, `src/lib/github.test.ts`, `src/apps/developer/Developer.tsx`, `src/apps/developer/Developer.test.tsx`
- Modify: `src/system/storage.ts` (`KEYS.github: 'bymaxos.github'`), `src/apps/registry.ts`

**Interfaces:**
- Consumes: `formatDate` (Task 6), `safeStorage`, `KEYS`.
- Produces:
  ```ts
  export interface Repo {
    name: string; description: string | null; url: string; homepage: string | null
    language: string | null; topics: string[]
    updatedAt?: string; stars?: number; forks?: number   // absent for saved (fallback) entries
  }
  export function githubUser(profileUrl: string): string | null
  export function fetchRepos(user: string, fetchFn?: typeof fetch): Promise<Repo[]>
  export function fetchLanguages(user: string, repo: string, fetchFn?: typeof fetch): Promise<Record<string, number>>
  export function fallbackRepos(projects: Project[]): Repo[]
  export function loadRepos(user: string, projects: Project[], fetchFn?: typeof fetch):
    Promise<{ repos: Repo[]; source: 'api' | 'cache' | 'fallback' }>
  ```

- [ ] **Step 1: Write failing tests**

`github.test.ts` (mock `fetchFn`, clear sessionStorage between tests):
- `githubUser parses the profile URL` — `'https://github.com/MaksymilianWojnowski'` → `'MaksymilianWojnowski'`; trailing slash ok; `'https://example.com/x'` → `null`.
- `fetchRepos requests the user's repos sorted by update` — URL `https://api.github.com/users/MaksymilianWojnowski/repos?sort=updated&per_page=100`, header `Accept: application/vnd.github+json`; maps `html_url`→`url`, `stargazers_count`→`stars`, `forks_count`→`forks`, `updated_at`→`updatedAt`; drops `fork: true` entries.
- `fetchRepos throws on a non-ok response` (status 403).
- `loadRepos caches the API result for the session` — second call does not call `fetchFn`, `source: 'cache'`.
- `loadRepos falls back to content projects when the API fails` — `source: 'fallback'`; repos are the projects with `links.repo`, `url = links.repo`, `homepage = links.demo ?? null`, `topics = tech`, and `stars`, `forks`, `updatedAt` are `undefined`.
- `a failed request is not cached` — after a fallback, next call hits `fetchFn` again.
- `fetchLanguages requests /repos/{user}/{repo}/languages`.

`Developer.test.tsx`:
- `shows a loading status, then the repository list` — `role="status"` `Loading repositories…`, then options named after repo names.
- `selecting a repo shows description, topics, language percentages and links` — languages `{ TypeScript: 75, CSS: 25 }` → `TypeScript 75%`, `CSS 25%`; link `View on GitHub ↗`; `Open demo ↗` only when `homepage`; `Updated Oct 12, 2026`.
- `fallback shows the note and no numbers` — text `GitHub is unreachable — showing a saved list.`; no `Updated`, no star/fork counts rendered.
- `language request failure hides the breakdown but keeps the primary language`.
- `empty API result shows No public repositories yet.`

- [ ] **Step 2: Run** `npx vitest run src/lib/github.test.ts src/apps/developer` — FAIL.

- [ ] **Step 3: Implement**
- Cache value `{ user, repos }` in `safeStorage` session under `KEYS.github`; languages cached in a module `Map` keyed by repo name.
- `Developer.tsx`: user from `githubUser` of the `github` link (no link → `Not configured yet`); two panes — left `role="listbox"` `aria-label="Repositories"` (name + primary language, keyboard ↑/↓ like Finder), right details; stars/forks shown only when defined (`★ 3 · 1 fork`). Fetch with an `AbortController` aborted on unmount.
- Registry: `id: 'developer'`, `name: 'Developer'`, `icon: { image: xcodeIcon }`, `window: { defaultSize: { w: 880, h: 560 }, minSize: { w: 560, h: 380 }, resizable: true, singleInstance: true }`, `dock: { order: 4, group: 'apps' }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Developer app backed by the GitHub API`

---

### Task 8: End-to-end coverage for Phase 3

**Files:**
- Create: `e2e/apps.spec.ts`, `e2e/fixtures/repos.json` (2 repos, one with `homepage`, one `fork: true`)
- Modify: `e2e/helpers.ts` only if a helper is shared by both specs

**Interfaces:**
- Consumes: `unlock`, `settle`, `openDock` from `e2e/helpers.ts`; every app above.

- [ ] **Step 1: Write the tests** (all `page.route('https://api.github.com/**', …)` stubbed — tests never hit the network)
- `Resume opens from the desktop icon and prints` — `addInitScript` replaces `window.print` with a counter; double-click `Resume.pdf` → window titled `Resume` shows `h1` with the profile name; click `Print` → counter 1.
- `Skip to Resume` — after unlock, `Tab` → link focused → Enter → Resume window.
- `Contacts downloads a vCard` — open from dock; `page.waitForEvent('download')` on `Download vCard`; `suggestedFilename()` is `Maksymilian Wojnowski.vcf`; content starts `BEGIN:VCARD` and has no `TEL`.
- `Mail validates, then hands off without claiming to send` — `addInitScript` stubs `window.open` to record calls; Send empty → both errors; fill Subject/Message → Send → recorded URL starts with `mailto:maksymilianwojnowski@gmail.com?subject=`; dialog `Finish in your email app` visible; banner text `nothing has been sent yet`.
- `Calendar shows the current month` — heading equals `new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())`.
- `Developer lists repos from the API and falls back when it fails` — fixture route → 1 repo (fork dropped), select → `View on GitHub ↗`; second test `route.abort()` → saved-list note.
- `Opening the same document twice keeps one window` — Finder → About Me → double-click `Hello.md` twice → exactly one dialog named `Hello.md`.
- `axe passes with Resume and Mail open` — light and dark (reuse the axe pattern in `e2e/desktop.spec.ts`).

- [ ] **Step 2: Run** `npm run e2e` — all pass (old 20 + new). Fix app code, not tests, when a test exposes a real bug.
- [ ] **Step 3: Gate + build** — `npm run typecheck && npm run lint && npm test && npm run build`; shell chunk still ≤ 150 KB gzip (apps are lazy chunks).
- [ ] **Step 4: Commit** `test: add e2e coverage for essential apps`
