import { describe, expect, it } from 'vitest'
import type { Rect, WindowSpec, WMState } from './types'
import {
  activeAppId,
  clampAll,
  clampRect,
  closeApp,
  closeWindow,
  emptyWM,
  focusWindow,
  hydrate,
  minimizeWindow,
  moveWindow,
  openWindow,
  restoreWindow,
  setWindowRect,
  setWindowTitle,
  toggleMaximize,
  topWindowOfApp,
} from './wm'

const area: Rect = { x: 0, y: 24, w: 1440, h: 792 }
const spec: WindowSpec = {
  appId: 'finder',
  title: 'Finder',
  defaultSize: { w: 800, h: 500 },
  minSize: { w: 400, h: 260 },
  singleInstance: false,
  resizable: true,
}
const notesSpec: WindowSpec = { ...spec, appId: 'notes', title: 'Notes' }

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

describe('openWindow', () => {
  it('centers the first window in the work area and focuses it', () => {
    const s = openWindow(emptyWM, spec, area)
    expect(s.windows).toHaveLength(1)
    const [w] = s.windows
    expect(w.rect).toEqual({ x: 320, y: 170, w: 800, h: 500 })
    expect(w.mode).toBe('normal')
    expect(w.z).toBe(1)
    expect(s.focusedId).toBe(w.id)
  })

  it('cascades a second window of the same app by 24px and raises it', () => {
    const first = openWindow(emptyWM, spec, area)
    const second = openWindow(first, spec, area)
    const [a, b] = second.windows
    expect(b.rect).toEqual({ x: a.rect.x + 24, y: a.rect.y + 24, w: 800, h: 500 })
    expect(b.z).toBeGreaterThan(a.z)
    expect(second.focusedId).toBe(b.id)
  })

  it('wraps the cascade to the work-area origin when it would overflow', () => {
    const s: WMState = {
      ...emptyWM,
      seq: 1,
      nextZ: 2,
      windows: [
        {
          id: 'w1',
          appId: 'finder',
          title: 'Finder',
          rect: { x: 1000, y: 500, w: 800, h: 500 },
          mode: 'normal',
          z: 1,
        },
      ],
    }
    const next = openWindow(s, notesSpec, area)
    expect(next.windows[1].rect).toEqual({ x: 24, y: 48, w: 800, h: 500 })
  })

  it('reuses the single instance of a singleInstance app and restores it from minimized', () => {
    const single: WindowSpec = { ...notesSpec, singleInstance: true }
    const first = openWindow(emptyWM, single, area)
    const minimized = minimizeWindow(first, first.focusedId as string)
    const again = openWindow(minimized, single, area)
    expect(again.windows).toHaveLength(1)
    expect(again.windows[0].mode).toBe('normal')
    expect(again.focusedId).toBe(first.windows[0].id)
  })

  it('merges props into an existing singleInstance window when re-opened', () => {
    const single: WindowSpec = { ...notesSpec, singleInstance: true }
    const first = openWindow(emptyWM, single, area, { a: 1 })
    const again = openWindow(first, single, area, { b: 2 })
    expect(again.windows).toHaveLength(1)
    expect(again.windows[0].props).toEqual({ a: 1, b: 2 })
  })

  it('focuses the window already showing the same document', () => {
    const docSpec: WindowSpec = { ...notesSpec, appId: 'textedit', documentKey: 'fileId' }
    const first = openWindow(emptyWM, docSpec, area, { fileId: 'doc-hello' })
    const other = openWindow(first, spec, area)
    const again = openWindow(other, docSpec, area, { fileId: 'doc-hello' })
    const docs = again.windows.filter((w) => w.appId === 'textedit')
    expect(docs).toHaveLength(1)
    expect(again.focusedId).toBe(docs[0].id)
    expect(docs[0].z).toBe(Math.max(...again.windows.map((w) => w.z)))
  })

  it('opens a new window for a different document', () => {
    const docSpec: WindowSpec = { ...notesSpec, appId: 'textedit', documentKey: 'fileId' }
    const first = openWindow(emptyWM, docSpec, area, { fileId: 'doc-hello' })
    const next = openWindow(first, docSpec, area, { fileId: 'doc-skills' })
    expect(next.windows.filter((w) => w.appId === 'textedit')).toHaveLength(2)
  })

  it('restores a minimized window of the same document', () => {
    const docSpec: WindowSpec = { ...notesSpec, appId: 'textedit', documentKey: 'fileId' }
    const first = openWindow(emptyWM, docSpec, area, { fileId: 'doc-hello' })
    const minimized = minimizeWindow(first, first.focusedId as string)
    const again = openWindow(minimized, docSpec, area, { fileId: 'doc-hello' })
    expect(again.windows).toHaveLength(1)
    expect(again.windows[0].mode).toBe('normal')
  })

  it('uses the clamped lastRectByApp for the first window of an app', () => {
    const s: WMState = {
      ...emptyWM,
      lastRectByApp: { finder: { x: 5000, y: 100, w: 800, h: 500 } },
    }
    const next = openWindow(s, spec, area)
    expect(next.windows[0].rect).toEqual({ x: 1360, y: 100, w: 800, h: 500 })
  })
})

