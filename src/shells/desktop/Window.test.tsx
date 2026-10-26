import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dockIconRects } from './dockIconRects'
import { WindowLayer } from './WindowLayer'
import { setAppResolver, resetSystem, useSystem } from '../../system/store'
import type { WindowSpec } from '../../system/types'

// 'flaky' fails its first chunk load; each app id gets its own lazy cache entry.
const stub = vi.hoisted(() => ({ shouldThrow: false, failNext: false }))

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
}

function openFinder() {
  return useSystem.getState().openApp('finder')
}

beforeEach(() => {
  resetSystem()
  useSystem.setState({ locked: false })
  setAppResolver(() => spec)
})

afterEach(() => {
  cleanup()
  stub.shouldThrow = false
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
    const anim = { onfinish: null, oncancel: null, cancel: vi.fn() }
    const animate = vi.fn(() => anim)
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    const minimize = screen.getByRole('button', { name: 'Minimize' })
    fireEvent.click(minimize)
    fireEvent.click(minimize)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
  })

  it('minimizes when the animation finishes', () => {
    const anim = { onfinish: null as null | (() => void), oncancel: null, cancel: vi.fn() }
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: vi.fn(() => anim),
      configurable: true,
    })
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    openFinder()
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    act(() => anim.onfinish?.())
    expect(useSystem.getState().wm.windows[0].mode).toBe('minimized')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
