import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

describe('Dock', () => {
  it('renders the dock items in group and order', () => {
    render(<Dock />)
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(labels).toEqual([
      'Finder',
      'LinkedIn (opens in new tab)',
      'GitHub (opens in new tab)',
      'Trash',
    ])
  })

  it('opens one window on the first click and focuses it on the second', () => {
    render(<Dock />)
    const finder = screen.getByRole('button', { name: 'Finder' })
    fireEvent.click(finder)
    expect(useSystem.getState().wm.windows).toHaveLength(1)
    const id = useSystem.getState().wm.windows[0].id
    fireEvent.click(finder)
    expect(useSystem.getState().wm.windows).toHaveLength(1)
    expect(useSystem.getState().wm.focusedId).toBe(id)
  })

  it('shows a running dot only for apps with a window', () => {
    render(<Dock />)
    expect(screen.queryByTestId('running-dot-finder')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finder' }))
    expect(screen.getByTestId('running-dot-finder')).toBeInTheDocument()
  })

  it('opens the trash folder in Finder', () => {
    render(<Dock />)
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }))
    expect(useSystem.getState().wm.windows[0]).toMatchObject({
      appId: 'finder',
      props: { folderId: 'trash' },
    })
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
})
