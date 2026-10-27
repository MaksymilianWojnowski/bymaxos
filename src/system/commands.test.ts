import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canDispatch,
  dispatch,
  installSystemCommands,
  type HandlerRecord,
  registerGlobal,
  registerWindowHandlers,
  resetCommands,
  useWindowCommands,
} from './commands'
import { resetSystem, setAppResolver, useSystem } from './store'
import type { WindowSpec } from './types'

const specs: Record<string, WindowSpec> = {
  finder: {
    appId: 'finder',
    title: 'Finder',
    defaultSize: { w: 800, h: 500 },
    minSize: { w: 400, h: 260 },
    singleInstance: false,
    resizable: true,
  },
  about: {
    appId: 'about',
    title: 'About This Mac',
    defaultSize: { w: 340, h: 420 },
    minSize: { w: 340, h: 420 },
    singleInstance: true,
    resizable: false,
  },
  notes: {
    appId: 'notes',
    title: 'Notes',
    defaultSize: { w: 600, h: 400 },
    minSize: { w: 300, h: 200 },
    singleInstance: false,
    resizable: true,
  },
}

function open(appId: string): string {
  const id = useSystem.getState().openApp(appId)
  if (id === null) throw new Error(`cannot open ${appId}`)
  return id
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setAppResolver((id) => specs[id])
  resetSystem()
  resetCommands()
  useSystem.getState().setViewport(1440, 900)
})

