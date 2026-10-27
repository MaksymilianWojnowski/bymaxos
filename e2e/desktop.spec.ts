import { mkdirSync } from 'node:fs'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { getContent } from '../src/content/index.ts'
import { dragBy, openDock, settle, unlock } from './helpers.ts'

const MENU_BAR_H = 24
const DOCK_RESERVE = 84
const TITLE_BAR_H = 28

const desktopWindow = (page: Page) => page.getByRole('dialog', { name: 'Desktop' })

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('no bounding box')
  return box
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('login then desktop', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible()
    await expect(page.getByText(getContent().profile.name).first()).toBeVisible()

    await page.getByRole('button', { name: 'Unlock' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menubar')).toBeVisible()

    // The session survives a reload, so the login screen does not come back.
    await page.reload()
    await expect(page.getByRole('menubar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unlock' })).toHaveCount(0)
  })

  test('dock opens finder', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await expect(desktopWindow(page)).toBeVisible()
    await expect(page.getByRole('menubar').getByRole('menuitem', { name: 'Finder', exact: true })).toBeVisible()
  })

  test('drag window', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    const before = await boxOf(win)
    await dragBy(page, win.getByTestId('titlebar'), 200, 100)
    const after = await boxOf(win)
    expect(Math.abs(after.x - before.x - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.y - before.y - 100)).toBeLessThanOrEqual(2)
  })

  test('drag cannot hide title bar', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    await dragBy(page, win.getByTestId('titlebar'), 0, -500)
    await settle(win)
    const box = await boxOf(win)
    expect(box.y).toBeGreaterThanOrEqual(MENU_BAR_H - 1)
  })

  test('resize window', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    const before = await boxOf(win)
    await dragBy(page, win.getByTestId('resize-se'), 120, 80)
    const after = await boxOf(win)
    expect(Math.abs(after.width - before.width - 120)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.height - before.height - 80)).toBeLessThanOrEqual(2)
  })

  test('minimize and restore', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await expect(win).toBeVisible()
    await win.getByRole('button', { name: 'Minimize' }).click()
    await expect(win).toBeHidden()
    await openDock(page, 'Finder')
    await expect(win).toBeVisible()
  })

  test('zoom', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    await win.getByTestId('titlebar').dblclick({ position: { x: 300, y: TITLE_BAR_H / 2 } })
    await settle(win)
    const box = await boxOf(win)
    expect(Math.abs(box.x - 0)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.y - MENU_BAR_H)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.width - 1440)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.height - (900 - MENU_BAR_H - DOCK_RESERVE))).toBeLessThanOrEqual(2)
  })

  test('menu commands', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const menubar = page.getByRole('menubar')

    await menubar.getByRole('menuitem', { name: 'File', exact: true }).click()
    await page.getByRole('menu').getByRole('menuitem', { name: 'New Finder Window' }).click()
    await expect(page.getByRole('dialog', { name: 'Desktop' })).toHaveCount(2)

    await menubar.getByRole('menuitem', { name: 'Window', exact: true }).click()
    await expect(page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Desktop' })).toHaveCount(2)
    await page.keyboard.press('Escape')

    await page.keyboard.press('Alt+KeyW')
    await expect(page.getByRole('dialog', { name: 'Desktop' })).toHaveCount(1)
  })

  test('viewport shrink clamps', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    await dragBy(page, win.getByTestId('titlebar'), 1000, 800)
    await settle(win)
    await page.setViewportSize({ width: 1024, height: 640 })
    await expect
      .poll(async () => (await boxOf(win.getByTestId('titlebar'))).y + TITLE_BAR_H)
      .toBeLessThanOrEqual(640 - DOCK_RESERVE)
    const bar = await boxOf(win.getByTestId('titlebar'))
    expect(bar.x).toBeLessThanOrEqual(1024 - 80)
  })

  test('desktop icon opens quick look', async ({ page }) => {
    await unlock(page)
    await page
      .getByRole('listbox', { name: 'Desktop', exact: true })
      .getByRole('option', { name: 'Resume.pdf' })
      .dblclick()
    const preview = page.getByRole('dialog', { name: 'Resume.pdf' })
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('Scrum Master')
  })

  test('control center dark mode', async ({ page }) => {
    await unlock(page)
    await page.getByRole('button', { name: 'Control Center' }).click()
    await expect(page.getByRole('dialog', { name: 'Control Center' })).toBeVisible()
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('axe scan has no serious or critical violations', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await settle(desktopWindow(page))
    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(blocking.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
  })

  test('screenshots', async ({ page }) => {
    mkdirSync('test-results/screens', { recursive: true })
    await unlock(page)
    await openDock(page, 'Finder')
    await settle(desktopWindow(page))
    await page.screenshot({ path: 'test-results/screens/desktop-1440x900.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.screenshot({ path: 'test-results/screens/desktop-1280x720.png', fullPage: true })
  })
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile placeholder', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('bymaxOS for iPhone is on its way')).toBeVisible()
  })
})
