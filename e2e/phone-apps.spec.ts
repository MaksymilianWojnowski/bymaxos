import { expect, test, type Page } from '@playwright/test'
import { phoneAudit, unlockMobile } from './helpers.ts'

// Each phone app task appends its states here; every state is audited at both phone sizes.
const openNotes = async (page: Page) => {
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Notes' })).toBeVisible()
}

const PHONE_STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'Home screen', open: async () => {} },
  { name: 'Notes list', open: openNotes },
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
    test(`${state.name} has 44px targets and no sideways overflow`, async ({ page }) => {
      await unlockMobile(page)
      await state.open(page)
      expect(await phoneAudit(page)).toEqual({ smallTargets: [], overflowing: [] })
    })
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
