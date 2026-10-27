import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, safeStorage } from './storage'
import { resetSystem, setAppResolver, useSystem } from './store'
import { activeAppId } from './wm'
import type { WindowSpec } from './types'

const spec: WindowSpec = {
  appId: 'finder',
  title: 'Finder',
  defaultSize: { w: 800, h: 500 },
  minSize: { w: 400, h: 260 },
  singleInstance: false,
  resizable: true,
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.documentElement.className = ''
  delete document.documentElement.dataset.theme
  setAppResolver((id) => (id === 'finder' ? spec : undefined))
  resetSystem()
  useSystem.getState().setViewport(1440, 900)
})

describe('openApp', () => {
  it('opens a window and returns its id; unknown apps return null without changing state', () => {
    const id = useSystem.getState().openApp('finder')
    expect(id).toEqual(expect.any(String))
    expect(useSystem.getState().wm.windows).toHaveLength(1)

    expect(useSystem.getState().openApp('nope')).toBeNull()
    expect(useSystem.getState().wm.windows).toHaveLength(1)
  })
})

describe('toggleMaximize', () => {
  it('leaves a non-resizable window (About This Mac) at its size', () => {
    const about: WindowSpec = { ...spec, appId: 'about', title: 'About', resizable: false }
    setAppResolver((id) => (id === 'about' ? about : id === 'finder' ? spec : undefined))
    const id = useSystem.getState().openApp('about') as string
    const before = useSystem.getState().wm.windows[0].rect

    useSystem.getState().toggleMaximize(id)

    const [w] = useSystem.getState().wm.windows
    expect(w.mode).toBe('normal')
    expect(w.rect).toEqual(before)
  })
})

describe('setViewport', () => {
  it('re-clamps existing windows to the new work area', () => {
    useSystem.getState().openApp('finder')
    useSystem.getState().setViewport(1024, 600)
    const [w] = useSystem.getState().wm.windows
    // Work area becomes {x:0, y:24, w:1024, h:600-24-84=492}.
    expect(w.rect).toEqual({ x: 320, y: 170, w: 800, h: 492 })
  })
})

describe('settings', () => {
  it('persists updates and applies reduce-motion to the document', () => {
    useSystem.getState().updateSettings({ reduceMotion: true })
    expect(safeStorage.get('local', KEYS.settings, null)).toMatchObject({ reduceMotion: true })
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
  })

  it('applies the appearance to the document theme', () => {
    useSystem.getState().updateSettings({ appearance: 'dark' })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('merges valid stored settings over the defaults on reset and ignores garbage', () => {
    safeStorage.set('local', KEYS.settings, { dockSize: 60 })
    resetSystem()
    expect(useSystem.getState().settings).toMatchObject({ dockSize: 60, appearance: 'auto' })

    safeStorage.set('local', KEYS.settings, 'garbage')
    resetSystem()
    expect(useSystem.getState().settings.dockSize).toBe(52)
  })
})

describe('lock state', () => {
  it('starts unlocked only when the session key says so', () => {
    resetSystem()
    expect(useSystem.getState().locked).toBe(true)

    safeStorage.set('session', KEYS.unlocked, true)
    resetSystem()
    expect(useSystem.getState().locked).toBe(false)
  })

  it('unlock() clears the lock and records it in the session', () => {
    useSystem.getState().lock()
    useSystem.getState().unlock()
    expect(useSystem.getState().locked).toBe(false)
    expect(safeStorage.get('session', KEYS.unlocked, false)).toBe(true)
  })
})

describe('closing windows', () => {
  it('close() writes lastRectByApp to the session windows key', () => {
    useSystem.getState().openApp('finder')
    const [w] = useSystem.getState().wm.windows
    useSystem.getState().close(w.id)
    expect(safeStorage.get('session', KEYS.windows, null)).toEqual({ finder: w.rect })
  })
})

describe('blurWindows', () => {
  it('clears focus and leaves Finder as the active app', () => {
    useSystem.getState().openApp('finder')
    useSystem.getState().blurWindows()
    const { wm } = useSystem.getState()
    expect(wm.focusedId).toBeNull()
    expect(activeAppId(wm)).toBe('finder')
  })
})
