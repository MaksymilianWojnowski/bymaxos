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

describe('banners', () => {
  it('notify appends a banner with title and body', () => {
    const id = useSystem.getState().notify('Contacts', 'Email copied.')
    expect(useSystem.getState().banners).toEqual([{ id, title: 'Contacts', body: 'Email copied.' }])
  })

  it('dismissBanner removes only that banner', () => {
    const a = useSystem.getState().notify('A')
    const b = useSystem.getState().notify('B')
    useSystem.getState().dismissBanner(a)
    expect(useSystem.getState().banners.map((x) => x.id)).toEqual([b])
  })

  it('keeps at most 3 banners, dropping the oldest', () => {
    ;['1', '2', '3', '4'].forEach((t) => useSystem.getState().notify(t))
    expect(useSystem.getState().banners.map((x) => x.title)).toEqual(['2', '3', '4'])
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

describe('app switcher', () => {
  beforeEach(() => {
    setAppResolver((id) => ({ ...spec, appId: id, title: id }))
  })

  const openAll = (...ids: string[]) => ids.forEach((id) => useSystem.getState().openApp(id))
  const idOf = (appId: string) => useSystem.getState().wm.windows.find((w) => w.appId === appId)?.id

  it('first switcherStep(1) opens the switcher on the second most recent app', () => {
    openAll('finder', 'notes')
    useSystem.getState().switcherStep(1)
    const s = useSystem.getState()
    expect(s.overlay).toBe('appSwitcher')
    expect(s.switcher).toEqual({ appIds: ['notes', 'finder'], index: 1 })
  })

  it('with one running app the switcher opens on index 0', () => {
    openAll('finder')
    useSystem.getState().switcherStep(1)
    expect(useSystem.getState().switcher).toEqual({ appIds: ['finder'], index: 0 })
  })

  it('with nothing focused and Finder open, the first step skips Finder and lands on the top other app', () => {
    openAll('finder', 'notes')
    useSystem.getState().blurWindows()
    useSystem.getState().switcherStep(1)
    const s = useSystem.getState().switcher
    expect(s?.appIds).toEqual(['finder', 'notes'])
    expect(s?.appIds[s.index]).toBe('notes')
  })

  it('with nothing focused and no Finder window, the first step lands on the top app', () => {
    openAll('notes', 'mail')
    useSystem.getState().blurWindows()
    useSystem.getState().switcherStep(1)
    expect(useSystem.getState().switcher).toEqual({ appIds: ['mail', 'notes'], index: 0 })
  })

  it('switcherStep(-1) first opens on the last app', () => {
    openAll('finder', 'notes', 'mail')
    useSystem.getState().switcherStep(-1)
    expect(useSystem.getState().switcher).toEqual({ appIds: ['mail', 'notes', 'finder'], index: 2 })
  })

  it('further steps wrap', () => {
    openAll('finder', 'notes', 'mail')
    const { switcherStep } = useSystem.getState()
    switcherStep(1)
    switcherStep(1)
    switcherStep(1)
    expect(useSystem.getState().switcher?.index).toBe(0)
    switcherStep(-1)
    expect(useSystem.getState().switcher?.index).toBe(2)
  })

  it("switcherCommit focuses the chosen app's top visible window, or restores its top minimized window, and closes the switcher", () => {
    openAll('finder', 'notes')
    useSystem.getState().minimize(idOf('notes') as string)
    // Focused app leads: [finder, notes]; the first step lands on the minimized Notes.
    useSystem.getState().switcherStep(1)
    expect(useSystem.getState().switcher?.appIds).toEqual(['finder', 'notes'])
    useSystem.getState().switcherCommit()
    expect(useSystem.getState().wm.focusedId).toBe(idOf('notes'))
    expect(useSystem.getState().wm.windows.find((w) => w.appId === 'notes')?.mode).toBe('normal')
    expect(useSystem.getState().switcher).toBeNull()
    expect(useSystem.getState().overlay).toBeNull()

    useSystem.getState().switcherStep(1)
    useSystem.getState().switcherCommit()
    expect(useSystem.getState().wm.focusedId).toBe(idOf('finder'))
  })

  it('setOverlay clears the app switcher', () => {
    openAll('finder', 'notes')
    useSystem.getState().switcherStep(1)
    useSystem.getState().setOverlay('spotlight')
    expect(useSystem.getState().switcher).toBeNull()
  })
})
