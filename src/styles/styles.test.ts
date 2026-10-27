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
const lightToken = (name: string): string => {
  const block = tokensCss.slice(tokensCss.indexOf(":root[data-theme='light']"))
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`missing token ${name}`)
  return match[1].trim()
}
const hexRgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

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
