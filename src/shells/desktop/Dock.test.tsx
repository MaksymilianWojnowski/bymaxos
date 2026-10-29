import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { getContent } from '../../content'
import { installSystemCommands } from '../../system/commands'
import { resetSystem, useSystem } from '../../system/store'
import { Dock } from './Dock'

let disposeCommands: () => void

beforeEach(() => {
  resetSystem()
  useSystem.setState({ locked: false })
  disposeCommands = installSystemCommands()
})

afterEach(() => {
  cleanup()
  disposeCommands()
  vi.restoreAllMocks()
})

const linkedinUrl = getContent().links.find((l) => l.id === 'linkedin')!.url
const finderWindows = () => useSystem.getState().wm.windows.filter((w) => w.appId === 'finder')

describe('Dock', () => {
  it('gives each dock item a link-coloured focus ring, which keeps 3:1 on the light dock glass', () => {
    render(<Dock />)
    expect(screen.getByRole('button', { name: 'Finder' })).toHaveClass('focus-visible:ring-accent-link')
  })

  it('renders the dock items in group and order', () => {
    render(<Dock />)
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(labels).toEqual([
      'Launchpad',
      'Finder',
      'Resume',
      'Safari',
      'Mail',
      'Contacts',
      'Calendar',
      'Notes',
      'Photos',
      'Developer',
      'Terminal',
      'System Settings',
      'LinkedIn (opens in new tab)',
      'GitHub (opens in new tab)',
      'Trash',
    ])
    expect(screen.getByRole('toolbar', { name: 'Dock' })).toBeInTheDocument()
  })

  it('focuses the existing window on a second click after focus moved elsewhere', () => {
    render(<Dock />)
    const finder = screen.getByRole('button', { name: 'Finder' })
    fireEvent.click(finder)
    const id = finderWindows()[0].id
    act(() => {
      useSystem.getState().openApp('about')
    })
    expect(useSystem.getState().wm.focusedId).not.toBe(id)
    fireEvent.click(finder)
    expect(finderWindows()).toHaveLength(1)
    expect(useSystem.getState().wm.focusedId).toBe(id)
  })

  it('opens one window for a rapid triple click', () => {
    render(<Dock />)
    const finder = screen.getByRole('button', { name: 'Finder' })
    fireEvent.click(finder)
    fireEvent.click(finder)
    fireEvent.click(finder)
    expect(finderWindows()).toHaveLength(1)
  })

  it('restores the only window of an app when it is minimized', () => {
    render(<Dock />)
    fireEvent.click(screen.getByRole('button', { name: 'Finder' }))
    const id = finderWindows()[0].id
    act(() => {
      useSystem.getState().minimize(id)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Finder' }))
    expect(finderWindows()).toHaveLength(1)
    expect(finderWindows()[0].mode).toBe('normal')
    expect(useSystem.getState().wm.focusedId).toBe(id)
  })

  it('shows a running dot only for apps with a window', () => {
    render(<Dock />)
    expect(screen.queryByTestId('running-dot-finder')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finder' }))
    expect(screen.getByTestId('running-dot-finder')).toBeInTheDocument()
  })

  it('opens the trash folder in Finder and reuses that window on later clicks', () => {
    render(<Dock />)
    const trash = screen.getByRole('button', { name: 'Trash' })
    fireEvent.click(trash)
    expect(useSystem.getState().wm.windows[0]).toMatchObject({
      appId: 'finder',
      props: { folderId: 'trash' },
    })
    fireEvent.click(trash)
    expect(useSystem.getState().wm.windows).toHaveLength(1)
  })

  it('restores the trash window instead of opening another one', () => {
    render(<Dock />)
    const trash = screen.getByRole('button', { name: 'Trash' })
    fireEvent.click(trash)
    const id = useSystem.getState().wm.windows[0].id
    act(() => {
      useSystem.getState().minimize(id)
    })
    fireEvent.click(trash)
    expect(useSystem.getState().wm.windows).toHaveLength(1)
    expect(useSystem.getState().wm.windows[0].mode).toBe('normal')
  })

  it('opens the trash from its context menu without duplicating its window', () => {
    render(<Dock />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Trash' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }))
    expect(useSystem.getState().wm.windows).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }))
    expect(useSystem.getState().wm.windows).toHaveLength(1)
  })

  it('opens Launchpad on click and closes it on a second click', () => {
    render(<Dock />)
    const launchpad = screen.getByRole('button', { name: 'Launchpad' })
    fireEvent.click(launchpad)
    expect(useSystem.getState().overlay).toBe('launchpad')
    fireEvent.click(launchpad)
    expect(useSystem.getState().overlay).toBeNull()
    expect(useSystem.getState().wm.windows).toHaveLength(0)
  })

  it('opens external links in a new tab without opener access', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<Dock />)
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn (opens in new tab)' }))
    expect(open).toHaveBeenCalledWith(linkedinUrl, '_blank', 'noopener,noreferrer')
    expect(useSystem.getState().wm.windows).toHaveLength(0)
  })

  it('disables Show All Windows and Quit when the app has no windows', () => {
    render(<Dock />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Finder' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Show All Windows' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Quit' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('restores every minimized window and focuses the top one on Show All Windows', () => {
    render(<Dock />)
    const { openApp, minimize } = useSystem.getState()
    openApp('finder')
    const top = openApp('finder')!
    minimize(useSystem.getState().wm.windows[0].id)
    minimize(top)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Finder' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show All Windows' }))
    const { wm } = useSystem.getState()
    expect(wm.windows.every((w) => w.mode !== 'minimized')).toBe(true)
    expect(wm.focusedId).toBe(top)
  })

  it('quits every window of the app from the context menu', () => {
    render(<Dock />)
    fireEvent.click(screen.getByRole('button', { name: 'Finder' }))
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Finder' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quit' }))
    expect(useSystem.getState().wm.windows).toHaveLength(0)
  })

  it('drops magnification when the setting is turned off mid-hover', () => {
    render(<Dock />)
    const finder = screen.getByRole('button', { name: 'Finder' })
    // jsdom lays out nothing, so every icon sits at x=0 and gets the peak scale.
    fireEvent.pointerMove(screen.getByRole('toolbar', { name: 'Dock' }), { clientX: 0 })
    expect(finder.style.transform).toBe('scale(1.6)')
    act(() => {
      useSystem.getState().updateSettings({ dockMagnification: false })
    })
    expect(finder.style.transform).toBe('scale(1)')
  })
})