describe('focus, close and minimize', () => {
  it('focusWindow on a lower window gives it the max z', () => {
    const a = openWindow(emptyWM, spec, area)
    const b = openWindow(a, notesSpec, area)
    const lower = b.windows[0].id
    const next = focusWindow(b, lower)
    const focused = next.windows.find((w) => w.id === lower)
    expect(focused?.z).toBe(Math.max(...next.windows.map((w) => w.z)))
    expect(next.focusedId).toBe(lower)
  })

  it('closeWindow of the focused window focuses the highest-z remaining window and records its rect', () => {
    const a = openWindow(emptyWM, spec, area)
    const b = openWindow(a, spec, area)
    const closed = b.windows[1]
    const next = closeWindow(b, closed.id)
    expect(next.windows).toHaveLength(1)
    expect(next.focusedId).toBe(a.windows[0].id)
    expect(next.lastRectByApp.finder).toEqual(closed.rect)
  })

  it('closeWindow of the last window leaves focusedId null', () => {
    const s = openWindow(emptyWM, spec, area)
    expect(closeWindow(s, s.windows[0].id).focusedId).toBeNull()
  })

  it('minimizeWindow hides the window, moves focus and is idempotent', () => {
    const a = openWindow(emptyWM, spec, area)
    const b = openWindow(a, notesSpec, area)
    const once = minimizeWindow(b, b.windows[1].id)
    expect(once.windows[1].mode).toBe('minimized')
    expect(once.focusedId).toBe(a.windows[0].id)
    expect(minimizeWindow(once, b.windows[1].id)).toEqual(once)
  })
})

describe('restoreWindow and toggleMaximize', () => {
  it('restores a minimized normal window to normal and focuses it', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const restored = restoreWindow(minimizeWindow(a, id), id)
    expect(restored.windows[0].mode).toBe('normal')
    expect(restored.focusedId).toBe(id)
    expect(restored.windows[0].z).toBe(restored.nextZ - 1)
  })

  it('restores a window that was maximized before minimizing to maximized', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const maximized = toggleMaximize(a, id, area)
    const restored = restoreWindow(minimizeWindow(maximized, id), id)
    expect(restored.windows[0].mode).toBe('maximized')
    expect(restored.windows[0].rect).toEqual(area)
  })

  it('toggleMaximize maximizes to the area and back to prevRect', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const maximized = toggleMaximize(a, id, area)
    expect(maximized.windows[0].rect).toEqual(area)
    expect(maximized.windows[0].prevRect).toEqual(a.windows[0].rect)
    expect(maximized.windows[0].mode).toBe('maximized')

    const back = toggleMaximize(maximized, id, area)
    expect(back.windows[0].rect).toEqual(a.windows[0].rect)
    expect(back.windows[0].mode).toBe('normal')
  })
})

describe('moveWindow and setWindowRect', () => {
  it('clamps a moved window into the area', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const next = moveWindow(a, id, 5000, -10, area)
    expect(next.windows[0].rect).toMatchObject({ x: 1360, y: 24 })
  })

  it('applies the minimum size when resizing', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const next = setWindowRect(a, id, { x: 0, y: 24, w: 100, h: 100 }, spec.minSize, area)
    expect(next.windows[0].rect).toEqual({ x: 0, y: 24, w: 400, h: 260 })
  })

  it('renames a window', () => {
    const a = openWindow(emptyWM, spec, area)
    expect(setWindowTitle(a, a.windows[0].id, 'Docs').windows[0].title).toBe('Docs')
  })
})

describe('clampRect', () => {
  const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })

  it('keeps the title bar inside the top and bottom of the area', () => {
    expect(clampRect(r(100, 0, 800, 500), area).y).toBe(24)
    expect(clampRect(r(100, 9999, 800, 500), area).y).toBe(24 + 792 - 28)
  })

  it('keeps at least 80px of the title bar visible on the left and right', () => {
    expect(clampRect(r(-9999, 100, 800, 500), area).x).toBe(0 - (800 - 80))
    expect(clampRect(r(9999, 100, 800, 500), area).x).toBe(1440 - 80)
  })

  it('never lets the title bar go above the work area when the area is shorter than the bar', () => {
    const short: Rect = { x: 0, y: 24, w: 800, h: 10 }
    expect(clampRect(r(100, 100, 100, 100), short).y).toBe(24)
  })

  it('caps size at the area and floors it at minSize', () => {
    expect(clampRect(r(0, 100, 2000, 2000), area)).toMatchObject({ w: 1440, h: 792 })
    expect(clampRect(r(0, 100, 100, 100), area, { w: 400, h: 260 })).toMatchObject({
      w: 400,
      h: 260,
    })
  })
})

