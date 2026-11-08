import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dockIconRects } from './dockIconRects'
import { genieKeyframes, stripCount } from './genie'
import { WindowLayer } from './WindowLayer'
import { genieRestores, windowMinimizers } from '../../system/genieSignals'
import { setAppResolver, resetSystem, useSystem } from '../../system/store'
import { dispatch, installSystemCommands } from '../../system/commands'
import type { WindowSpec } from '../../system/types'

// 'flaky' fails its first chunk load; each app id gets its own lazy cache entry.
// genieNull makes playGenie report that it cannot run, so the Scale fallback runs.
const stub = vi.hoisted(() => ({ shouldThrow: false, failNext: false, genieNull: false }))

vi.mock('./genieLayer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./genieLayer')>()
  return { ...mod, playGenie: ((...args) => (stub.genieNull ? null : mod.playGenie(...args))) as typeof mod.playGenie }
})

vi.mock('../../apps/registry', () => {
  const StubApp = () => {
    if (stub.shouldThrow) throw new Error('boom')
    return (
      <>
        <p>stub</p>
        <textarea aria-label="Draft" />
      </>
    )
  }
  const makeApp = (id: string) => ({
    id,
    name: 'Finder',
    icon: { glyph: () => null, background: '#000' },
    load: () => {
      if (stub.failNext) {
        stub.failNext = false
        return Promise.reject(new Error('chunk failed'))
      }
      return Promise.resolve({ default: StubApp })
    },
    window: {
      defaultSize: { w: 600, h: 400 },
      minSize: { w: 300, h: 200 },
      resizable: true,
      singleInstance: false,
    },
  })
  return { getApp: (id: string) => (id === 'finder' || id === 'flaky' ? makeApp(id) : undefined) }
})

const spec: WindowSpec = {
  appId: 'finder',
  title: 'Finder',
  defaultSize: { w: 600, h: 400 },
  minSize: { w: 300, h: 200 },
  singleInstance: false,
  resizable: true,
}

function openFinder(): string {
  return useSystem.getState().openApp('finder') as string
}

interface FakeAnim {
  onfinish: null | (() => void)
  oncancel: null | (() => void)
  cancel: ReturnType<typeof vi.fn>
  finished: Promise<void>
  done: () => void
}

function fakeAnim(): FakeAnim {
  let done = () => {}
  const finished = new Promise<void>((resolve) => {
    done = resolve
  })
  return { onfinish: null, oncancel: null, cancel: vi.fn(), finished, done }
}

// jsdom has no Element.animate: every animation (genie strips or the Scale fallback) comes from this stub.
function stubAnimate() {
  const anims: FakeAnim[] = []
  const animate = vi.fn<(frames: unknown, opts: unknown) => FakeAnim>(() => {
    const anim = fakeAnim()
    anims.push(anim)
    return anim
  })
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
  return { animate, anims }
}

// Finishing fires onfinish (layer cleanup, Scale minimize) and settles `finished` (Window's minimize).
async function finishAll(anims: FakeAnim[]) {
  await act(async () => {
    for (const a of anims) {
      a.onfinish?.()
      a.done()
    }
  })
}

const windowEl = () => document.querySelector<HTMLElement>('[data-window-id]')

beforeEach(() => {
  resetSystem()
  useSystem.setState({ locked: false })
  setAppResolver(() => spec)
})

afterEach(() => {
  cleanup()
  stub.shouldThrow = false
  stub.genieNull = false
  genieRestores.clear()
  document.body.querySelectorAll('[data-genie-layer]').forEach((el) => el.remove())
  dockIconRects.clear()
  Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  document.documentElement.classList.remove('reduce-motion')
  vi.restoreAllMocks()
})

