import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { getContent } from '../src/content/index.ts'
import { openDock, settle, unlock } from './helpers.ts'

const GITHUB_API = 'https://api.github.com/**'
const SPOTIFY = 'https://open.spotify.com/**'

const { experience } = getContent()

const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

const serious = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('more apps', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // External calls are stubbed so the apps never reach the network during tests.
  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
    await page.route(SPOTIFY, (route) => route.abort())
  })

  test('Terminal: help lists commands; cd work + ls lists work files; open mail opens Mail', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Terminal')
    const terminal = appWindow(page, 'Terminal')
    const input = terminal.getByRole('textbox', { name: 'Terminal input' })
    const output = terminal.getByRole('log', { name: 'Terminal output' })

    await input.fill('help')
    await input.press('Enter')
    await expect(output).toContainText('neofetch')

    await input.fill('cd work')
    await input.press('Enter')
    await input.fill('ls')
    await input.press('Enter')
    const [first] = experience
    await expect(output).toContainText(`${first.company} — ${first.role}.md`)

    await input.fill('open mail')
    await input.press('Enter')
    await expect(appWindow(page, 'Mail')).toBeVisible()
  })

  test('Notes: an edit survives a reload; Restore originals brings back the seed note', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Notes')
    const notes = appWindow(page, 'Notes')
    const title = notes.getByRole('textbox', { name: 'Note title' })
    await expect(title).toHaveValue('Working style')

    await title.fill('Edited working style')
    await expect(notes.getByRole('button', { name: /Edited working style/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('menubar')).toBeVisible()
    await openDock(page, 'Notes')
    await expect(appWindow(page, 'Notes').getByRole('textbox', { name: 'Note title' })).toHaveValue(
      'Edited working style',
    )

    await appWindow(page, 'Notes').getByRole('button', { name: 'Restore originals' }).click()
    const sheet = page.getByRole('dialog', { name: 'Restore original notes?', exact: true })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(appWindow(page, 'Notes').getByRole('textbox', { name: 'Note title' })).toHaveValue('Working style')
  })

  test('Notes are searchable in Spotlight', async ({ page }) => {
    await unlock(page)
    await page.keyboard.press('Meta+K')
    await expect(page.getByRole('combobox', { name: 'Spotlight Search' })).toBeFocused()
    await page.keyboard.type('working')
    await page.keyboard.press('Enter')
    await expect(appWindow(page, 'Notes').getByRole('textbox', { name: 'Note title' })).toHaveValue('Working style')
  })

  test("Safari: a .webloc from Finder › Projects opens Safari with the can't-be-shown card and an Open in new tab button", async ({
    page,
  }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    // A Finder window is named after its folder, so it opens as Desktop.
    const finder = appWindow(page, 'Desktop')
    await finder.getByRole('button', { name: 'Projects', exact: true }).click()
    await page
      .getByRole('listbox', { name: 'Projects items' })
      .getByRole('option', { name: 'LigaPWr Web App (repo).webloc' })
      .dblclick()

    const safari = appWindow(page, 'Safari')
    await expect(safari).toBeVisible()
    await expect(safari.getByRole('heading', { name: "This site can't be shown inside bymaxOS" })).toBeVisible()
    await expect(safari.getByRole('button', { name: 'Open in new tab ↗' })).toBeVisible()
  })

  test('Photos, Music and Maps open from the dock and show their empty states and pins', async ({ page }) => {
    await unlock(page)

    await openDock(page, 'Photos')
    await expect(appWindow(page, 'Photos').getByText("Photos will appear here once they're added.")).toBeVisible()

    await openDock(page, 'Music')
    await expect(appWindow(page, 'Music').getByText("Music isn't configured yet.")).toBeVisible()

    await openDock(page, 'Maps')
    const maps = appWindow(page, 'Maps')
    await expect(maps.getByRole('img', { name: 'World map' })).toBeVisible()
    await expect(maps.getByRole('button', { name: 'Wrocław', exact: true })).toBeVisible()
    await maps.getByRole('button', { name: 'Tokyo', exact: true }).click()
    await expect(maps.getByText('Exchange semester at Shibaura Institute of Technology.')).toBeVisible()
  })
})

test.describe('more apps axe', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
    await page.route(SPOTIFY, (route) => route.abort())
  })

  // One window at a time: a covered window gets "incomplete" contrast results instead of violations, so it would pass silently.
  const scanWindow = async (page: Page, name: string) => {
    await openDock(page, name)
    const win = appWindow(page, name)
    await expect(win).toBeVisible()
    await settle(win)
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      (await serious(page)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      `${name} violations`,
    ).toEqual([])
    // Only contrast results inside this window count; the desktop chrome behind it is other windows' business.
    const unchecked = results.incomplete
      .filter((v) => v.id === 'color-contrast')
      .flatMap((v) => v.nodes.map((n) => n.target.join(' ')))
    const insideWindow = await win.evaluate(
      (el, selectors) => selectors.filter((s) => {
        const node = document.querySelector(s)
        return node !== null && el.contains(node)
      }),
      unchecked,
    )
    expect(insideWindow, `${name} unchecked contrast`).toEqual([])
    await win.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(win).toBeHidden()
  }

  const scanMoreApps = async (page: Page) => {
    await unlock(page)
    for (const name of ['Terminal', 'Notes', 'Safari', 'Maps']) await scanWindow(page, name)
  }

  test('axe passes with each of Terminal, Notes, Safari and Maps open in light mode', async ({ page }) => {
    await scanMoreApps(page)
  })

  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' })

    test('axe passes with each of Terminal, Notes, Safari and Maps open in dark mode', async ({ page }) => {
      await unlock(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      for (const name of ['Terminal', 'Notes', 'Safari', 'Maps']) await scanWindow(page, name)
    })
  })
})
