# bymaxOS Phase 4b (More Apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six more working apps — Terminal, Notes, Safari, Photos, Music and Maps — completing the spec's desktop app list.

**Architecture:** Second half of spec phase 4 (4a delivered the system layer). Each app is a lazy chunk in `src/apps/<app>/`, registered in `src/apps/registry.ts`, with pure logic (terminal parser, notes merging, URL rules, map projection) in sibling `.ts` files under unit test. New personal data (notes, music, places, photos, bookmarks) is typed in `src/content/` and seeded only from the CV or left empty with `TODO(content)`; every app renders an honest empty state.

**Tech Stack:** Existing stack. Dev-only additions for Task 7: `world-atlas`, `topojson-client`, `d3-geo` (used by a one-off generator script; nothing ships at runtime).

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md` (§3.2 content, §3.7 persistence, §4.7 Spotlight notes, §5 rows Safari/Photos/Notes/Music/Maps/Terminal, §7). Previous plans: `docs/superpowers/plans/2026-10-27-bymaxos-phase-4a-system-overlays.md` (conventions, overlay/Spotlight interfaces).

## Global Constraints

- All earlier Global Constraints apply (content only via `getContent()`; storage only via `safeStorage` with shape validation on read; no dead menu items; icon-only buttons have `aria-label`; match file style, never Prettier whole files; gate `npm run typecheck && npm run lint && npm test` before each commit; commit trailer = the attribution line the implementer's harness specifies).
- Never fabricate: no fake playback, no fake photos, no fake page loads, no invented dates or places. Unknown content → empty array with `// TODO(content): …` and an honest empty state.
- AA contrast in light and dark: text ≥ 4.5:1, focus rings and non-text state ≥ 3:1. Text on glass sits on an opaque `var(--window-bg)` surface. In-window focus rings use `ring-accent-link`; filled accent backgrounds with white text use `bg-accent-strong`.
- Icons already exported: `src/assets/icons/{safari,photos,notes,music,maps,terminal}.png`. Do not re-run the export script.
- External links open with `window.open(url, '_blank', 'noopener,noreferrer')`. Embedded third-party content (iframes) loads only after an explicit click, except Safari's `embeddable: true` bookmarks.
- Deep links pass `?app=<id>&item=<id>` as props `{ item }`; apps that select something by id read `props.item`.
- Dock order after this phase (apps group): Safari 1 · Mail 2 · Contacts 3 · Calendar 4 · Notes 5 · Photos 6 · Music 7 · Maps 8 · Developer 9 · Terminal 10 · System Settings 11.

## Review Focus

1. **Notes storage from an older build or another tab** (malformed JSON shape, an edit for a note that no longer exists, a deleted id that is a seed note) → app loads; bad entries are dropped; seed notes still show. Pinned by `parseStoredNotes` / `mergeNotes` tests (Task 3).
2. **Terminal input with odd spacing and case** (`  LS  `, `cd ..` at root, `cd "Work"`, `open mail`, an empty line, a 500-char line) → trimmed, case-insensitive commands, no throw, root stays root. Pinned by `runCommand` tests (Task 2).
3. **Safari address bar input that is not a URL** (`linkedin`, `javascript:alert(1)`, `ftp://x`, `  https://x.com  `) → only `http(s)` URLs are accepted; others show the inline error; nothing is navigated or embedded. Pinned by `parseAddress` tests (Task 4).
4. **Lightbox at the ends of an album / album with one photo** → arrows disabled at the ends (no wrap), Esc closes and returns focus to the thumbnail. Pinned by Photos tests (Task 5).
5. **Music/Maps/Photos with empty content** (the shipped state) → each shows its exact empty-state copy, no broken controls. Pinned in each app's tests (Tasks 5–7).

---

## File Structure

```
src/content/types.ts, en/{notes,music,places,photos,bookmarks}.ts, index.ts, content.test.ts
src/system/storage.ts                 + KEYS.notes
src/system/search.ts                  + notes indexed (kind 'note')
src/system/vfs.ts                     + image files in Photos folder (FileType 'image')
src/ui/fileIcon.tsx                   image nodes use their own src as icon
src/apps/terminal/{commands.ts,Terminal.tsx}
src/apps/notes/{notesState.ts,Notes.tsx,menus.ts}
src/apps/safari/{address.ts,Safari.tsx}
src/apps/photos/Photos.tsx
src/apps/music/Music.tsx
src/apps/maps/{project.ts,worldPath.ts (generated),Maps.tsx}
scripts/build-world-map.mjs
e2e/more-apps.spec.ts
```

