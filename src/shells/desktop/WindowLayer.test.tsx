import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WindowLayer } from './WindowLayer'
import { setAppResolver, resetSystem, useSystem } from '../../system/store'
import type { WindowSpec } from '../../system/types'

vi.mock('../../apps/registry', () => {
  const StubApp = () => <p>stub</p>
  const makeApp = (id: string) => ({
    id,
    name: 'Finder',
    icon: { glyph: () => null, background: '#000' },
    load: () => Promise.resolve({ default: StubApp }),
    window: {
      defaultSize: { w: 600, h: 400 },
      minSize: { w: 300, h: 200 },
      resizable: true,
      singleInstance: false,
    },
  })
  return { getApp: (id: string) => (id === 'finder' ? makeApp(id) : undefined) }
})

const spec: WindowSpec = {
  appId: 'finder',
  title: 'Finder',
  defaultSize: { w: 600, h: 400 },
  minSize: { w: 300, h: 200 },
  singleInstance: false,
  resizable: true,
}

// Opens a window with a distinct title so each Show button can be found by name.
function openTitled(title: string): string {
  const id = useSystem.getState().openApp('finder')
  if (!id) throw new Error('openApp failed')
  useSystem.getState().setTitle(id, title)
  return id
}

beforeEach(() => {
  resetSystem()
  useSystem.setState({ locked: false })
  setAppResolver(() => spec)
})

afterEach(() => {
  cleanup()
})

describe('WindowLayer in Mission Control', () => {
  it('only non-minimized windows get a Show button', () => {
    openTitled('Notes')
    openTitled('Mail')
    const hidden = openTitled('Chat')
    useSystem.getState().minimize(hidden)
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    expect(screen.getByRole('button', { name: 'Show Notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Mail' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Chat' })).not.toBeInTheDocument()
  })

  it('picking a window focuses it and closes Mission Control', () => {
    const notes = openTitled('Notes')
    openTitled('Mail')
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Notes' }))
    expect(useSystem.getState().wm.focusedId).toBe(notes)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('a press on a non-top window picks it without moving the other targets', () => {
    const notes = openTitled('Notes')
    openTitled('Mail')
    openTitled('Chat')
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    const transforms = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-window-id]')).map((el) => el.style.transform)
    const before = transforms()
    const show = screen.getByRole('button', { name: 'Show Notes' })
    fireEvent.pointerDown(show, { clientX: 10, clientY: 10 })
    expect(transforms()).toEqual(before)
    fireEvent.click(show)
    expect(useSystem.getState().wm.focusedId).toBe(notes)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('the title bar traffic lights are inert while Mission Control is open', () => {
    openTitled('Notes')
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    for (const name of ['Close', 'Minimize', 'Zoom']) {
      expect(screen.getByRole('button', { name }).closest('[inert]')).not.toBeNull()
    }
    expect(screen.getByRole('button', { name: 'Show Notes' }).closest('[inert]')).toBeNull()
  })

  it('with no visible windows shows No open windows', () => {
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    expect(screen.getByText('No open windows')).toBeInTheDocument()
  })

  it('clicking the backdrop closes Mission Control', () => {
    openTitled('Notes')
    useSystem.getState().setOverlay('missionControl')
    render(<WindowLayer />)
    fireEvent.click(screen.getByTestId('mission-backdrop'))
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('window content is inert while Mission Control is open', () => {
    openTitled('Notes')
    useSystem.getState().setOverlay('missionControl')
    const { container } = render(<WindowLayer />)
    expect(container.querySelector('[data-selectable]')).toHaveAttribute('inert')
  })
})
