import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { seriousViolations, unlockMobile } from './helpers.ts'

const dock = (page: Page) => page.getByRole('toolbar', { name: 'Dock' })
const lockHint = (page: Page) => page.getByText('Swipe up to unlock')

// Serious and critical axe results plus the colour-contrast results that fall inside `surface`.
// Wallpaper backgrounds give incomplete contrast results, so only opaque surfaces are checked for those.
async function opaqueContrastUnchecked(page: Page, surface?: Locator): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze()
  const selectors = results.incomplete
    .filter((v) => v.id === 'color-contrast')
    .flatMap((v) => v.nodes.map((n) => n.target.join(' ')))
  if (!surface) return selectors
  return surface.evaluate(
    (el, list) =>
      list.filter((s) => {
        const node = document.querySelector(s)
        return node !== null && el.contains(node)
      }),
    selectors,
  )
}

// The app screen fades in over 220ms, and a scan mid-fade reads the text as low contrast. Infinite animations (the lock chevron) never finish, so they are skipped.
const settleAnimations = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished),
    ),
  )

test.beforeEach(async ({ page }) => {
  await page.route('https://api.github.com/**', (route) => route.abort())
})

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('swipe up unlocks', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    await page.mouse.move(60, 780)
    await page.mouse.down()
    await page.mouse.move(60, 300, { steps: 20 })
    await page.mouse.up()
    await expect(dock(page)).toBeVisible()
    await expect(lockHint(page)).toBeHidden()
  })

  test('a short slow swipe stays locked', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    await page.mouse.move(60, 780)
    await page.mouse.down()
    await page.mouse.move(60, 680, { steps: 20 })
    await page.waitForTimeout(400)
    await page.mouse.up()
    await expect(lockHint(page)).toBeVisible()
    await expect(dock(page)).toBeHidden()
  })

  test('home screen shows widgets, grid and dock; Notes opens full screen and Home returns', async ({ page }) => {
    await unlockMobile(page)
    await expect(page.getByRole('button', { name: /— open Resume$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /— open Calendar$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible()
    for (const name of ['Contacts', 'Mail', 'Safari', 'Resume']) {
      await expect(dock(page).getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('tablist', { name: 'Home screen pages' }).getByRole('tab')).toHaveCount(2)

    await page.getByRole('button', { name: 'Notes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
    await expect(dock(page)).toBeHidden()

    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await expect(dock(page)).toBeVisible()
  })

  test('Resume → Email opens the Mail sheet; Close returns home', async ({ page }) => {
    await unlockMobile(page)
    await dock(page).getByRole('button', { name: 'Resume', exact: true }).click()
    await page.getByRole('button', { name: 'Email', exact: true }).click()
    const mail = page.getByRole('dialog', { name: 'Mail', exact: true })
    await expect(mail).toBeVisible()

    await mail.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(mail).toBeHidden()
    await expect(dock(page)).toBeVisible()
  })

  test('search opens Notes at the chosen note, not the default one', async ({ page }) => {
    // "Working style" is the default note, so the search picks the second one to prove the selection.
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    const search = page.getByRole('dialog', { name: 'Search', exact: true })
    await expect(search).toBeVisible()
    await search.getByRole('combobox', { name: 'Search', exact: true }).fill("What I'm looking for")
    await search.getByRole('option', { name: /What I'm looking for/ }).click()
    await expect(search).toBeHidden()
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue("What I'm looking for")
    await expect(page.getByRole('list', { name: 'Notes' }).locator('[aria-current="true"]')).toContainText(
      "What I'm looking for",
    )
  })

  test('page 2 shows LinkedIn and GitHub', async ({ page }) => {
    await unlockMobile(page)
    const linkedin = page.getByRole('button', { name: 'LinkedIn', exact: true })
    const github = page.getByRole('button', { name: 'GitHub', exact: true })
    await expect(linkedin).not.toBeInViewport()

    await page.getByRole('tab', { name: 'Page 2', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Page 2', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(linkedin).toBeInViewport()
    await expect(github).toBeInViewport()
  })

  test('?app=resume deep link opens Resume after unlock', async ({ page }) => {
    await unlockMobile(page, '/?app=resume')
    await expect(page.getByText('Scrum Master').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe passes on lock screen, home screen, Contacts and the Mail sheet (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
      await expect(lockHint(page)).toBeVisible()
      expect(await seriousViolations(page), 'lock screen').toEqual([])

      await page.mouse.move(60, 780)
      await page.mouse.down()
      await page.mouse.move(60, 300, { steps: 20 })
      await page.mouse.up()
      await expect(dock(page)).toBeVisible()
      expect(await seriousViolations(page), 'home screen').toEqual([])

      await dock(page).getByRole('button', { name: 'Contacts', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()
      // The app loads lazily behind a null fallback; scan only once its rows exist.
      await expect(page.getByRole('button', { name: /^Copy / }).first()).toBeVisible()
      await settleAnimations(page)
      expect(await seriousViolations(page), 'Contacts').toEqual([])
      expect(await opaqueContrastUnchecked(page), 'Contacts unchecked contrast').toEqual([])
      await page.getByRole('button', { name: 'Home', exact: true }).click()
      await expect(dock(page)).toBeVisible()

      await dock(page).getByRole('button', { name: 'Mail', exact: true }).click()
      const mail = page.getByRole('dialog', { name: 'Mail', exact: true })
      await expect(mail).toBeVisible()
      await settleAnimations(page)
      expect(await seriousViolations(page), 'Mail sheet').toEqual([])
      expect(await opaqueContrastUnchecked(page, mail), 'Mail unchecked contrast').toEqual([])
    })
  }
})

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('lock screen shows the side clock layout', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const clock = page.locator('p', { hasText: /^\d{2}:\d{2}$/ })
    const card = page.locator('[data-card]').first()
    await expect(card).toBeVisible()
    const clockBox = await clock.boundingBox()
    const cardBox = await card.boundingBox()
    expect(clockBox && cardBox && clockBox.x + clockBox.width <= cardBox.x).toBe(true)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('home grid has 6 columns', async ({ page }) => {
    await unlockMobile(page)
    const grid = page.getByRole('button', { name: /— open Resume$/ }).locator('xpath=ancestor::ul[1]')
    const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(6)
    expect(await seriousViolations(page)).toEqual([])
  })
})