---

### Task 1: Content for the new apps and dock order

**Files:**
- Create: `src/content/en/notes.ts`, `src/content/en/music.ts`, `src/content/en/places.ts`, `src/content/en/photos.ts`, `src/content/en/bookmarks.ts`
- Modify: `src/content/types.ts`, `src/content/index.ts`, `src/content/content.test.ts`, `src/apps/registry.ts` (renumber dock orders), `src/apps/registry.test.ts`, `src/shells/desktop/Dock.test.tsx`

**Interfaces:**
- Produces (in `src/content/types.ts`, added to `Content`):
  ```ts
  interface Note { id: string; folder: string; title: string; body: string; updated?: string /* YYYY-MM-DD */ }
  interface MusicArtist { id: string; name: string; url?: string }
  interface MusicAlbum { id: string; title: string; artist: string; year?: number; url?: string }
  interface MusicPlaylist { id: string; title: string; description?: string; spotifyId?: string; spotifyUrl?: string; appleMusicUrl?: string }
  interface Place { id: string; name: string; country: string; lat: number; lon: number; from?: string; to?: string; note: string }
  interface Photo { id: string; src: string; alt: string; width: number; height: number; caption?: string }
  interface PhotoAlbum { id: string; title: string; photos: Photo[] }
  interface Bookmark { id: string; title: string; url: string; embeddable: boolean }
  // Content gains: notes: Note[]; music: { artists: MusicArtist[]; albums: MusicAlbum[]; playlists: MusicPlaylist[] };
  //                places: Place[]; photoAlbums: PhotoAlbum[]; bookmarks: Bookmark[]
  ```

- [ ] **Step 1: Write failing tests** (`content.test.ts`)
- `ids are unique within notes, places, bookmarks, albums and photos (across albums)`.
- `bookmarks and music URLs are https; spotifyId matches /^[A-Za-z0-9]{22}$/ when set`.
- `places have lat in [-90, 90] and lon in [-180, 180]; from/to match YYYY-MM when set`.
- `photos have non-empty alt and positive width/height`.
- `seed: notes has the two CV-derived notes, places has Wrocław and Tokyo, music and photoAlbums are empty` (the honest shipped state).
- `registry.test.ts` / `Dock.test.tsx`: expected apps-group order becomes Mail 2, Contacts 3, Calendar 4, Developer 9, System Settings 11 (later tasks insert the rest).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Notes seed (folder `Notes`), exact copy:
  1. `{ id: 'working-style', title: 'Working style', body: <'# Working style' + blank line + one '- ' line per content.softSkills entry> }`
  2. `{ id: 'looking-for', title: "What I'm looking for", body: <'# What I\'m looking for' + blank line + profile.lookingFor> }`
  Build both bodies from `softSkills` / `profile` imports (no duplicated text). `// TODO(content): add personal notes`.
