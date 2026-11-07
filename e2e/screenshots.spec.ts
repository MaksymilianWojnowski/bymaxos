import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { openDock, settleAnimations, unlock, unlockMobile } from './helpers.ts'

// Generates the README screenshots. Skipped unless SCREENSHOTS=1, so the normal suite and CI never run it.
test.skip(process.env.SCREENSHOTS !== '1', 'screenshots are generated on demand with SCREENSHOTS=1')

const OUT = new URL('../docs/screenshots/', import.meta.url)
const GITHUB_API = 'https://api.github.com/**'
const CLOCK = '2026-11-06T10:09:00'

const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

async function shot(page: Page, file: string) {
  await settleAnimations(page)
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL(`${file}.png`, OUT)) })
}

async function openSpotlight(page: Page) {
  await page.keyboard.press('Meta+K')
  await expect(page.getByRole('combobox', { name: 'Spotlight Search' })).toBeFocused()
  await page.keyboard.type('resume')
  await expect(page.getByRole('listbox').first()).toBeVisible()
}

test.describe('desktop screenshots', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`

    test.describe(size, () => {
      test.use({ viewport, colorScheme: 'light' })

      test.beforeEach(async ({ page }) => {
        await page.route(GITHUB_API, (route) => route.abort())
        await page.clock.setFixedTime(CLOCK)
      })

      test('finder', async ({ page }) => {
        await unlock(page)
        await openDock(page, 'Finder')
        await expect(appWindow(page, 'Desktop')).toBeVisible()
        await shot(page, `${size}-finder`)
      })

      test('resume', async ({ page }) => {
        await unlock(page)
        await openSpotlight(page)
        await page.keyboard.press('Enter')
        await expect(appWindow(page, 'Resume')).toBeVisible()
        await expect(page.getByRole('toolbar', { name: 'Resume' })).toBeVisible()
        await shot(page, `${size}-resume`)
      })

      test('mission control', async ({ page }) => {
        await unlock(page)
        await openDock(page, 'Finder')
        await openDock(page, 'Mail')
        await expect(appWindow(page, 'Mail').getByRole('textbox', { name: 'Message' })).toBeVisible()
        await page.keyboard.press('Alt+ArrowUp')
        await expect(page.getByTestId('mission-backdrop')).toBeVisible()
        await shot(page, `${size}-mission-control`)
      })

      test('spotlight', async ({ page }) => {
        await unlock(page)
        await openSpotlight(page)
        await shot(page, `${size}-spotlight`)
      })

      test('launchpad', async ({ page }) => {
        await unlock(page)
        await openDock(page, 'Launchpad')
        await expect(page.getByRole('dialog', { name: 'Launchpad', exact: true })).toBeVisible()
        await shot(page, `${size}-launchpad`)
      })
    })
  }
})

test.describe('phone screenshots at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'light' })

  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
    await page.clock.setFixedTime(CLOCK)
  })

  test('lock screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Swipe up to unlock')).toBeVisible()
    await shot(page, '390x844-lock-screen')
  })

  test('home', async ({ page }) => {
    await unlockMobile(page)
    await shot(page, '390x844-home')
  })

  test('notes editor', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Notes', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Notes' })).toBeVisible()
    await page.getByRole('list', { name: 'Notes' }).getByRole('button').first().click()
    const title = page.getByRole('textbox', { name: 'Note title' })
    await expect(title).toBeVisible()
    // Shoot only once the editor has slid in; mid-slide it sits past the right edge.
    await expect(title.locator('xpath=ancestor::div[@data-detail-pane][1]')).toHaveCSS('translate', 'none')
    await shot(page, '390x844-notes-editor')
  })

  test('finder folder', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Finder', exact: true }).click()
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    await shot(page, '390x844-finder-folder')
  })

  test('mail sheet', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Mail', exact: true }).click()
    const mail = page.getByRole('dialog', { name: 'Mail', exact: true })
    await expect(mail).toBeVisible()
    await expect(mail.getByRole('textbox', { name: 'Message' })).toBeVisible()
    await shot(page, '390x844-mail-sheet')
  })

  test('terminal', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Terminal', exact: true }).click()
    await expect(page.getByRole('toolbar', { name: 'Quick commands' })).toBeVisible()
    await shot(page, '390x844-terminal')
  })
})

test.describe('landscape phone screenshots at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, colorScheme: 'light' })

  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
    await page.clock.setFixedTime(CLOCK)
  })

  test('lock screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Swipe up to unlock')).toBeVisible()
    await shot(page, '844x390-lock-screen')
  })

  test('home', async ({ page }) => {
    await unlockMobile(page)
    await shot(page, '844x390-home')
  })

  test('maps', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Maps', exact: true }).click()
    await expect(page.getByRole('img', { name: 'World map' })).toBeVisible()
    await shot(page, '844x390-maps')
  })
})
