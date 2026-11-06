import { expect, test, type Locator, type Page } from '@playwright/test'
import { ACCENTS } from '../src/system/settings.ts'
import { composite, contrastRatio, openDock, parseRgba, unlock } from './helpers.ts'

const appWindow = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })

// Writes the look into storage and reloads, so the app starts with that theme and accent. The session stays unlocked.
async function applyLook(page: Page, appearance: 'light' | 'dark', accent: string): Promise<void> {
  await page.evaluate(
    ([a, c]) => localStorage.setItem('bymaxos.settings', JSON.stringify({ appearance: a, accent: c })),
    [appearance, accent],
  )
  await page.reload()
  await expect(page.getByRole('menubar')).toBeVisible()
}

// The opaque colour a box is painted over: its own background and its ancestors', composited down to the first opaque one.
async function backdropOf(locator: Locator): Promise<string> {
  const layers = await locator.evaluate((el) => {
    const out: string[] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor
      out.push(bg)
      // Chrome serialises an opaque colour as rgb() and a translucent one as rgba().
      if (bg.startsWith('rgb(')) break
    }
    return out
  })
  const base = layers[layers.length - 1]
  if (!base.startsWith('rgb(')) throw new Error(`no opaque backdrop behind the element: ${layers.join(' | ')}`)
  let acc = base
  for (let i = layers.length - 2; i >= 0; i--) acc = composite(layers[i], acc)
  return acc
}

// The colours of a box-shadow list that paint a ring (spread above zero and some alpha), outermost last.
function ringColours(shadow: string): string[] {
  return [...shadow.matchAll(/((?:rgba?|oklab|oklch)\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g)]
    .filter((m) => Number(m[5]) > 0 && parseRgba(m[1])[3] > 0)
    .map((m) => m[1])
}

// The colour the wallpaper paints at one pixel. The Dock is hidden while sampling, so nothing sits on top of it.
async function wallpaperAt(page: Page, x: number, y: number): Promise<string> {
  // A CSS locator, because getByRole skips a hidden element and the Dock must be found again to show it.
  const dock = page.locator('[role="toolbar"][aria-label="Dock"]')
  await dock.evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'))
  try {
    const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } })
    return await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const ctx = new OffscreenCanvas(1, 1).getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`
    }, png.toString('base64'))
  } finally {
    await dock.evaluate((el) => ((el as HTMLElement).style.visibility = ''))
  }
}

// Presses Tab until the target has focus, the way a keyboard user reaches it.
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 80; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('Tab never reached the target')
}

test.describe('contrast', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('an unchecked switch track has 3:1 against the window in dark mode', async ({ page }) => {
    await unlock(page)
    await applyLook(page, 'dark', 'blue')
    await openDock(page, 'System Settings')
    const settings = appWindow(page, 'System Settings')
    await expect(settings).toBeVisible()
    await settings.getByRole('button', { name: 'Accessibility', exact: true }).click()

    const toggle = settings.getByRole('switch', { name: 'Reduce motion' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    // The label is the first span, the track the second, the knob sits inside the track.
    const track = toggle.locator('span').nth(1)
    const trackColour = await track.evaluate((el) => getComputedStyle(el).backgroundColor)
    const backdrop = await backdropOf(toggle)
    expect(contrastRatio(trackColour, backdrop), `track ${trackColour} over ${backdrop}`).toBeGreaterThanOrEqual(3)
  })

  test('the selected Safari tab bar has 3:1 against the tab in dark mode for every accent', async ({ page }) => {
    await unlock(page)
    const failures: string[] = []
    for (const accent of ACCENTS) {
      await applyLook(page, 'dark', accent)
      await openDock(page, 'Safari')
      const safari = appWindow(page, 'Safari')
      await expect(safari).toBeVisible()
      // The tab button is the tab; the bar is painted by its wrapper's ::after, over the wrapper's own fill.
      const wrapper = safari.getByRole('tab', { selected: true }).locator('xpath=..')
      const bar = await wrapper.evaluate((el) => getComputedStyle(el, '::after').backgroundColor)
      const tab = await backdropOf(wrapper)
      const ratio = contrastRatio(bar, tab)
      if (ratio < 3) failures.push(`${accent}: bar ${bar} over tab ${tab} is ${ratio.toFixed(2)}:1`)
      await safari.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(safari).toBeHidden()
    }
    expect(failures, 'Safari tab bar contrast').toEqual([])
  })

  test('a focused Dock icon ring has 3:1 against the Dock glass and against the wallpaper behind it, in both themes, for every accent', async ({
    page,
  }) => {
    // Sixteen reloads with a screenshot each, so this runs longer than the default 30s.
    test.setTimeout(180000)
    await unlock(page)
    const dock = page.locator('[role="toolbar"][aria-label="Dock"]')
    const finder = dock.getByRole('button', { name: 'Finder', exact: true })
    const failures: string[] = []
    for (const appearance of ['light', 'dark'] as const) {
      for (const accent of ACCENTS) {
        await applyLook(page, appearance, accent)
        await tabTo(page, finder)
        const label = `${appearance} ${accent}`
        if (!(await finder.evaluate((el) => el.matches(':focus-visible')))) {
          failures.push(`${label}: Finder is focused but not :focus-visible`)
          continue
        }

        const shadow = await finder.evaluate((el) => getComputedStyle(el).boxShadow)
        const rings = ringColours(shadow)
        if (rings.length === 0) {
          failures.push(`${label}: no focus ring in box-shadow ${shadow}`)
          continue
        }

        // The ring sits outside the icon, so a point just above its top edge, inside the outer ring, shows what is behind it.
        const box = await finder.boundingBox()
        if (!box) throw new Error('Finder has no box')
        const x = box.x + box.width / 2
        const y = box.y - 3
        const glassCss = await dock.evaluate((el) => getComputedStyle(el).backgroundColor)
        const wallpaper = await wallpaperAt(page, x, y)
        const glass = composite(glassCss, wallpaper)

        // Each backdrop needs at least one ring colour at 3:1. The white ring can fail on a bright backdrop, and the translucent black outer ring then has to pass.
        for (const [name, backdrop] of [
          ['Dock glass', glass],
          ['wallpaper', wallpaper],
        ] as const) {
          const best = Math.max(...rings.map((c) => contrastRatio(c, backdrop)))
          if (best < 3) failures.push(`${label}: best ring ${best.toFixed(2)}:1 against ${name} ${backdrop} (rings ${rings.join(', ')})`)
        }
      }
    }
    expect(failures, 'Dock focus ring contrast').toEqual([])
  })
})
