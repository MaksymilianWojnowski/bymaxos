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

describe('window-open animation', () => {
  it('exposes a shared token and utility class at 160ms ease-out', () => {
    expect(tokensCss).toMatch(/--anim-window-open:\s*window-open 160ms ease-out;/)
    expect(globalCss).toMatch(/\.animate-window-open\s*\{\s*animation:\s*var\(--anim-window-open\);\s*\}/)
  })
})
