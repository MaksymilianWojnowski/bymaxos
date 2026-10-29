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

  test('desktop icon opens the Resume app', async ({ page }) => {
    await unlock(page)
    await page
      .getByRole('listbox', { name: 'Desktop', exact: true })
      .getByRole('option', { name: 'Resume.pdf' })
      .dblclick()
    const resume = page.getByRole('dialog', { name: 'Resume', exact: true })
    await expect(resume).toBeVisible()
    await expect(resume).toContainText('Scrum Master')
  })

  test('Space opens Quick Look for a file whose app is not installed', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await page.getByRole('listbox', { name: 'Desktop items' }).getByRole('option', { name: 'Projects' }).dblclick()
    await page.getByRole('listbox', { name: 'Projects items' }).getByRole('option', { name: 'LigaPWr Web App (repo).webloc' }).click()
    await page.keyboard.press('Space')
    await expect(page.getByRole('dialog', { name: 'LigaPWr Web App (repo).webloc', exact: true })).toBeVisible()
  })

  test('control center dark mode', async ({ page }) => {
    await unlock(page)
    await page.getByRole('button', { name: 'Control Center' }).click()
    await expect(page.getByRole('dialog', { name: 'Control Center' })).toBeVisible()
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('control center opens and closes from the keyboard', async ({ page }) => {
    await unlock(page)
    const status = page.getByRole('button', { name: 'Control Center' })
    await status.focus()
    await page.keyboard.press('Enter')
    const panel = page.getByRole('dialog', { name: 'Control Center' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('radio', { name: 'Auto' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(status).toBeFocused()
  })

  test('favicon and theme colour are declared', async ({ page }) => {
    await page.goto('/')
    const icon = page.locator('link[rel="icon"]')
    await expect(icon).toHaveAttribute('href', /favicon\.svg$/)
    const href = await icon.getAttribute('href')
    const res = await page.request.get(new URL(href ?? '', page.url()).toString())
    expect(res.ok()).toBe(true)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1e1e1e')
  })

  test('axe scan has no serious or critical violations', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await settle(desktopWindow(page))
    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(blocking.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
  })

  test('axe scan stays clean with a selected item and an open menu', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await settle(desktopWindow(page))
    await page.getByRole('listbox', { name: 'Desktop items' }).getByRole('option', { name: 'Resume.pdf' }).click()
    await page.getByRole('menubar').getByRole('menuitem', { name: 'File', exact: true }).click()
    await expect(page.getByRole('menu').first()).toBeVisible()
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
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })

  test('mobile placeholder', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('bymaxOS for iPhone is on its way')).toBeVisible()
  })

  test('mobile placeholder heading is readable in light mode', async ({ page }) => {
    await page.goto('/')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const colours = await heading.evaluate((h) => ({
      text: getComputedStyle(h).color,
      background: getComputedStyle(h.closest('main') as HTMLElement).backgroundColor,
    }))
    expect(colours.background).not.toBe('rgb(0, 0, 0)')
    expect(contrastRatio(rgbOf(colours.text), rgbOf(colours.background))).toBeGreaterThanOrEqual(4.5)
  })
})

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' })

  const serious = async (page: Page) => {
    const results = await new AxeBuilder({ page }).analyze()
    return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  }

  test('mobile placeholder links pass axe in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByText('bymaxOS for iPhone is on its way')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect((await serious(page)).map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
  })

  test('about this mac links pass axe in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await unlock(page)
    await page.getByRole('menubar').getByRole('menuitem').first().click()
    await page.getByRole('menu').getByRole('menuitem', { name: 'About This Mac' }).click()
    await expect(page.getByRole('dialog', { name: 'About This Mac' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect((await serious(page)).map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
  })
})

// Parses "rgb(r, g, b)" or "rgba(r, g, b, a)" and returns the channels.
function rgbOf(css: string): number[] {
  return (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
}

// WCAG 2.x contrast ratio between two sRGB colours.
function contrastRatio(a: number[], b: number[]): number {
  const lum = (c: number[]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test.describe('narrow desktop', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('the dock shrinks so the Trash button stays on screen', async ({ page }) => {
    await unlock(page)
    const trash = await boxOf(page.getByRole('toolbar', { name: 'Dock' }).getByRole('button', { name: 'Trash' }))
    expect(trash.x).toBeGreaterThanOrEqual(0)
    expect(trash.x + trash.width).toBeLessThanOrEqual(768)
  })
})
