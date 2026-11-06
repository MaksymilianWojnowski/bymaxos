import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Opens the site, unlocks the login screen with Enter and waits for the desktop menu bar.
export async function unlock(page: Page): Promise<void> {
  await page.goto('/')
  const gate = page.getByRole('button', { name: 'Unlock' })
  await gate.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menubar')).toBeVisible()
}

// Opens the phone shell at `path` and swipes up on the lock screen; the Unlock button is the fallback if the swipe misses.
export async function unlockMobile(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page.getByText('Swipe up to unlock')).toBeVisible()
  // Starts 64px above the bottom edge, clear of the Unlock button; ends at y=300 on a portrait phone.
  const height = page.viewportSize()?.height ?? 844
  await page.mouse.move(60, height - 64)
  await page.mouse.down()
  await page.mouse.move(60, Math.min(300, Math.round(height * 0.36)), { steps: 20 })
  await page.mouse.up()
  // A deep link lands in its app rather than home, so the check is that the lock screen is gone.
  const hint = page.getByText('Swipe up to unlock')
  if (!(await hint.waitFor({ state: 'hidden', timeout: 1000 }).then(() => true, () => false))) {
    await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  }
  await expect(hint).toBeHidden()
}

// Window open and minimize animations move the box; wait for them before measuring.
export async function settle(locator: Locator): Promise<void> {
  await locator.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
}

export async function openDock(page: Page, name: string): Promise<void> {
  await page.getByRole('toolbar', { name: 'Dock' }).getByRole('button', { name }).click()
}

// Drags from the centre of an element by (dx, dy) in steps, as a user would.
export async function dragBy(page: Page, from: Locator, dx: number, dy: number): Promise<void> {
  const box = await from.boundingBox()
  if (!box) throw new Error('drag source has no box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 10 })
  await page.mouse.up()
}

// A real touch drag over CDP. Touch-action decides whether the browser keeps the pointer or scrolls, which mouse events never exercise.
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await cdp.detach()
  }
}

// The centre of an element's box, for aiming a touch drag.
export async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Serious and critical axe results, as "rule: selectors" strings for readable failures.
export async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

// The app screen fades in over 220ms, and a scan mid-fade reads the text as low contrast. Infinite animations (the lock chevron) never finish, so they are skipped.
export const settleAnimations = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )

export type PhoneAudit = { smallTargets: string[]; overflowing: string[] }

