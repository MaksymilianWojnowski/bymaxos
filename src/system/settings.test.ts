import { describe, it, expect } from 'vitest'
import { applyAppearance, defaultSettings, type Settings } from './settings'

const base: Settings = defaultSettings({ prefersReducedMotion: false })

describe('applyAppearance', () => {
  it('follows the system preference when appearance is auto', () => {
    const root = document.createElement('div')
    applyAppearance({ ...base, appearance: 'auto' }, true, root)
    expect(root.dataset.theme).toBe('dark')
  })

  it('ignores the system preference when appearance is light', () => {
    const root = document.createElement('div')
    applyAppearance({ ...base, appearance: 'light' }, true, root)
    expect(root.dataset.theme).toBe('light')
  })

  it('toggles reduce-motion and reduce-transparency classes', () => {
    const root = document.createElement('div')
    applyAppearance({ ...base, reduceMotion: true, reduceTransparency: true }, false, root)
    expect(root.classList.contains('reduce-motion')).toBe(true)
    expect(root.classList.contains('reduce-transparency')).toBe(true)

    applyAppearance({ ...base, reduceMotion: false, reduceTransparency: false }, false, root)
    expect(root.classList.contains('reduce-motion')).toBe(false)
    expect(root.classList.contains('reduce-transparency')).toBe(false)
  })
})

describe('applyAppearance accent', () => {
  it('sets data-accent on the root', () => {
    const root = document.createElement('div')
    applyAppearance({ ...base, accent: 'purple' }, false, root)
    expect(root.dataset.accent).toBe('purple')
  })
})

describe('defaultSettings', () => {
  it('seeds reduceMotion from the environment and sets the dock defaults', () => {
    const s = defaultSettings({ prefersReducedMotion: true })
    expect(s.reduceMotion).toBe(true)
    expect(s.appearance).toBe('auto')
    expect(s.dockSize).toBe(52)
  })

  it('default accent is blue', () => {
    expect(defaultSettings({ prefersReducedMotion: false }).accent).toBe('blue')
  })
})
