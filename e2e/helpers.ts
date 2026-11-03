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

export type PhoneAudit = { smallTargets: string[]; overflowing: string[] }

// Layout checks for a phone state: touch targets under 44px and anything past the viewport's right edge.
export async function phoneAudit(page: Page): Promise<PhoneAudit> {
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
        smallTargets.push(`${describe(el)} ${Math.round(box.width)}x${Math.round(box.height)}`)
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
