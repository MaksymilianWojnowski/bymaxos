import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { centreOf, seriousViolations, touchDrag, unlockMobile } from './helpers.ts'

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

// Phones up to about 680px tall: the notification list must scroll above the controls, not under them.
for (const viewport of [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
]) {
  test.describe(`lock screen at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    test('notification cards do not cover the flashlight, which is still clickable', async ({ page }) => {
      await page.goto('/')
      await expect(lockHint(page)).toBeVisible()
      const flashlight = page.getByRole('button', { name: 'Flashlight', exact: true })
      const list = page.locator('[data-card]').first().locator('xpath=ancestor::ul[1]')
      const listBox = await list.boundingBox()
      const flashBox = await flashlight.boundingBox()
      expect(listBox && flashBox && listBox.y + listBox.height <= flashBox.y).toBe(true)
      await flashlight.click()
      // The white layer replaces the lock content, so the layer is what proves the tap landed.
      await expect(page.getByRole('button', { name: 'Tap to turn off flashlight' })).toBeVisible()
    })
  })
}

// Real touch over CDP: the lock list must not swallow the unlock drag when it does not scroll.
test.describe('touch lock screen at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('a vertical touch drag from a card unlocks', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const from = await centreOf(page.locator('[data-card]').first())
    await touchDrag(page, from, { x: from.x, y: 10 })
    await expect(lockHint(page)).toBeHidden()
  })

  test('a vertical touch drag from the space between the list and the controls unlocks', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const list = await page.locator('[data-card]').last().locator('xpath=ancestor::ul[1]').boundingBox()
    const flash = await page.getByRole('button', { name: 'Flashlight', exact: true }).boundingBox()
    if (!list || !flash) throw new Error('no boxes')
    const y = (list.y + list.height + flash.y) / 2
    await touchDrag(page, { x: 195, y }, { x: 195, y: 10 })
    await expect(lockHint(page)).toBeHidden()
  })

  test('a horizontal touch drag on a card dismisses it and the screen stays locked', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const card = page.locator('[data-card]').first()
    const title = (await card.locator('p').first().textContent()) ?? ''
    const from = await centreOf(card)
    await touchDrag(page, from, { x: from.x - 160, y: from.y })
    await expect(page.locator('[data-card]').filter({ hasText: title })).toHaveCount(0)
    await expect(lockHint(page)).toBeVisible()
  })
})

// At 320x568 the list overflows, so its touch drags scroll it instead of unlocking.
test.describe('touch lock screen at 320x568, list scrolls', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true })

  test('a vertical touch drag inside the list scrolls it and stays locked', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const list = page.locator('[data-card]').first().locator('xpath=ancestor::ul[1]')
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    const from = await centreOf(list)
    await touchDrag(page, from, { x: from.x, y: from.y - 80 })
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await expect(lockHint(page)).toBeVisible()
  })

  test('a horizontal touch drag on a card still dismisses it when the list scrolls', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const card = page.locator('[data-card]').first()
    const title = (await card.locator('p').first().textContent()) ?? ''
    const from = await centreOf(card)
    await touchDrag(page, from, { x: from.x - 120, y: from.y })
    await expect(page.locator('[data-card]').filter({ hasText: title })).toHaveCount(0)
    await expect(lockHint(page)).toBeVisible()
  })

  test('a vertical touch drag from the clock unlocks', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    const clock = await page.locator('p', { hasText: /^\d{2}:\d{2}$/ }).boundingBox()
    if (!clock) throw new Error('no clock box')
    const x = clock.x + clock.width / 2
    await touchDrag(page, { x, y: clock.y + clock.height - 4 }, { x, y: 0 })
    await expect(lockHint(page)).toBeHidden()
  })
})

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Escape closes the sheet inside Mail first, keeps the draft, and a second Escape closes Mail', async ({
    page,
  }) => {
    await unlockMobile(page)
    await dock(page).getByRole('button', { name: 'Mail', exact: true }).click()
    const mail = page.getByRole('dialog', { name: 'Mail', exact: true })
    await expect(mail).toBeVisible()
    await mail.getByRole('textbox', { name: 'Subject' }).fill('Hello')
    await mail.getByRole('textbox', { name: 'Message' }).fill('Hello draft')
    await mail.getByRole('button', { name: 'Send' }).click()
    const finish = page.getByRole('dialog', { name: 'Finish in your email app' })
    await expect(finish).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(finish).toBeHidden()
    await expect(mail).toBeVisible()
    await expect(mail.getByRole('textbox', { name: 'Message' })).toHaveValue('Hello draft')

    await page.keyboard.press('Escape')
    await expect(mail).toBeHidden()
    await expect(dock(page)).toBeVisible()
  })

  test('Enter on the lock screen unlocks without also opening the home control focus moves to', async ({ page }) => {
    await page.goto('/')
    await expect(lockHint(page)).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(dock(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeHidden()
  })

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

test.describe('phone apps stay mounted', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Terminal keeps its output, and the Mail draft survives closing the sheet', async ({ page }) => {
    await unlockMobile(page)
    await page.getByRole('button', { name: 'Terminal', exact: true }).click()
    const input = page.getByRole('textbox', { name: 'Terminal input' })
    await input.fill('whoami')
    await input.press('Enter')
    await expect(page.getByLabel('Terminal output')).toContainText('whoami')

    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await expect(dock(page)).toBeVisible()
    await dock(page).getByRole('button', { name: 'Mail', exact: true }).click()
    const mail = page.getByRole('dialog', { name: 'Mail', exact: true })
    await mail.getByRole('textbox', { name: 'Message' }).fill('Hello draft')
    await mail.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(mail).toBeHidden()
    await dock(page).getByRole('button', { name: 'Mail', exact: true }).click()
    await expect(mail.getByRole('textbox', { name: 'Message' })).toHaveValue('Hello draft')
    await mail.getByRole('button', { name: 'Close', exact: true }).click()

    await page.getByRole('button', { name: 'Terminal', exact: true }).click()
    await expect(page.getByLabel('Terminal output')).toContainText('whoami')
  })
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

  test('rotating the phone switches the home grid between 4 and 6 columns', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await unlockMobile(page)
    const grid = page.getByRole('button', { name: /— open Resume$/ }).locator('xpath=ancestor::ul[1]')
    const columns = () => grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(await columns()).toBe(4)
    await page.setViewportSize({ width: 844, height: 390 })
    expect(await columns()).toBe(6)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await columns()).toBe(4)
  })

  test('landscape home puts the Search pill on the page-dots row', async ({ page }) => {
    await unlockMobile(page)
    const dots = await page.getByRole('tablist', { name: 'Home screen pages' }).boundingBox()
    const search = await page.getByRole('button', { name: 'Search', exact: true }).boundingBox()
    expect(dots && search && Math.abs(dots.y + dots.height / 2 - (search.y + search.height / 2)) < 1).toBe(true)
  })
})
