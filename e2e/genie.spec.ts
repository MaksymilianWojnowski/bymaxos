import { expect, test, type Locator, type Page } from '@playwright/test'
import { dragBy, openDock, settle, unlock } from './helpers.ts'

const IDENTITY = 'translate(0px, 0px) scale(1, 1)'

// One entry per strip, recorded from the animate() call that the genie layer makes.
interface Strip {
  transforms: string[]
  iframes: number
  scrollTop: number
}

const desktopWindow = (page: Page) => page.getByRole('dialog', { name: 'Desktop' })
const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('no bounding box')
  return box
}

// Records the keyframes and clone state of every genie strip; the layer's own animate calls are the only ones recorded.
async function recordGenie(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __genie: unknown[] }
    w.__genie = []
    const original = Element.prototype.animate
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (this.parentElement?.hasAttribute('data-genie-layer')) {
        const frames = args[0] as Array<{ transform?: string }>
        w.__genie.push({
          transforms: frames.map((f) => String(f.transform)),
          iframes: this.querySelectorAll('iframe, video, audio').length,
          scrollTop: Math.max(0, ...Array.from(this.querySelectorAll('*'), (e) => e.scrollTop)),
        })
      }
      return original.apply(this, args)
    } as Element['animate']
  })
}

const strips = (page: Page) => page.evaluate(() => (window as unknown as { __genie: Strip[] }).__genie)

// Reads "translate(tx px, ty px) scale(sx, sy)" back into numbers.
function parse(t: string): number[] {
  const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+), ([\d.]+)\)$/.exec(t)
  if (!m) throw new Error(`unexpected transform: ${t}`)
  return m.slice(1).map(Number)
}

// The Dock magnifies under the pointer, so the icon is measured once the pointer has left it.
async function restingBox(page: Page, name: string) {
  await page.mouse.move(700, 450)
  const dock = page.getByRole('toolbar', { name: 'Dock' }).getByRole('button', { name })
  let last = ''
  await expect
    .poll(async () => {
      const current = JSON.stringify(await dock.boundingBox())
      const stable = current === last
      last = current
      return stable
    })
    .toBe(true)
  return boxOf(dock)
}

test.describe('genie', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('minimizing Finder shows genie strips that end at its Dock icon, then removes them', async ({ page }) => {
    await recordGenie(page)
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    const from = await boxOf(win)
    const icon = await restingBox(page, 'Finder')

    await win.getByRole('button', { name: 'Minimize' }).click()
    const recorded = await strips(page)
    expect(recorded.length).toBeGreaterThanOrEqual(8)
    const n = recorded.length
    recorded.forEach((s, i) => {
      const [tx, ty, sx, sy] = parse(s.transforms.at(-1) ?? '')
      expect(Math.abs(sx * from.width - icon.width)).toBeLessThan(0.5)
      expect(Math.abs(from.x + tx - icon.x)).toBeLessThan(0.5)
      expect(Math.abs(from.y + ty + sy * i * (from.height / n) - (icon.y + i * (icon.height / n)))).toBeLessThan(0.5)
    })

    await expect(page.locator('[data-genie-layer]')).toHaveCount(0)
    await expect(win).toBeHidden()
  })

  test('clicking the Dock icon restores the window with reverse genie', async ({ page }) => {
    await recordGenie(page)
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    const from = await boxOf(win)
    const icon = await restingBox(page, 'Finder')
    await win.getByRole('button', { name: 'Minimize' }).click()
    // The window is hidden as soon as the genie starts, so wait for the strips to clear before restoring.
    await expect(page.locator('[data-genie-layer]')).toHaveCount(0)
    await expect(win).toBeHidden()

    await page.evaluate(() => {
      ;(window as unknown as { __genie: unknown[] }).__genie = []
    })
    await openDock(page, 'Finder')
    await expect(win).toBeVisible()
    const restored = await strips(page)
    expect(restored.length).toBeGreaterThanOrEqual(8)
    const n = restored.length
    restored.forEach((s, i) => {
      // Reverse playback: the first frame sits on the Dock icon and the last frame is the window at rest.
      const [tx, ty, sx, sy] = parse(s.transforms[0])
      expect(Math.abs(sx * from.width - icon.width)).toBeLessThan(0.5)
      expect(Math.abs(from.x + tx - icon.x)).toBeLessThan(0.5)
      expect(Math.abs(from.y + ty + sy * i * (from.height / n) - (icon.y + i * (icon.height / n)))).toBeLessThan(0.5)
      expect(s.transforms.at(-1)).toBe(IDENTITY)
    })
  })

  test('minimizing Safari on an embeddable page clones no iframe', async ({ page }) => {
    await recordGenie(page)
    await unlock(page)
    await openDock(page, 'Safari')
    const win = appWindow(page, 'Safari')
    await settle(win)
    // Real content has no embeddable bookmark, so an iframe is put into the window's DOM directly.
    await win.evaluate((root) => {
      const frame = document.createElement('iframe')
      frame.src = 'about:blank'
      root.querySelector('[data-selectable]')?.append(frame)
    })
    await expect(win.locator('iframe')).toHaveCount(1)

    await win.getByRole('button', { name: 'Minimize' }).click()
    const recorded = await strips(page)
    expect(recorded.length).toBeGreaterThanOrEqual(8)
    expect(recorded.every((s) => s.iframes === 0)).toBe(true)
    await expect(page.locator('[data-genie-layer]')).toHaveCount(0)
  })

  test('reduce motion minimizes with no strips', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordGenie(page)
    await unlock(page)
    await openDock(page, 'Finder')
    const win = desktopWindow(page)
    await settle(win)
    await win.getByRole('button', { name: 'Minimize' }).click()
    await expect(win).toBeHidden()
    expect(await strips(page)).toHaveLength(0)
    await expect(page.locator('[data-genie-layer]')).toHaveCount(0)
  })

  test('a scrolled Resume keeps its scroll position in the strips', async ({ page }) => {
    await recordGenie(page)
    await unlock(page)
    await page
      .getByRole('listbox', { name: 'Desktop', exact: true })
      .getByRole('option', { name: 'Resume.pdf' })
      .dblclick()
    const resume = appWindow(page, 'Resume')
    await settle(resume)
    // Shrink the window so the document overflows its scroll container.
    await dragBy(page, resume.locator('[data-resize="se"]'), -300, -320)
    const scrolled = await resume.evaluate((root) => {
      const el = Array.from(root.querySelectorAll<HTMLElement>('*')).find((e) => e.scrollHeight > e.clientHeight + 10)
      if (!el) return -1
      el.scrollTop = 200
      return el.scrollTop
    })
    expect(scrolled).toBeGreaterThan(0)

    await resume.getByRole('button', { name: 'Minimize' }).click()
    const recorded = await strips(page)
    expect(recorded.length).toBeGreaterThanOrEqual(8)
    for (const s of recorded) expect(Math.abs(s.scrollTop - scrolled)).toBeLessThanOrEqual(1)
  })
})
