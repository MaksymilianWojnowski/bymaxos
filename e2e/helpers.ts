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

// Serious and critical axe results, as "rule: selectors" strings for readable failures.
export async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
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
