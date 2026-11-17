# bymaxOS Phase 6c: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the open items the owner can't do himself, all from the 6b wrap-up:
- The About This Mac icon breaks the spec's "no Apple logo" rule.
- A lock-screen e2e test fails under load.
- The 6b reviews left deferred test gaps.

**Architecture:** No new modules.
- About This Mac becomes a glyph icon drawn with the existing custom "M" mark.
- The flaky test gets a root-cause fix, not a retry.
- The test gaps are closed in the existing test files.

**Tech Stack:** Vite, React 19, TS strict, Tailwind v4, Vitest + Testing Library, Playwright + axe. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-bymaxos-design.md`. The Icons row in §2 says "No Apple logo … The 'Apple menu' uses a custom 'M' mark."

## Global Constraints

- **Style.** Match the surrounding file. Most files use single quotes and no semicolons. `src/system/types.ts`, `wm.ts`, `storage.ts` and `settings.ts` use semicolons.
- **Icons.** Apple's own artwork comes from `scripts/export-apple-icons.swift`. Brand and system glyphs sit on a squircle. There is no Apple logo anywhere in the UI.
- **Nothing fabricated.** A value the browser does not report is not shown.
- **Contrast.** Text needs 4.5:1. Non-text elements need 3:1 against the adjacent colour.
- **Comments.** Explain only the why that the code cannot show, in one line.
- **Desktop rendering.** Changes only where a task names it.

## Review Focus

1. **The About This Mac icon renders wherever app icons render** (Spotlight results, App Switcher, Mission Control label), with no broken image. Pinned in Task 1.
2. **The lock-screen unlock test passes under parallel load.** It must be fixed at the cause, with no retries, no longer timeouts and no `test.slow`. Pinned in Task 2.
3. **An unknown `effectiveType` (e.g. `'constructor'`) shows no bars.** Pinned in Task 3.

---

### Task 1: About This Mac icon without the Apple logo

**Files:**
- Modify: `src/apps/registry.ts`. The `about` entry uses a glyph icon. Remove the `systemInfoIcon` import.
- Modify: `src/ui/SystemMark.tsx`. Export a decorative glyph component that `AppIconSpec`'s `glyph` type accepts, `ComponentType<{ className?: string; 'aria-hidden'?: boolean }>`, drawing the same "M" path. Keep `SystemMark` (`role="img"`, labelled) as it is.
- Delete: `src/assets/icons/system-information.png`. Remove its line from `scripts/export-apple-icons.swift`.
- Test: `src/apps/registry.test.ts`

**Look:** `background: 'linear-gradient(180deg, #4a4a4f 0%, #1d1d1f 100%)'`, `color: '#ffffff'`. This is a dark squircle in the system-utility style, with the white "M" mark.

- [ ] **Step 1: Write the failing test** in `registry.test.ts`: `'About This Mac uses the custom M mark, not Apple artwork'`. `getApp('about').icon` has a `glyph` and no `image`.
- [ ] **Step 2:** Run `npx vitest run src/apps/registry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the glyph component, the registry entry, and the deletions.
- [ ] **Step 4:** Run `npx vitest run`, `npm run typecheck` and `npm run lint`, then `npx playwright test e2e/desktop.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `fix: About This Mac uses the custom M mark instead of Apple's logo artwork`.

### Task 2: Lock-screen touch-unlock test is stable under load

**Files:**
- Investigate: `e2e/mobile.spec.ts:114` (`'a vertical touch drag from the clock unlocks'`), `e2e/helpers.ts` `touchDrag`, and `src/shells/mobile/LockScreen.tsx` (its touch handlers and `shouldUnlock` from `gestures.ts`).

**Observed:**
- In a full parallel run (load average ~17) it failed once: `getByText('Swipe up to unlock')` was still visible after the drag.
- It passes 5/5 when run alone.

**Method:** Use superpowers:systematic-debugging.
1. Reproduce under load, e.g. `npx playwright test e2e/mobile.spec.ts -g "vertical touch drag from the clock" --repeat-each=40 --workers=8`.
2. Name the cause before changing anything. Candidates to check:
   - the clock's box is read before layout or the entry animation settles;
   - touch handlers are attached after first paint;
   - the unlock depends on velocity or time, and CDP events under load arrive too slowly or too fast.
3. If the app's gesture logic is time-sensitive in a way a slow real phone would also hit, fix the app. Otherwise fix the test, for example by waiting for the condition that makes the drag valid.

- [ ] **Step 1:** Reproduce and record the failure rate.
- [ ] **Step 2:** State the root cause with evidence: a log, a timing, or a code line.
- [ ] **Step 3:** Fix. If the fix is in app code, first add a unit test in `gestures.test.ts` or `LockScreen.test.tsx` that fails for the cause.
- [ ] **Step 4:** Re-run the reproduction command. Expected: 40/40.
- [ ] **Step 5: Commit** `fix: <cause in a few words>`. Use `test:` instead if the fix is test-only.

### Task 3: Deferred test gaps and small robustness fixes

**Files:**
- Modify: `src/shells/desktop/statusHooks.ts:66-77`. Look up `BARS` with `Object.hasOwn(BARS, type)`, so prototype keys such as `'constructor'` give null.
- Test: `src/shells/desktop/statusHooks.test.ts`
  - `'useNetwork updates on the change event'`: change `effectiveType` from `'4g'` to `'2g'`, fire `change`, and bars become 2.
  - `'useNetwork removes its listener on unmount'`
  - `'useNetwork is null for an unmapped effectiveType'`: test `'5g'` and `'constructor'`.
- Test: `src/shells/mobile/StatusBar.test.tsx`
  - `'the battery name says charging'`: the name is `Battery 82%, charging`.
  - `'the battery fill is green while charging and red under 20%'`: the fill `rect` has `#34c759`, then `#ff3b30` at level 0.15 when not charging.
- Test: `src/ui/CalendarIcon.test.tsx`
  - `'light colours and decorative image'`: the decoded src has `#ffffff`, `#1d1d1f` and `#ff3b30`. The img has `alt=""` and `aria-hidden="true"`.
  - The dark test also asserts that the date fill is `#ffffff`.
  - The day matches become anchored, e.g. `>7</text>` instead of `>7<`.
- Modify: `src/shells/desktop/Window.tsx:52`. Move the comment `// A minimized window's focus goes to …` down so it sits directly above `handOffFocus`.

- [ ] **Step 1:** Write the new tests. The `'constructor'` case should FAIL before the `Object.hasOwn` change. The others are coverage for existing behaviour and may pass at once; say so in the report.
- [ ] **Step 2:** Run `npx vitest run src/shells src/ui`. Record which tests failed.
- [ ] **Step 3:** Apply the `Object.hasOwn` change and move the comment.
- [ ] **Step 4:** Run `npx vitest run`, `npm run typecheck` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `test: close the deferred 6b test gaps`.

### Finish

Regenerate screenshots only if Task 1 changed a captured screen, for example the Spotlight results. Use `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts` and commit them as `docs: regenerate screenshots for phase 6c`.

---

## Out of scope

- Owner content (§11), the public deploy and the custom domain.
- The real-iPhone check, the genie on real hardware, and dark phone icons.