describe('dispatch and canDispatch', () => {
  it('returns false for an unregistered command type', () => {
    expect(dispatch({ type: 'x' })).toBe(false)
    expect(canDispatch({ type: 'x' })).toBe(false)
  })

  it('runs a window handler only while its window is focused', () => {
    const handler = vi.fn()
    const w1 = open('notes')
    open('finder')
    registerWindowHandlers(w1, { 'notes.newNote': handler })

    expect(canDispatch({ type: 'notes.newNote' })).toBe(false)
    expect(dispatch({ type: 'notes.newNote' })).toBe(false)
    expect(handler).not.toHaveBeenCalled()

    useSystem.getState().focus(w1)
    expect(canDispatch({ type: 'notes.newNote' })).toBe(true)
    expect(dispatch({ type: 'notes.newNote' })).toBe(true)
    expect(handler).toHaveBeenCalledWith({ type: 'notes.newNote' })
  })

  it('does not treat inherited object keys as command handlers', () => {
    const w1 = open('notes')
    registerWindowHandlers(w1, {})
    expect(canDispatch({ type: 'toString' })).toBe(false)
  })

  it('unregistering a window handler set removes it', () => {
    const w1 = open('notes')
    const unregister = registerWindowHandlers(w1, { 'notes.newNote': vi.fn() })
    expect(canDispatch({ type: 'notes.newNote' })).toBe(true)
    unregister()
    expect(canDispatch({ type: 'notes.newNote' })).toBe(false)
  })

  it('a global with enabled() false is not dispatched and its handler is not called', () => {
    const handler = vi.fn()
    registerGlobal('thing.do', handler, () => false)
    expect(canDispatch({ type: 'thing.do' })).toBe(false)
    expect(dispatch({ type: 'thing.do' })).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('unregistering a global removes it', () => {
    const unregister = registerGlobal('thing.do', vi.fn())
    expect(canDispatch({ type: 'thing.do' })).toBe(true)
    unregister()
    expect(canDispatch({ type: 'thing.do' })).toBe(false)
  })
})

describe('installSystemCommands', () => {
  it('enables overlay.open only for available overlays', () => {
    const dispose = installSystemCommands()
    expect(canDispatch({ type: 'overlay.open', overlay: 'spotlight' })).toBe(true)
    expect(canDispatch({ type: 'overlay.open', overlay: 'missionControl' })).toBe(false)
    expect(canDispatch({ type: 'overlay.open', overlay: 'controlCenter' })).toBe(true)
    dispose()
  })

  it('window.close needs a focused window and closes it', () => {
    const dispose = installSystemCommands()
    expect(canDispatch({ type: 'window.close' })).toBe(false)

    const id = open('finder')
    expect(dispatch({ type: 'window.close' })).toBe(true)
    expect(useSystem.getState().wm.windows.find((w) => w.id === id)).toBeUndefined()
    dispose()
  })

  it('app.hide minimizes every visible window of the target app only', () => {
    const dispose = installSystemCommands()
    const f1 = open('finder')
    const n1 = open('notes')
    open('finder')
    dispatch({ type: 'app.hide', appId: 'finder' })

    const { windows } = useSystem.getState().wm
    expect(windows.filter((w) => w.appId === 'finder' && w.mode === 'minimized')).toHaveLength(2)
    expect(windows.find((w) => w.id === n1)?.mode).toBe('normal')
    expect(windows.find((w) => w.id === f1)?.mode).toBe('minimized')
    dispose()
  })

  it('overlay.close closes an open menu before the overlay', () => {
    const dispose = installSystemCommands()
    useSystem.getState().setOverlay('controlCenter')
    useSystem.getState().setOpenMenu('apple')
    dispatch({ type: 'overlay.close' })
    expect(useSystem.getState().openMenuId).toBeNull()
    expect(useSystem.getState().overlay).toBe('controlCenter')

    dispatch({ type: 'overlay.close' })
    expect(useSystem.getState().overlay).toBeNull()
    expect(canDispatch({ type: 'overlay.close' })).toBe(false)
    dispose()
  })

  it('system.restart locks and clears all windows', () => {
    const dispose = installSystemCommands()
    open('finder')
    dispatch({ type: 'system.restart' })
    expect(useSystem.getState().locked).toBe(true)
    expect(useSystem.getState().wm.windows).toHaveLength(0)
    dispose()
  })

  it('the returned disposer unregisters every global it added', () => {
    const dispose = installSystemCommands()
    expect(canDispatch({ type: 'system.lock' })).toBe(true)
    dispose()
    expect(canDispatch({ type: 'system.lock' })).toBe(false)
    expect(canDispatch({ type: 'window.close' })).toBe(false)
  })
})

describe('useWindowCommands', () => {
  it('uses the latest handler without re-registering, and unregisters on unmount', () => {
    const w1 = open('notes')
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ h }: { h: () => void }) => useWindowCommands(w1, { 'notes.newNote': h }),
      { initialProps: { h: first } },
    )
    rerender({ h: second })
    dispatch({ type: 'notes.newNote' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    unmount()
    expect(canDispatch({ type: 'notes.newNote' })).toBe(false)
  })

  it('follows command keys that appear and disappear between renders', () => {
    const w1 = open('notes')
    const back = vi.fn()
    const { rerender } = renderHook(
      ({ keys }: { keys: HandlerRecord }) => useWindowCommands(w1, keys),
      { initialProps: { keys: { 'notes.back': back } as HandlerRecord } },
    )
    rerender({ keys: { 'notes.forward': vi.fn() } })

    expect(canDispatch({ type: 'notes.back' })).toBe(false)
    expect(dispatch({ type: 'notes.back' })).toBe(false)
    expect(back).not.toHaveBeenCalled()
    expect(canDispatch({ type: 'notes.forward' })).toBe(true)
  })
})

describe('window.zoom', () => {
  const zoom = { type: 'window.zoom' }

  it('needs a focused window that is resizable', () => {
    const dispose = installSystemCommands()
    expect(canDispatch(zoom)).toBe(false)
    open('about')
    expect(canDispatch(zoom)).toBe(false)
    open('finder')
    expect(canDispatch(zoom)).toBe(true)
    dispose()
  })
})

describe('window.bringAllToFront', () => {
  const bring = { type: 'window.bringAllToFront' }
  const zOf = (id: string) => useSystem.getState().wm.windows.find((w) => w.id === id)?.z

  it('is disabled when the active app has no visible window', () => {
    const dispose = installSystemCommands()
    open('notes')
    expect(canDispatch(bring)).toBe(false)
    dispose()
  })

  it('is disabled when the active app is already on top', () => {
    const dispose = installSystemCommands()
    open('notes')
    open('finder')
    expect(canDispatch(bring)).toBe(false)
    dispose()
  })

  it('is disabled when the only window above is minimized', () => {
    const dispose = installSystemCommands()
    const n1 = open('notes')
    open('finder')
    useSystem.getState().minimize(n1)
    expect(canDispatch(bring)).toBe(false)
    dispose()
  })

  it('raises the active app windows above others, keeping their order and focus', () => {
    const dispose = installSystemCommands()
    const f1 = open('finder')
    const n1 = open('notes')
    const f2 = open('finder')
    expect(canDispatch(bring)).toBe(true)

    expect(dispatch(bring)).toBe(true)
    expect([zOf(n1), zOf(f1), zOf(f2)]).toEqual([1, 2, 3])
    expect(useSystem.getState().wm.focusedId).toBe(f2)
    expect(canDispatch(bring)).toBe(false)
    dispose()
  })
})
