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
