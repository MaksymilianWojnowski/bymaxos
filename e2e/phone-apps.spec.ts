import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { phoneAudit, seriousViolations, settleAnimations, unlockMobile } from './helpers.ts'

const REPOS_FIXTURE = fileURLToPath(new URL('./fixtures/repos.json', import.meta.url))
const GITHUB_API = 'https://api.github.com/**'

// Each phone app task appends its states here; every state is audited at both phone sizes.
const openDeveloper = async (page: Page) => {
  await page.route(GITHUB_API, (route) => {
    if (route.request().url().includes('/languages')) return route.fulfill({ json: { TypeScript: 100 } })
    return route.fulfill({ path: REPOS_FIXTURE, contentType: 'application/json' })
  })
  await page.getByRole('button', { name: 'Developer', exact: true }).click()
  await expect(page.getByRole('button', { name: /^bymaxos/ })).toBeVisible()
}

const openNotes = async (page: Page) => {
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Notes' })).toBeVisible()
}

const openFinder = async (page: Page) => {
  await page.getByRole('button', { name: 'Finder', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Desktop', exact: true })).toBeVisible()
}

const openMusic = async (page: Page) => {
  await page.getByRole('button', { name: 'Music', exact: true }).click()
  await expect(page.getByText("Music isn't configured yet.")).toBeVisible()
}

const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'System Settings', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible()
}

// Dock apps and home-grid apps both open from the page; the names are unique across the two.
const openApp = async (page: Page, name: string) => {
  await page.getByRole('button', { name, exact: true }).click()
}

const PHONE_STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'Home screen', open: async () => {} },
  { name: 'Notes list', open: openNotes },
  { name: 'Finder locations', open: openFinder },
  { name: 'Finder folder icons', open: async (page) => { await openFinder(page); await page.getByRole('button', { name: 'Desktop', exact: true }).click() } },
  { name: 'Finder folder list', open: async (page) => { await openFinder(page); await page.getByRole('button', { name: 'Desktop', exact: true }).click(); await page.getByRole('button', { name: 'List', exact: true }).click() } },
  { name: 'TextEdit document', open: async (page) => { await openFinder(page); await page.getByRole('button', { name: 'About Me', exact: true }).click(); await page.getByRole('button', { name: 'Hello.md', exact: true }).click(); await expect(page.locator('article')).toBeVisible() } },
  {
    name: 'Notes editor',
    open: async (page) => {
      await openNotes(page)
      await page.getByRole('list', { name: 'Notes' }).getByRole('button').first().click()
      const title = page.getByRole('textbox', { name: 'Note title' })
      await expect(title).toBeVisible()
      // Audit only once the editor has slid in; mid-slide it sits past the right edge.
      await expect(title.locator('xpath=ancestor::div[@data-detail-pane][1]')).toHaveCSS('translate', 'none')
    },
  },
  { name: 'Music empty state', open: openMusic },
  { name: 'Settings list', open: openSettings },
  { name: 'Settings Appearance', open: async (page) => { await openSettings(page); await page.getByRole('button', { name: 'Appearance', exact: true }).click(); await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible() } },
  { name: 'Settings Wallpaper', open: async (page) => { await openSettings(page); await page.getByRole('button', { name: 'Wallpaper', exact: true }).click(); await expect(page.getByRole('radiogroup', { name: 'Wallpaper' })).toBeVisible() } },
  { name: 'Settings Accessibility', open: async (page) => { await openSettings(page); await page.getByRole('button', { name: 'Accessibility', exact: true }).click(); await expect(page.getByRole('switch', { name: 'Reduce motion' })).toBeVisible() } },
  { name: 'Developer list', open: openDeveloper },
  {
    name: 'Developer detail',
    open: async (page) => {
      await openDeveloper(page)
      await page.getByRole('button', { name: /^bymaxos/ }).click()
      const heading = page.getByRole('heading', { name: 'bymaxos', exact: true })
      await expect(heading).toBeVisible()
      // Audit only once the detail has slid in; mid-slide it sits past the right edge.
      await expect(heading.locator('xpath=ancestor::div[@data-detail-pane][1]')).toHaveCSS('translate', 'none')
    },
  },
  { name: 'Maps', open: async (page) => { await openApp(page, 'Maps'); await expect(page.getByRole('img', { name: 'World map' })).toBeVisible() } },
  { name: 'Photos empty state', open: async (page) => { await openApp(page, 'Photos'); await expect(page.getByText("Photos will appear here once they're added.")).toBeVisible() } },
  { name: 'Contacts', open: async (page) => { await openApp(page, 'Contacts'); await expect(page.getByRole('button', { name: 'Copy email', exact: true })).toBeVisible() } },
  { name: 'Calendar', open: async (page) => { await openApp(page, 'Calendar'); await expect(page.getByRole('grid')).toBeVisible() } },
  { name: 'Mail sheet', open: async (page) => { await openApp(page, 'Mail'); await expect(page.getByRole('dialog', { name: 'Mail', exact: true })).toBeVisible() } },
  { name: 'Resume', open: async (page) => { await openApp(page, 'Resume'); await expect(page.getByRole('toolbar', { name: 'Resume' })).toBeVisible() } },
  { name: 'Safari favorites', open: async (page) => { await openApp(page, 'Safari'); await expect(page.getByRole('region', { name: 'Favorites' })).toBeVisible() } },
  { name: 'Terminal', open: async (page) => { await openApp(page, 'Terminal'); await expect(page.getByRole('toolbar', { name: 'Quick commands' })).toBeVisible() } },
]

test.describe('phone foundations at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('an input on a phone renders at 16px or more', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    const input = page.getByRole('combobox', { name: 'Search', exact: true })
    const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(16)
  })
})

test.describe('phone states at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const state of PHONE_STATES) {
    test(`${state.name} has 44px targets, no sideways overflow and 16px fields`, async ({ page }) => {
      await unlockMobile(page)
      await state.open(page)
      expect(await phoneAudit(page)).toEqual({ smallTargets: [], overflowing: [] })
      // Below 16px iOS Safari zooms the page on focus.
      const smallFields = await page.evaluate(() =>
        [...document.querySelectorAll('input, textarea, select')]
          .filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden')
          .map((el) => ({ tag: el.tagName.toLowerCase(), size: parseFloat(getComputedStyle(el).fontSize) }))
          .filter((field) => field.size < 16),
      )
      expect(smallFields).toEqual([])
    })
  }
})

test.describe('phone states axe at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const state of PHONE_STATES) {
      test(`${state.name} axe passes (${colorScheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme })
        await unlockMobile(page)
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
        await state.open(page)
        await settleAnimations(page)
        expect(await seriousViolations(page)).toEqual([])
      })
    }
  }
})

test.describe('phone states at 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  for (const state of PHONE_STATES) {
    test(`${state.name} has no sideways overflow`, async ({ page }) => {
      await unlockMobile(page)
      await state.open(page)
      expect((await phoneAudit(page)).overflowing).toEqual([])
    })
  }
})

test.describe('phone states in landscape at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true })

  for (const state of PHONE_STATES) {
    test(`${state.name} has no sideways overflow and keeps its exit in view`, async ({ page }) => {
      await unlockMobile(page)
      await state.open(page)
      expect((await phoneAudit(page)).overflowing).toEqual([])
      // A sheet has no home indicator, so its Close button is the way out; the home screen has no exit.
      if (state.name === 'Home screen') return
      const exit = state.name === 'Mail sheet' ? 'Close' : 'Home'
      await expect(page.getByRole('button', { name: exit, exact: true })).toBeInViewport()
    })
  }
})