describe('clampAll', () => {
  it('reclamps every window and maximized windows fill the new area', () => {
    const a = openWindow(emptyWM, spec, area)
    const moved = moveWindow(a, a.windows[0].id, 1300, 700, area)
    const b = openWindow(moved, notesSpec, area)
    const maxed = toggleMaximize(b, b.windows[1].id, area)
    const small: Rect = { x: 0, y: 24, w: 1024, h: 600 }
    const next = clampAll(maxed, small)
    for (const w of next.windows) {
      if (w.mode === 'maximized') expect(w.rect).toEqual(small)
      else expect(w.rect).toEqual(clampRect(w.rect, small))
    }
    expect(next.windows[0].rect).toEqual({ x: 944, y: 596, w: 800, h: 500 })
  })
})

describe('minimized-maximized windows', () => {
  it('follow a new work area so they restore at its size', () => {
    const a = openWindow(emptyWM, spec, area)
    const id = a.windows[0].id
    const hidden = minimizeWindow(toggleMaximize(a, id, area), id)
    const moved: Rect = { x: 100, y: 24, w: 900, h: 700 }
    const restored = restoreWindow(clampAll(hidden, moved), id)
    expect(restored.windows[0].mode).toBe('maximized')
    expect(restored.windows[0].rect).toEqual(moved)
    expect(restored.windows[0].restoreTo).toBeUndefined()
  })
})

describe('closeApp and activeAppId', () => {
  it('closeApp removes only the windows of that app', () => {
    const a = openWindow(emptyWM, spec, area)
    const b = openWindow(a, notesSpec, area)
    const c = openWindow(b, spec, area)
    const next = closeApp(c, 'finder')
    expect(next.windows.map((w) => w.appId)).toEqual(['notes'])
  })

  it('activeAppId defaults to finder when nothing is focused', () => {
    expect(activeAppId(emptyWM)).toBe('finder')
    const a = openWindow(emptyWM, notesSpec, area)
    expect(activeAppId(a)).toBe('notes')
  })

  it('topWindowOfApp skips minimized windows unless asked', () => {
    const a = openWindow(emptyWM, spec, area)
    const hidden = minimizeWindow(a, a.windows[0].id)
    expect(topWindowOfApp(hidden, 'finder')).toBeUndefined()
    expect(topWindowOfApp(hidden, 'finder', true)?.mode).toBe('minimized')
  })
})

describe('hydrate', () => {
  it('clamps saved rects and drops garbage entries', () => {
    const saved = {
      finder: { x: 5000, y: -10, w: 800, h: 500 },
      notes: { x: 'nope', y: 0, w: 1, h: 1 },
      bad: null,
    }
    const { lastRectByApp } = hydrate(saved, area)
    expect(lastRectByApp).toEqual({ finder: { x: 1360, y: 24, w: 800, h: 500 } })
  })

  it('returns an empty map for non-object input', () => {
    expect(hydrate('garbage', area)).toEqual({ lastRectByApp: {} })
    expect(hydrate(null, area)).toEqual({ lastRectByApp: {} })
  })
})

describe('purity', () => {
  it('never mutates frozen input state', () => {
    const base = openWindow(emptyWM, spec, area)
    const second = openWindow(base, notesSpec, area)
    const s = deepFreeze(second)
    const id = s.windows[0].id
    expect(() => {
      focusWindow(s, id)
      closeWindow(s, id)
      minimizeWindow(s, id)
      restoreWindow(minimizeWindow(s, id), id)
      toggleMaximize(s, id, area)
      moveWindow(s, id, 10, 40, area)
      setWindowRect(s, id, { x: 0, y: 24, w: 500, h: 400 }, spec.minSize, area)
      setWindowTitle(s, id, 'Renamed')
      closeApp(s, 'finder')
      clampAll(s, { x: 0, y: 24, w: 800, h: 600 })
      hydrate(deepFreeze({ finder: { x: 1, y: 2, w: 3, h: 4 } }), area)
      openWindow(s, spec, area)
    }).not.toThrow()
    expect(s.windows).toHaveLength(2)
  })
})
