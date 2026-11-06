import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dockIconRects } from './dockIconRects'
import { genieKeyframes, stripCount } from './genie'
import { WindowLayer } from './WindowLayer'
import { genieRestores } from '../../system/genieSignals'
import { setAppResolver, resetSystem, useSystem } from '../../system/store'
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
    return <p>stub</p>
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

  it('runs the minimize animation once and ignores clicks while it runs', () => {
    const { animate } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    const minimize = screen.getByRole('button', { name: 'Minimize' })
    fireEvent.click(minimize)
    const started = animate.mock.calls.length
    expect(started).toBeGreaterThan(0)
    fireEvent.click(minimize)
    expect(animate).toHaveBeenCalledTimes(started)
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
  })

  it('minimizes when the animation finishes', async () => {
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
    expect(document.querySelector('[data-genie-layer]')).not.toBeNull()
    expect(windowEl()?.style.visibility).toBe('hidden')
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
    await finishAll(anims)
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
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

  it('closing mid-genie removes the layer and keeps focus off body', () => {
    const { anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    fireEvent.click(document.querySelector<HTMLElement>('[aria-label="Close"]') as HTMLElement)
    // The browser fires oncancel for each cancelled animation when the window unmounts.
    for (const a of anims) a.oncancel?.()
    expect(document.querySelector('[data-genie-layer]')).toBeNull()
    expect(useSystem.getState().wm.windows).toHaveLength(0)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('a window restored from minimized plays reverse genie once and is hidden until it ends', async () => {
    const { animate, anims } = stubAnimate()
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const id = openFinder()
    useSystem.getState().minimize(id)
    useSystem.getState().restore(id)
    render(<WindowLayer />)
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
    useSystem.getState().minimize(id)
    const current = new DOMRect(900, 760, 52, 52)
    dockIconRects.set('finder', current)
    const win = useSystem.getState().wm.windows[0]
    useSystem.getState().restore(id)
    render(<WindowLayer />)
    const from = { x: win.rect.x, y: win.rect.y, width: win.rect.w, height: win.rect.h }
    const strips = animate.mock.calls.length
    // The first restore frame is the last minimize frame: the strip sitting on the icon.
    const expected = genieKeyframes(from, current, strips, 24)[0][24].transform
    expect(stripCount(windowEl()?.querySelectorAll('*').length ?? 0)).toBe(strips)
    expect((animate.mock.calls[0][0] as Array<{ transform: string }>)[0].transform).toBe(expected)
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