describe('Window', () => {
  it('renders the app inside a dialog named after the app', async () => {
    openFinder()
    render(<WindowLayer />)
    expect(screen.getByRole('dialog', { name: 'Finder' })).toBeInTheDocument()
    expect(await screen.findByText('stub')).toBeInTheDocument()
  })

  it('closes the window from the Close button', () => {
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('minimizes immediately under reduce-motion, even on repeated clicks', () => {
    document.documentElement.classList.add('reduce-motion')
    openFinder()
    render(<WindowLayer />)
    const minimize = screen.getByRole('button', { name: 'Minimize' })
    fireEvent.click(minimize)
    fireEvent.click(minimize)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
  })

  it('runs the minimize genie once and minimizes at once', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(animate).toHaveBeenCalled()
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
  })

  it('the window stays minimized once its genie strips finish', async () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    await finishAll(anims)
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('minimize plays genie towards the dock icon, then minimizes', async () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    // The window minimizes at once; the strips keep playing on their own layer.
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
    expect(document.querySelector('[data-genie-layer]')).not.toBeNull()
    await finishAll(anims)
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
  })

  it('minimize falls back to the scale effect when genie returns null', async () => {
    stub.genieNull = true
    const { animate, anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(animate).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(animate.mock.calls[0][0])).toContain('scale(0.1)')
    await finishAll(anims)
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
  })

  it('minimize with Mission Control open skips the genie, since the window is already scaled', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    useSystem.setState({ overlay: 'missionControl' })
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
    expect(animate).not.toHaveBeenCalled()
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
  })

  it('closing mid-restore removes the layer and keeps focus off body', () => {
    stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const id = openFinder()
    const { unmount } = render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    expect(document.querySelector('[data-genie-layer]')).not.toBeNull()
    unmount()
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('a window restored from minimized plays reverse genie once and is hidden until it ends', async () => {
    const { animate, anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    const started = animate.mock.calls.length
    expect(started).toBeGreaterThan(0)
    expect(windowEl()?.style.visibility).toBe('hidden')
    expect(genieRestores.has(id)).toBe(false)
    await finishAll(anims)
    expect(windowEl()?.style.visibility).toBe('')
    expect(animate).toHaveBeenCalledTimes(started)
  })

  it('restore starts from the Dock icon rect current at restore time, not at minimize time', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    const current = new DOMRect(900, 760, 52, 52)
    dockIconRects.set('finder', current)
    const win = useSystem.getState().wm.windows[0]
    act(() => useSystem.getState().restore(id))
    const from = { x: win.rect.x, y: win.rect.y, width: win.rect.w, height: win.rect.h }
    const strips = animate.mock.calls.length
    // The first restore frame is the last minimize frame: the strip sitting on the icon.
    const expected = genieKeyframes(from, current, strips, 24)[0][24].transform
    expect(stripCount(windowEl()?.querySelectorAll('*').length ?? 0)).toBe(strips)
    expect((animate.mock.calls[0][0] as Array<{ transform: string }>)[0].transform).toBe(expected)
  })

  it('a Dock click during the minimize genie restores the window', async () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    const minimizing = anims.length
    // The Dock click is the store's restore, sent while the minimize strips are still running.
    act(() => useSystem.getState().restore(id))
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
    expect(windowEl()?.style.visibility).toBe('hidden')
    await finishAll(anims.slice(minimizing))
    expect(windowEl()?.style.visibility).toBe('')
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
  })

  it('a restore cancelled by a new minimize leaves the window hidden and removes its layer', () => {
    stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(
      <StrictMode>
        <WindowLayer />
      </StrictMode>,
    )
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    expect(document.querySelector('[data-genie-layer]')).not.toBeNull()
    act(() => useSystem.getState().minimize(id))
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
    expect(windowEl()?.style.visibility).toBe('')
  })

  it('a finished restore does not take focus from another window', async () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    const other = document.createElement('button')
    document.body.append(other)
    other.focus()
    await finishAll(anims)
    expect(document.activeElement).toBe(other)
    other.remove()
  })

  it('⌘M plays genie through the window\'s minimizer', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const dispose = installSystemCommands()
    openFinder()
    render(<WindowLayer />)
    expect(dispatch({ type: 'window.minimize' })).toBe(true)
    expect(animate).toHaveBeenCalled()
    expect(document.querySelector('[data-genie-layer]')).not.toBeNull()
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
    dispose()
  })

  it('a Dock-click restore focuses the window', async () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    // Chrome leaves focus on the Dock button that was clicked.
    const dock = document.createElement('div')
    dock.setAttribute('role', 'toolbar')
    dock.setAttribute('aria-label', 'Dock')
    const button = document.createElement('button')
    dock.append(button)
    document.body.append(dock)
    button.focus()
    await finishAll(anims)
    expect(document.activeElement).toBe(windowEl())
    dock.remove()
  })

  it('a minimized window stays mounted, hidden and inert', () => {
    openFinder()
    render(<WindowLayer />)
    const id = useSystem.getState().wm.windows[0].id
    act(() => useSystem.getState().minimize(id))
    expect(windowEl()).not.toBeNull()
    expect(windowEl()?.hasAttribute('inert')).toBe(true)
    expect(windowEl()?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('dialog', { name: 'Finder' })).toBeNull()
  })

  it('a text field keeps its value across minimize and restore', () => {
    const id = openFinder()
    render(<WindowLayer />)
    const field = screen.getByRole('textbox', { name: 'Draft' }) as HTMLTextAreaElement
    field.value = 'draft'
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    expect(field.isConnected).toBe(true)
    expect(field.value).toBe('draft')
  })

  it('focus inside a minimized window moves to the next focused window', () => {
    const first = openFinder()
    const second = openFinder()
    render(<WindowLayer />)
    const field = document.querySelector<HTMLTextAreaElement>(`[data-window-id="${second}"] textarea`)
    field?.focus()
    act(() => useSystem.getState().minimize(second))
    expect(document.activeElement).toBe(document.querySelector(`[data-window-id="${first}"]`))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('restore without a Dock rect plays the Scale open animation', () => {
    const { animate } = stubAnimate()
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0][0]).toEqual([
      { opacity: 0, transform: 'scale(0.95)' },
      { opacity: 1, transform: 'none' },
    ])
  })

  it('restore under reduce motion plays no animation', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    document.documentElement.classList.add('reduce-motion')
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().restore(id))
    expect(animate).not.toHaveBeenCalled()
  })

  it('quitting an app whose only window is minimized unmounts it', () => {
    const id = openFinder()
    render(<WindowLayer />)
    act(() => useSystem.getState().minimize(id))
    act(() => useSystem.getState().close(id))
    expect(windowEl()).toBeNull()
    expect(windowMinimizers.has(id)).toBe(false)
  })

  it('toggles maximize on title bar double-click', () => {
    openFinder()
    render(<WindowLayer />)
    const title = screen.getByText('Finder')
    fireEvent.doubleClick(title)
    expect(useSystem.getState().wm.windows[0].mode).toBe('maximized')
    fireEvent.doubleClick(title)
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
  })

  it('drags the window by the title bar', () => {
    openFinder()
    render(<WindowLayer />)
    const before = useSystem.getState().wm.windows[0].rect
    const title = screen.getByText('Finder')
    fireEvent.pointerDown(title, { clientX: 200, clientY: 200 })
    fireEvent.pointerMove(title, { clientX: 260, clientY: 230 })
    fireEvent.pointerUp(title, { clientX: 260, clientY: 230 })
    const after = useSystem.getState().wm.windows[0].rect
    expect(after.x).toBe(before.x + 60)
    expect(after.y).toBe(before.y + 30)
  })

  it('resizes from the south-east handle', () => {
    openFinder()
    const { container } = render(<WindowLayer />)
    const before = useSystem.getState().wm.windows[0].rect
    const handle = container.querySelector('[data-resize="se"]') as HTMLElement
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 140, clientY: 120 })
    fireEvent.pointerUp(handle, { clientX: 140, clientY: 120 })
    const after = useSystem.getState().wm.windows[0].rect
    expect(after.w).toBe(before.w + 40)
    expect(after.h).toBe(before.h + 20)
  })

  it('shows a quit message when the app throws and reopens it on demand', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stub.shouldThrow = true
    openFinder()
    render(<WindowLayer />)
    expect(await screen.findByText('Finder quit unexpectedly.')).toBeInTheDocument()
    stub.shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByText('stub')).toBeInTheDocument()
  })

  it('retries a failed app load after Reopen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stub.failNext = true
    setAppResolver(() => ({ ...spec, appId: 'flaky' }))
    useSystem.getState().openApp('flaky')
    render(<WindowLayer />)
    expect(await screen.findByText('Finder quit unexpectedly.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByText('stub')).toBeInTheDocument()
  })
})
