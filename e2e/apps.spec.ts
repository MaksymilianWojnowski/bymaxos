import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { getContent } from '../src/content/index.ts'
import { openDock, settle, unlock } from './helpers.ts'

const REPOS_FIXTURE = fileURLToPath(new URL('./fixtures/repos.json', import.meta.url))
const GITHUB_API = 'https://api.github.com/**'

const { profile } = getContent()

const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

const serious = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('essential apps', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // Every GitHub call is stubbed; a test that needs data registers its own route, which takes precedence.
  test.beforeEach(async ({ page }) => {
    await page.route(GITHUB_API, (route) => route.abort())
  })

  test('Resume opens from the desktop icon and prints', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { printCount: number }).printCount = 0
      window.print = () => {
        ;(window as unknown as { printCount: number }).printCount += 1
      }
    })
    await unlock(page)
    await page
      .getByRole('listbox', { name: 'Desktop', exact: true })
      .getByRole('option', { name: 'Resume.pdf' })
      .dblclick()

    const resume = appWindow(page, 'Resume')
    await expect(resume).toBeVisible()
    await expect(resume.getByRole('heading', { level: 1, name: profile.name })).toBeVisible()

    await resume.getByRole('button', { name: 'Print', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { printCount: number }).printCount)).toBe(1)
  })

  test('Skip to Resume', async ({ page }) => {
    await unlock(page)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to Resume' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(appWindow(page, 'Resume')).toBeVisible()
  })

  test('Contacts downloads a vCard', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Contacts')
    const contacts = appWindow(page, 'Contacts')
    await expect(contacts).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      contacts.getByRole('button', { name: 'Download vCard' }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`${profile.name}.vcf`)
    const text = await readFile(await download.path(), 'utf8')
    expect(text.startsWith('BEGIN:VCARD')).toBe(true)
    expect(text).not.toContain('TEL')
  })

  test('Mail validates, then hands off without claiming to send', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { opened: [string, string][] }).opened = []
      window.open = ((url: string, target: string) => {
        ;(window as unknown as { opened: [string, string][] }).opened.push([String(url), target])
        return null
      }) as typeof window.open
    })
    await unlock(page)
    await openDock(page, 'Mail')
    const mail = appWindow(page, 'Mail')
    await expect(mail).toBeVisible()

    await mail.getByRole('button', { name: 'Send' }).click()
    await expect(mail.getByText('Add a subject.')).toBeVisible()
    await expect(mail.getByText('Write a message.')).toBeVisible()

    await mail.getByLabel('Subject').fill('Hello')
    await mail.getByLabel('Message').fill('Testing the handoff.')
    await mail.getByRole('button', { name: 'Send' }).click()

    const opened = await page.evaluate(() => (window as unknown as { opened: [string, string][] }).opened)
    expect(opened).toHaveLength(1)
    expect(opened[0][0].startsWith(`mailto:${profile.email}?subject=`)).toBe(true)
    expect(opened[0][1]).toBe('_self')

    await expect(appWindow(page, 'Finish in your email app')).toBeVisible()
    await expect(page.getByRole('status').getByText('nothing has been sent yet')).toBeVisible()
  })

  test('Calendar shows the current month', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Calendar')
    const expected = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())
    await expect(appWindow(page, 'Calendar').getByRole('heading', { level: 2 })).toHaveText(expected)
  })

  test('Developer lists repos from the API and falls back when it fails', async ({ page }) => {
    await page.route(GITHUB_API, (route) => {
      const url = route.request().url()
      if (url.includes('/languages')) return route.fulfill({ json: { TypeScript: 100 } })
      return route.fulfill({ path: REPOS_FIXTURE, contentType: 'application/json' })
    })
    await unlock(page)
    await openDock(page, 'Developer')
    const developer = appWindow(page, 'Developer')
    const list = developer.getByRole('listbox', { name: 'Repositories' })
    await expect(list.getByRole('option')).toHaveCount(1)
    await list.getByRole('option', { name: 'bymaxos' }).click()
    await expect(developer.getByRole('button', { name: 'View on GitHub ↗' })).toBeVisible()
  })

  test('Developer shows the saved list when GitHub is unreachable', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Developer')
    const developer = appWindow(page, 'Developer')
    await expect(developer.getByText('GitHub is unreachable — showing a saved list.')).toBeVisible()
    await expect(developer.getByRole('listbox', { name: 'Repositories' })).toBeVisible()
  })

  test('Opening the same document twice keeps one window', async ({ page }) => {
    await unlock(page)
    await openDock(page, 'Finder')
    await appWindow(page, 'Desktop').getByRole('option', { name: 'About Me' }).dblclick()
    const about = appWindow(page, 'About Me')
    await expect(about).toBeVisible()
    const hello = about.getByRole('option', { name: 'Hello.md' })
    await hello.dblclick()
    // TextEdit opens over the Finder; raise the Finder again so its icon is reachable.
    await about.getByTestId('titlebar').click({ position: { x: 300, y: 14 } })
    await hello.dblclick()
    await expect(appWindow(page, 'Hello.md')).toHaveCount(1)
  })
})

test.describe('essential apps axe', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  const scanResumeAndMail = async (page: Page) => {
    await unlock(page)
    await openDock(page, 'Resume')
    await openDock(page, 'Mail')
    await settle(appWindow(page, 'Resume'))
    await settle(appWindow(page, 'Mail'))
    expect((await serious(page)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  }

  test('axe passes with Resume and Mail open in light mode', async ({ page }) => {
    await scanResumeAndMail(page)
  })

  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' })

    test('axe passes with Resume and Mail open in dark mode', async ({ page }) => {
      await scanResumeAndMail(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    })
  })
})