// Layout checks for a phone state: touch targets under 44px and anything past the viewport's right edge.
export async function phoneAudit(page: Page): Promise<PhoneAudit> {
  // Sizes read mid scale-in are off by a fraction of a pixel, so wait for the screen to settle.
  await settleAnimations(page)
  return page.evaluate(() => {
    // The accessible name when it is easy to read (aria-label, else trimmed text), cut to 40 characters, else the tag.
    const describe = (el: Element) => {
      const label = (el.getAttribute('aria-label')?.trim() || (el.textContent ?? '').trim()).slice(0, 40)
      return label ? `${el.tagName.toLowerCase()} "${label}"` : el.tagName.toLowerCase()
    }
    const targets = 'button, a[href], input, select, textarea, [role=option], [role=tab], [role=radio], [role=switch]'
    const smallTargets: string[] = []
    for (const el of document.querySelectorAll(targets)) {
      // Kept-mounted apps behind the active one are inert and invisible, so they are not on screen.
      if (el.matches('article a') || el.getClientRects().length === 0) continue
      if (el.closest('[inert]') || getComputedStyle(el).visibility === 'hidden') continue
      const box = el.getBoundingClientRect()
      if (box.width < 44 || box.height < 44) {
        smallTargets.push(`${describe(el)} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`)
      }
    }
    const overflowing: string[] = []
    const width = window.innerWidth
    for (const el of document.querySelectorAll('body *')) {
      if (el.getClientRects().length === 0 || el.closest('[inert]')) continue
      if (el.getBoundingClientRect().right <= width + 1) continue
      let scroller = el.parentElement
      while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement
      if (!scroller) overflowing.push(describe(el))
    }
    if (document.documentElement.scrollWidth > width) {
      overflowing.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${width}`)
    }
    return { smallTargets, overflowing }
  })
}

// One window at a time: a covered window gets "incomplete" contrast results instead of violations, so it would pass silently.
// `prepare` runs once the window is open, to reach a state worth scanning (e.g. a selected item).
export async function scanWindow(page: Page, name: string, prepare?: (win: Locator) => Promise<void>): Promise<void> {
  await openDock(page, name)
  const win = page.getByRole('dialog', { name, exact: true })
  await expect(win).toBeVisible()
  await prepare?.(win)
  await settle(win)
  const results = await new AxeBuilder({ page }).analyze()
  expect(await seriousViolations(page), `${name} violations`).toEqual([])
  // Only contrast results inside this window count; the desktop chrome behind it is other windows' business.
  const unchecked = results.incomplete
    .filter((v) => v.id === 'color-contrast')
    .flatMap((v) => v.nodes.map((n) => n.target.join(' ')))
  const insideWindow = await win.evaluate(
    (el, selectors) =>
      selectors.filter((s) => {
        const node = document.querySelector(s)
        return node !== null && el.contains(node)
      }),
    unchecked,
  )
  expect(insideWindow, `${name} unchecked contrast`).toEqual([])
  await win.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(win).toBeHidden()
}

type Rgba = [number, number, number, number]

// Parses a computed colour: rgb()/rgba(), or oklab()/oklch() which Tailwind's palette and colour-mix produce. Returns 0-255 sRGB and alpha 0-1.
export function parseRgba(css: string): Rgba {
  const m = css.match(/(rgba?|oklab|oklch)\(([^)]+)\)/)
  if (!m) throw new Error(`not a colour: ${css}`)
  const parts = m[2].split(/[\s,/]+/).filter(Boolean)
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : Number(parts[3])
  if (m[1].startsWith('rgb')) return [Number(parts[0]), Number(parts[1]), Number(parts[2]), alpha]
  const num = (v: string, scale: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * scale : Number(v))
  const L = num(parts[0], 1)
  let a: number
  let b: number
  if (m[1] === 'oklab') {
    a = num(parts[1], 0.4)
    b = num(parts[2], 0.4)
  } else {
    const C = num(parts[1], 0.4)
    const h = (Number(parts[2].replace('deg', '')) * Math.PI) / 180
    a = C * Math.cos(h)
    b = C * Math.sin(h)
  }
  // OKLab to linear sRGB (Ottosson's matrices), then the sRGB transfer curve.
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const encode = (c: number) => {
    const v = Math.min(1, Math.max(0, c))
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
  }
  return [encode(lin[0]), encode(lin[1]), encode(lin[2]), alpha]
}

// Source-over: `fg` laid over `backdrop`. The result is opaque when the backdrop is opaque.
export function composite(fg: string, backdrop: string): string {
  const [fr, fg2, fb, fa] = parseRgba(fg)
  const [br, bg, bb, ba] = parseRgba(backdrop)
  const outA = fa + ba * (1 - fa)
  const mix = (f: number, b: number) => (outA === 0 ? 0 : (f * fa + b * ba * (1 - fa)) / outA)
  const [r, g, b] = [mix(fr, br), mix(fg2, bg), mix(fb, bb)].map((v) => Math.round(v))
  return outA >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${outA.toFixed(3)})`
}

// WCAG relative luminance of an opaque colour.
function luminance(css: string): number {
  const [r, g, b] = parseRgba(css).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG contrast of `a` over `b`. A translucent `a` is composited over `b` first; `b` must be opaque.
export function contrastRatio(a: string, b: string): number {
  if (parseRgba(b)[3] < 1) throw new Error(`backdrop must be opaque: ${b}`)
  const fg = parseRgba(a)[3] < 1 ? composite(a, b) : a
  const [hi, lo] = [luminance(fg), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