- Places seed: `{ id: 'wroclaw', name: 'Wrocław', country: 'Poland', lat: 51.1079, lon: 17.0385, note: 'Home base — studies at WUST and work.' }`, `{ id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, from: '2025-03', to: '2025-08', note: 'Exchange semester at Shibaura Institute of Technology.' }`. `// TODO(content): travel places and memories`.
- Bookmarks seed: one entry per `content.links` (`embeddable: false`) plus one per project link (`repo`/`demo`/`info`, title `${project.title} — ${Repository|Demo|Info}`, `embeddable: false`). `// TODO(content): mark sites that allow framing as embeddable`.
- `music = { artists: [], albums: [], playlists: [] }`, `photoAlbums = []`, each with `// TODO(content)`.
- Registry: renumber the existing apps-group orders as above.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add content for notes, music, places, photos and bookmarks`

---

### Task 2: Terminal

**Files:**
- Create: `src/apps/terminal/commands.ts`, `src/apps/terminal/commands.test.ts`, `src/apps/terminal/Terminal.tsx`, `src/apps/terminal/Terminal.test.tsx`
- Modify: `src/apps/registry.ts` (+tests)

**Interfaces:**
- Produces:
  ```ts
  export interface TerminalContext { cwd: string /* VFS folder id, 'root' = ~ */; history: string[] }
  export interface TerminalResult { lines: string[]; cwd?: string; clear?: true; open?: Command }
  export function runCommand(input: string, ctx: TerminalContext): TerminalResult
  export function complete(input: string, ctx: TerminalContext): string   // returns the completed input (unchanged if 0 or >1 matches)
  export function promptFor(cwd: string): string   // 'maks@bymaxos ~ %' at root, 'maks@bymaxos Work %' in a folder
  ```

- [ ] **Step 1: Write failing tests** (`commands.test.ts`, real content + VFS)
- `help lists every command`: `help, whoami, about, experience, projects, skills, contact, resume, open <app>, ls, cd, cat, neofetch, clear, history, sudo`.
- `whoami → [profile.name]`; `about → profile.headline and summary`; `experience → one line per entry "role — company (formatRange)"`; `projects → one line per project title`; `skills → one line per group "label: items joined by ', '"`; `contact → email, LinkedIn URL, GitHub URL` (no phone).
- `resume → { open: { type: 'dock.activate', appId: 'resume' }, lines: ['Opening Resume…'] }`; `open mail` / `open Mail` → dock.activate `mail`; `open nope → ['open: no app or file named nope']`; `open Hello.md` from `cd about` → the node's open command (`app.open` textedit `{ fileId: 'doc-hello' }`).
- `ls at ~ lists the root folder names`; `cd work` then `ls` lists work files; `cd ..` returns to root; `cd ..` at root stays root; `cd ~` → root; `cd nope → ['cd: no such folder: nope']`; `cd Hello.md → ['cd: not a folder: Hello.md']`.
- `cat Hello.md (in about) prints the preview body lines`; `cat Resume.pdf → ['cat: Resume.pdf: binary file — try: open Resume.pdf']`.
- `neofetch prints lines starting with "OS: bymaxOS", "Kernel: React", "Shell: bymaxsh", "Apps: <n>"` and no CPU/GPU/Memory lines.
- `clear → { lines: [], clear: true }`; `history → numbered ctx.history`; `sudo anything → ['maks is not in the sudoers file. This incident will be reported.']`.
- `unknown → ['bymaxsh: command not found: foo']`; `empty or whitespace-only input → { lines: [] }`; `case-insensitive and trimmed ('  LS  ')`; `a 500-char line does not throw`.
- `complete('ne') → 'neofetch'`; `complete('cd wo') at root → 'cd Work'`; `complete('c') → 'c'` (ambiguous).
- `promptFor('root') === 'maks@bymaxos ~ %'`, `promptFor('work') === 'maks@bymaxos Work %'`.

`Terminal.test.tsx`:
- `shows a welcome line and the prompt; typing a command and Enter prints the output under the echoed command`.
- `↑/↓ walk the history`; `Tab completes`; `clear empties the screen`; `open mail dispatches dock.activate` (spy `dispatch`).
- `the input has an accessible name "Terminal input" and the output is a log region (role="log")`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Pure parser over `vfs` (`src/apps/finder/vfsInstance.ts`); folder lookup by case-insensitive name among the cwd's children; the rest of the line after the command is the argument (spaces allowed, surrounding quotes stripped). Apps for `open` = the Spotlight app set (`buildIndex` app items) matched by id or name, case-insensitive.
- UI: black window body (`bg-[#1e1e1e]` in both themes), SF Mono / `ui-monospace` 13px, light text `#e5e5e5` (≥ 12:1); welcome line `Last login: <local date/time> on bymaxsh — type help`; input inline after the prompt; scroll to bottom on output; Ctrl+L clears.
- Registry: `{ id: 'terminal', name: 'Terminal', icon: { image: terminalIcon }, window: { defaultSize: { w: 680, h: 440 }, minSize: { w: 420, h: 260 }, resizable: true, singleInstance: false }, dock: { order: 10, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Terminal`

---

### Task 3: Notes

**Files:**
- Create: `src/apps/notes/notesState.ts`, `src/apps/notes/notesState.test.ts`, `src/apps/notes/Notes.tsx`, `src/apps/notes/Notes.test.tsx`, `src/apps/notes/menus.ts`
- Modify: `src/system/storage.ts` (`KEYS.notes: 'bymaxos.notes'`), `src/system/search.ts` (+test), `src/apps/registry.ts` (+tests)

**Interfaces:**
- Produces:
  ```ts
  export interface StoredNotes { edits: Record<string, { title: string; body: string; updated: string }>; added: Note[]; deleted: string[] }
  export function parseStoredNotes(raw: unknown): StoredNotes        // drops anything malformed
  export function mergeNotes(seed: Note[], stored: StoredNotes): (Note & { local: boolean })[]  // newest first
  ```
  Search kind `'note'`, command `{ type: 'app.open', appId: 'notes', props: { item: noteId } }`.

- [ ] **Step 1: Write failing tests**
- `notesState.test.ts`: `parseStoredNotes` returns empty defaults for `null`, `'x'`, `{ edits: 5 }`, and drops added notes missing string id/title/body; `mergeNotes` applies edits to seed notes (marks `local: true`), appends added notes, hides deleted ids, ignores edits for unknown ids; order = `updated` desc, seed notes without `updated` last in seed order.
- `search.test.ts`: `seed notes are indexed as kind note opening Notes at that note`.
- `Notes.test.tsx` (localStorage cleared):
  - `three panes: folders (Notes), list, editor; the first note is selected; props.item selects that note`.
  - `editing the title/body persists under KEYS.notes and survives remount; the footer reads "Your edits stay on this device."`.
  - `New Note (toolbar button and File > New Note) adds an empty "New Note" at the top and focuses its body`.
  - `Delete removes a visitor note; on a seed note it hides it` (button `Delete note`).
  - `Restore originals asks for confirmation in a Sheet, then clears KEYS.notes and shows the seed notes unchanged`.
  - `Edit > Copy copies the editor selection via copyText (banner on failure); Edit > Select All selects the body`; `Edit > Paste inserts navigator.clipboard.readText() at the caret, or shows the banner "Paste isn't available here — use ⌘V." when readText is missing or rejects`.
  - `search filters the list by title/body (case-insensitive)`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Store edits on every change (debounce not required); `updated` = today `YYYY-MM-DD` for edits/adds.
- Window commands (registered with `useWindowCommands`): `notes.newNote`, `edit.copy`, `edit.paste`, `edit.selectAll`; menus: File (New Note, Close Window), Edit (Copy, Paste, Select All — undo/redo stay disabled).
- Layout: folders 160px (`Notes` + count), list 240px (title semibold + first body line + date in `text-text-2`), editor = title input + body textarea, all on `var(--window-bg)`; footer `Your edits stay on this device.` with a `Restore originals` text button. Selected list row `bg-accent-strong text-white`.
- Registry: `{ id: 'notes', name: 'Notes', icon: { image: notesIcon }, menus: notesMenus, window: { defaultSize: { w: 860, h: 560 }, minSize: { w: 600, h: 360 }, resizable: true, singleInstance: true }, dock: { order: 5, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Notes with local edits`

---

### Task 4: Safari

**Files:**
- Create: `src/apps/safari/address.ts`, `src/apps/safari/address.test.ts`, `src/apps/safari/Safari.tsx`, `src/apps/safari/Safari.test.tsx`
- Modify: `src/apps/registry.ts` (+tests), `src/apps/quicklook/QuickLook.test.tsx` (the footer test must use a node whose app is not registered — build a synthetic node), `e2e/desktop.spec.ts` only if a test assumed `.webloc` opens Quick Look on double-click

**Interfaces:**
- Produces: `parseAddress(input: string): { ok: true; url: string } | { ok: false; error: string }`; Safari props `{ url?: string }`.

- [ ] **Step 1: Write failing tests**
- `address.test.ts`: `'  https://x.com  '` → ok `https://x.com/`; `http://a.b/c?d` ok; `linkedin`, `javascript:alert(1)`, `ftp://x`, `''` → `{ ok: false, error: 'Enter a web address starting with https://' }`.
- `Safari.test.tsx` (spy `window.open`):
  - `opens on a Favorites start page listing every bookmark as a tile`.
  - `a non-embeddable bookmark shows "This site can't be shown inside bymaxOS" with an "Open in new tab ↗" button that opens it, and never renders an iframe`.
  - `an embeddable bookmark (mocked content) renders an iframe with title = bookmark title and sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`.
  - `props.url opens directly in the first tab` (`.webloc` path); an unknown URL is treated as non-embeddable.
  - `address bar: invalid input shows the error and changes nothing; a valid URL shows the can't-be-shown card`.
  - `tabs: + opens a Favorites tab and selects it; ✕ closes a tab; the last tab cannot be closed (button disabled)`; tab buttons are `role="tab"` in a `role="tablist"`.
  - `the bookmarks bar shows bookmark titles; clicking navigates the current tab`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Tab state `{ id; url: string | null }` (null = Favorites); title = bookmark title or hostname. A URL is embeddable only if it matches a bookmark with `embeddable: true` (exact URL or same origin).
- Toolbar: back/forward are not provided (no history beyond tabs); address field `aria-label="Address"`; reload button only when an iframe is shown.
- Registry: `{ id: 'safari', name: 'Safari', icon: { image: safariIcon }, window: { defaultSize: { w: 960, h: 620 }, minSize: { w: 520, h: 360 }, resizable: true, singleInstance: false }, dock: { order: 1, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Safari with honest embedding`

---

### Task 5: Photos (+ Finder images)

**Files:**
- Create: `src/apps/photos/Photos.tsx`, `src/apps/photos/Photos.test.tsx`
- Modify: `src/system/vfs.ts` (+test), `src/ui/fileIcon.tsx`, `src/apps/finder/Finder.tsx` (`KIND` map), `src/apps/registry.ts` (+tests)

**Interfaces:**
- Produces: `FileType` gains `'image'`; image nodes `{ id: 'photo-<id>', name: '<caption or alt>.jpg', fileType: 'image', open: { appId: 'photos', props: { item: photoId } }, preview: { kind: 'text', title: name, body: alt } }`; the Photos folder lists every photo (placeholder copy unchanged when there are none); `iconFor` returns the photo `src` for image nodes.

- [ ] **Step 1: Write failing tests**
- `vfs.test.ts` (mocked content with one album/two photos): `Photos folder lists image nodes opening Photos at that photo`; `with no photos the folder keeps its placeholder`.
- `Photos.test.tsx`:
  - `empty content shows "Photos will appear here once they're added."` (exact copy) and no grid.
  - (mocked content, album A with 3 photos, album B with 1) `sidebar lists All Photos and each album; the grid shows lazy images (loading="lazy") with alt text`.
  - `clicking a thumbnail opens a lightbox dialog named by the photo alt; ←/→ move; Previous is disabled on the first photo and Next on the last; Escape closes and focus returns to the thumbnail`.
  - `a horizontal swipe (pointerdown → pointerup with dx > 50) moves to the next photo`.
  - `props.item opens the lightbox on that photo`.
- Photo `src` that is not absolute is resolved with `import.meta.env.BASE_URL`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Grid `grid-cols-[repeat(auto-fill,minmax(140px,1fr))]`, square `object-cover` tiles; lightbox inside the window (absolute inset-0, `bg-black/90`, image `object-contain`, caption below in white 13px), buttons `Previous photo` / `Next photo` / `Close` with `ring-white` focus rings. Lightbox handles Escape itself (the global `overlay.close` is disabled when no overlay is open, so the key reaches it).
- Finder `KIND.image = 'Image'`; `fileIcon.tsx` `FILE_ICON.image` = the generic document icon (fallback), while `iconFor` returns the photo's own resolved `src` for image nodes.
- Registry: `{ id: 'photos', name: 'Photos', icon: { image: photosIcon }, window: { defaultSize: { w: 900, h: 600 }, minSize: { w: 520, h: 360 }, resizable: true, singleInstance: true }, dock: { order: 6, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Photos with lightbox`

---

### Task 6: Music

**Files:**
- Create: `src/apps/music/Music.tsx`, `src/apps/music/Music.test.tsx`
- Modify: `src/apps/registry.ts` (+tests)

- [ ] **Step 1: Write failing tests**
- `empty content shows "Music isn't configured yet." and no player`.
- (mocked content: 2 artists, 1 album, 2 playlists, one with `spotifyId`) `sidebar sections Playlists, Artists, Albums list the items`.
- `a playlist with links shows "Open in Spotify ↗" / "Open in Apple Music ↗" buttons for the URLs that are set`.
- `a playlist with spotifyId shows "Load Spotify player" and no iframe until clicked; after the click an iframe with src https://open.spotify.com/embed/playlist/<id> and title "Spotify player — <playlist title>" appears`.
- `nothing renders a play button, progress bar or "Now Playing" text` (query by role/text).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Two panes like Music.app: sidebar (section headings `Playlists`, `Artists`, `Albums`) and a detail pane; empty sections are omitted. The iframe uses `loading="lazy"` and `allow="encrypted-media"`.
- Registry: `{ id: 'music', name: 'Music', icon: { image: musicIcon }, window: { defaultSize: { w: 860, h: 560 }, minSize: { w: 560, h: 360 }, resizable: true, singleInstance: true }, dock: { order: 7, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate.
- [ ] **Step 5: Commit** `feat: add Music without fake playback`

---

### Task 7: Maps

**Files:**
- Create: `scripts/build-world-map.mjs`, `src/apps/maps/worldPath.ts` (generated, committed), `src/apps/maps/project.ts`, `src/apps/maps/project.test.ts`, `src/apps/maps/Maps.tsx`, `src/apps/maps/Maps.test.tsx`
- Modify: `package.json` (devDependencies `world-atlas`, `topojson-client`, `d3-geo` + `"build:map": "node scripts/build-world-map.mjs"`), `src/apps/registry.ts` (+tests)

**Interfaces:**
- Produces: `MAP_W = 1000`, `MAP_H = 500`, `WORLD_PATH: string` (in `worldPath.ts`, header comment "Generated by scripts/build-world-map.mjs from Natural Earth 110m land (world-atlas) — do not edit"); `project(lat: number, lon: number): { x: number; y: number }` (equirectangular onto 1000×500).

- [ ] **Step 1: Write failing tests**
- `project.test.ts`: `project(0, 0) → { x: 500, y: 250 }`; `project(90, -180) → { x: 0, y: 0 }`; `project(-90, 180) → { x: 1000, y: 500 }`; `project(51.1079, 17.0385)` ≈ `{ x: 547.33, y: 108.03 }` (2 decimals).
- `worldPath` sanity: `WORLD_PATH` starts with `M` and is longer than 1000 chars.
- `Maps.test.tsx`:
  - `renders an svg map (role="img", name "World map") with one pin button per place, named by place name`.
  - `the timeline lists places newest first by from (undated last), each with formatRange(from, to) when dated`.
  - `selecting a pin selects its timeline entry and shows a detail card (name, country, dates, note), and vice versa`.
  - `props.item selects that place`; `with no places shows "No places yet."`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**
- Generator: load `world-atlas/land-110m.json`, `topojson-client.feature(topo, topo.objects.land)`, `d3-geo` `geoEquirectangular().scale(MAP_W / (2 * Math.PI)).translate([MAP_W / 2, MAP_H / 2])`, `geoPath(projection)(feature)`; round coordinates to 1 decimal; write `worldPath.ts`. Run it once and commit the output. `project()` must use the same formula so pins align.
- UI: map pane (svg `viewBox="0 0 1000 500"`, ocean `#a9cfe8` light / `#1c2a3a` dark, land `#e6e2d6` light / `#3a3f45` dark), pins = 24px buttons (red dot with white border, `ring-accent-link` focus), timeline sidebar 240px on `var(--window-bg)`; selected entry `bg-accent-strong text-white`.
- Registry: `{ id: 'maps', name: 'Maps', icon: { image: mapsIcon }, window: { defaultSize: { w: 960, h: 600 }, minSize: { w: 600, h: 380 }, resizable: true, singleInstance: true }, dock: { order: 8, group: 'apps' } }`.

- [ ] **Step 4: Run** — PASS; gate; `npm run build` (Maps stays a lazy chunk; shell ≤ 150 KB gzip).
- [ ] **Step 5: Commit** `feat: add Maps with travel timeline`

---

### Task 8: End-to-end coverage for Phase 4b

**Files:**
- Create: `e2e/more-apps.spec.ts`

- [ ] **Step 1: Write the tests** (abort `https://api.github.com/**` and `https://open.spotify.com/**` in `beforeEach`)
- `Terminal: help lists commands; cd work + ls lists work files; open mail opens Mail`.
- `Notes: an edit survives a reload; Restore originals brings back the seed note`.
- `Notes are searchable in Spotlight` (⌘K, type `working`, Enter → Notes window shows `Working style`).
- `Safari: a .webloc from Finder › Projects opens Safari with the can't-be-shown card and an Open in new tab button`.
- `Photos, Music and Maps open from the dock and show their shipped empty states / pins` (Maps shows pins `Wrocław` and `Tokyo`; selecting `Tokyo` shows its note).
- `axe passes with Terminal, Notes, Safari and Maps open — light and dark`.

- [ ] **Step 2: Run** `npm run e2e` — all pass (41 existing + new). Fix app code, not tests, for real bugs.
- [ ] **Step 3: Gate + build** — `npm run typecheck && npm run lint && npm test && npm run build`.
- [ ] **Step 4: Commit** `test: add e2e coverage for Terminal, Notes, Safari, Photos, Music and Maps`
