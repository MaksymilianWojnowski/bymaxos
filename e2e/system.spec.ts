import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { getContent } from '../src/content/index.ts'
import { openDock, settle, unlock } from './helpers.ts'

const GITHUB_API = 'https://api.github.com/**'

const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

// The menu bar names the focused app, so its menu item shows which window has focus.
const focusedApp = (page: Page, name: string) => page.getByRole('menubar').getByRole('menuitem', { name, exact: true })

const serious = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

const blocking = async (page: Page) =>
  (await serious(page)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('no bounding box')
  return box.width
}

test.describe('system overlays and settings', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // Every GitHub call is stubbed, as in apps.spec.ts.
  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
  })

  test('⌘K opens Spotlight; typing resume and Enter opens Resume', async ({ page }) => {
    await unlock(page)
    await page.keyboard.press('Meta+K')
    const search = page.getByRole('combobox', { name: 'Spotlight Search' })
    await expect(search).toBeFocused()
    await page.keyboard.type('resume')
    await page.keyboard.press('Enter')
    await expect(appWindow(page, 'Resume')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Spotlight Search' })).toHaveCount(0)
  })

  test('the Spotlight menu-bar icon opens Spotlight; Esc closes it', async ({ page }) => {
    await unlock(page)
    await page.getByRole('button', { name: 'Spotlight', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Spotlight Search' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Spotlight', exact: true })).toBeHidden()
  })

  test('Launchpad from the dock opens Mail and closes', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Launchpad')
    const launchpad = page.getByRole('dialog', { name: 'Launchpad', exact: true })
    await expect(launchpad).toBeVisible()
    await launchpad.getByRole('list', { name: 'Apps' }).getByRole('button', { name: 'Mail', exact: true }).click()
    await expect(appWindow(page, 'Mail')).toBeVisible()
    await expect(launchpad).toBeHidden()
  })

  test('⌥↑ shows Mission Control; clicking a window focuses it', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await openDock(page, 'Mail')
    await expect(focusedApp(page, 'Mail')).toBeVisible()

    await page.keyboard.press('Alt+ArrowUp')
    await expect(page.getByTestId('mission-backdrop')).toBeVisible()
    await page.getByRole('button', { name: 'Show Desktop', exact: true }).click()

    await expect(page.getByTestId('mission-backdrop')).toBeHidden()
    await expect(focusedApp(page, 'Finder')).toBeVisible()
    await expect(focusedApp(page, 'Mail')).toHaveCount(0)
  })

  test('⌥Tab switches to the previous app', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await openDock(page, 'Mail')
    await expect(focusedApp(page, 'Mail')).toBeVisible()

    await page.keyboard.down('Alt')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('listbox', { name: 'App Switcher' })).toBeVisible()
    await page.keyboard.up('Alt')

    await expect(page.getByRole('listbox', { name: 'App Switcher' })).toHaveCount(0)
    await expect(focusedApp(page, 'Finder')).toBeVisible()
    await expect(focusedApp(page, 'Mail')).toHaveCount(0)
  })

  test('Notification Center: dismissing a card persists after reopening', async ({ page }) => {
    const [first] = getContent().notifications
    await unlock(page)
    const clock = page.getByRole('button', { name: /^Notification Center, / })

    await clock.click()
    const panel = page.getByRole('dialog', { name: 'Notification Center', exact: true })
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: `Dismiss ${first.title}` }).click()
    await expect(panel.getByRole('button', { name: `Dismiss ${first.title}` })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()

    await clock.click()
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: `Dismiss ${first.title}` })).toHaveCount(0)
    await expect(panel.getByText(first.title)).toHaveCount(0)
  })

  test('System Settings: choosing Purple changes --accent-strong to #a550a7; Dock size slider resizes the dock', async ({
    page,
  }) => {
    await unlock(page)
    const dockFinder = page.getByRole('toolbar', { name: 'Dock' }).getByRole('button', { name: 'Finder', exact: true })
    const widthBefore = await widthOf(dockFinder)

    await openDock(page, 'System Settings')
    const settings = appWindow(page, 'System Settings')
    await expect(settings).toBeVisible()
    await settings.getByRole('radiogroup', { name: 'Accent colour' }).getByRole('radio', { name: 'Purple' }).click()
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-strong').trim().toLowerCase()),
      )
      .toBe('#a550a7')

    await settings.getByRole('button', { name: 'Dock', exact: true }).click()
    await settings.getByRole('slider', { name: 'Size' }).fill('72')
    await expect.poll(() => widthOf(dockFinder)).toBeGreaterThan(widthBefore)
    await expect.poll(() => widthOf(dockFinder)).toBeCloseTo(72, 0)
  })
})

test.describe('system overlays axe', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
  })

  const scanOverlays = async (page: Page) => {
    await unlock(page)

    const spotlight = page.getByRole('combobox', { name: 'Spotlight Search' })
    await page.getByRole('button', { name: 'Spotlight', exact: true }).click()
    await spotlight.fill('resume')
    await expect(page.getByRole('option').first()).toBeVisible()
    expect(await blocking(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(spotlight).toBeHidden()

    const launchpad = page.getByRole('dialog', { name: 'Launchpad', exact: true })
    await openDock(page, 'Launchpad')
    await expect(launchpad).toBeVisible()
    await settle(launchpad)
    expect(await blocking(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(launchpad).toBeHidden()

    const notifications = page.getByRole('dialog', { name: 'Notification Center', exact: true })
    await page.getByRole('button', { name: /^Notification Center, / }).click()
    await expect(notifications).toBeVisible()
    await settle(notifications)
    expect(await blocking(page)).toEqual([])
    await page.keyboard.press('Escape')
    await expect(notifications).toBeHidden()

    await openDock(page, 'System Settings')
    await settle(appWindow(page, 'System Settings'))
    expect(await blocking(page)).toEqual([])
  }

  test('axe passes with Spotlight (with results), Launchpad, Notification Center and System Settings open in light mode', async ({
    page,
  }) => {
    await scanOverlays(page)
  })

  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' })

    test('axe passes with Spotlight (with results), Launchpad, Notification Center and System Settings open in dark mode', async ({
      page,
    }) => {
      await scanOverlays(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    })
  })
})
