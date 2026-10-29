/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Vitest does not load CSS imports (?raw returns ''), and jsdom's import.meta.url is not a file URL.
const globalCss = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf-8')
const tokensCss = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')

// jsdom does not run a real cascade for custom properties, so pin the selector text instead.
describe('reduce-transparency', () => {
  it('outranks the theme selectors and makes all glass surfaces solid', () => {
    expect(globalCss).toMatch(/:root\.reduce-transparency\[data-theme\]\s*\{[^}]*--glass-bg:\s*var\(--window-bg\)/)
    expect(globalCss).toMatch(/:root\.reduce-transparency\[data-theme\]\s*\{[^}]*--menu-bg:\s*var\(--window-bg\)/)
    expect(globalCss).toMatch(/:root\.reduce-transparency\[data-theme\]\s*\{[^}]*--sidebar-bg:\s*var\(--window-bg\)/)
  })
})

describe('login blur', () => {
  it('drops the blur and goes solid under reduce-transparency', () => {
    expect(globalCss).toMatch(/\.login-blur\s*\{\s*backdrop-filter:\s*blur\(40px\);\s*\}/)
    expect(globalCss).toMatch(
      /html\.reduce-transparency \.login-blur\s*\{[^}]*backdrop-filter:\s*none[^}]*background:\s*var\(--window-bg\)/,
    )
  })
})

describe('window-open animation', () => {
  it('exposes a shared token and utility class at 160ms ease-out', () => {
    expect(tokensCss).toMatch(/--anim-window-open:\s*window-open 160ms ease-out;/)
    expect(globalCss).toMatch(/\.animate-window-open\s*\{\s*animation:\s*var\(--anim-window-open\);\s*\}/)
  })
})

// WCAG 2.x contrast of secondary text (light theme) over the window and the Finder sidebar tint.
const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: number[]): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const themeToken = (theme: 'light' | 'dark', name: string): string => {
  const block = tokensCss.slice(tokensCss.indexOf(`:root[data-theme='${theme}']`))
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`missing ${theme} token ${name}`)
  return match[1].trim()
}
const lightToken = (name: string): string => themeToken('light', name)
const hexRgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const WHITE = [255, 255, 255]

describe('secondary text contrast', () => {
  const window = hexRgb(lightToken('window-bg'))
  const sidebar = window.map((c) => c * 0.97) // bg-black/[0.03] over the window
  const [r, g, b, a] = (lightToken('text-2').match(/[\d.]+/g) ?? []).map(Number)
  const text = (bg: number[]) => [r, g, b].map((c, i) => c * a + bg[i] * (1 - a))

  it('meets WCAG AA (4.5:1) on the window background', () => {
    expect(contrast(text(window), window)).toBeGreaterThanOrEqual(4.5)
  })

  it('meets WCAG AA (4.5:1) on the sidebar background', () => {
    expect(contrast(text(sidebar), sidebar)).toBeGreaterThanOrEqual(4.5)
  })
})

// Filled accent backgrounds carry white text, and accent-coloured text sits on the window; both need AA.
describe('accent contrast', () => {
  it('maps the strong accent token to Tailwind', () => {
    expect(tokensCss).toMatch(/--color-accent-strong:\s*var\(--accent-strong\)/)
  })

  it('gives white text on the strong accent 4.5:1 or better in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(contrast(WHITE, hexRgb(themeToken(theme, 'accent-strong'))), theme).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives the strong accent as text 4.5:1 or better on the light window', () => {
    expect(contrast(hexRgb(lightToken('accent-strong')), hexRgb(lightToken('window-bg')))).toBeGreaterThanOrEqual(4.5)
  })

  it('maps the link accent token to Tailwind', () => {
    expect(tokensCss).toMatch(/--color-accent-link:\s*var\(--accent-link\)/)
  })

  it('gives the link accent as text 4.5:1 or better on the window in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(contrast(hexRgb(themeToken(theme, 'accent-link')), hexRgb(themeToken(theme, 'window-bg'))), theme).toBeGreaterThanOrEqual(4.5)
    }
  })
})

// Each non-blue accent overrides the strong and link tokens; blue keeps the :root and theme values.
const ACCENT_NAMES = ['purple', 'pink', 'red', 'orange', 'yellow', 'green', 'graphite'] as const
const declaredIn = (selector: string, name: string): string => {
  const start = tokensCss.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`missing block ${selector}`)
  const block = tokensCss.slice(start, tokensCss.indexOf('}', start))
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`missing ${name} in ${selector}`)
  return match[1].trim()
}

describe('accent overrides', () => {
  it.each(ACCENT_NAMES)('gives %s white text on the strong accent 4.5:1 or better', (accent) => {
    expect(contrast(WHITE, hexRgb(declaredIn(`:root[data-accent='${accent}']`, 'accent-strong')))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ACCENT_NAMES)('gives %s link text 4.5:1 or better on the light window', (accent) => {
    expect(contrast(hexRgb(declaredIn(`:root[data-accent='${accent}']`, 'accent-link')), hexRgb(lightToken('window-bg')))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ACCENT_NAMES)('gives %s link text 4.5:1 or better on the dark window', (accent) => {
    const link = declaredIn(`:root[data-theme='dark'][data-accent='${accent}']`, 'accent-link')
    expect(contrast(hexRgb(link), hexRgb(themeToken('dark', 'window-bg')))).toBeGreaterThanOrEqual(4.5)
  })
})

// The on-track fill and the window focus rings are non-text UI, so they need 3:1 against the light window.
describe('accent non-text contrast (light)', () => {
  it.each(['blue', ...ACCENT_NAMES])('gives %s the strong accent 3:1 or better on #ececec', (accent) => {
    const strong =
      accent === 'blue' ? lightToken('accent-strong') : declaredIn(`:root[data-accent='${accent}']`, 'accent-strong')
    expect(contrast(hexRgb(strong), hexRgb('#ececec'))).toBeGreaterThanOrEqual(3)
  })
})
