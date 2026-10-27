import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { getContent } from '../../content'
import { WindowLayer } from '../../shells/desktop/WindowLayer'
import { canDispatch, dispatch, installSystemCommands } from '../../system/commands'
import { resetSystem, useSystem } from '../../system/store'

let disposeCommands: () => void

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  // DesktopShell installs the global commands (app.open, ...) in the real app.
  disposeCommands = installSystemCommands()
})

afterEach(() => {
  cleanup()
  disposeCommands()
  vi.restoreAllMocks()
})

describe('Finder', () => {
  it('shows the Desktop items under the Desktop title', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const list = await screen.findByRole('listbox', { name: 'Desktop items' })
    for (const name of ['Resume.pdf', 'About Me', 'Projects', 'Contact.vcf']) {
      expect(within(list).getByRole('option', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('dialog', { name: 'Desktop' })).toBeInTheDocument()
  })

  it('opens a folder on double-click and returns with Back', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.doubleClick(within(desktop).getByRole('option', { name: 'Projects' }))

    const projects = await screen.findByRole('listbox', { name: 'Projects items' })
    expect(within(projects).getByRole('option', { name: 'LigaPWr Web App.md' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Projects' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('listbox', { name: 'Desktop items' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Desktop' })).toBeInTheDocument()
  })

  it('switches to a list with a Name column when view.list is dispatched', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    await screen.findByRole('listbox', { name: 'Desktop items' })
    act(() => {
      dispatch({ type: 'view.list' })
    })
    const table = screen.getByRole('grid', { name: 'Desktop items' })
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
  })

  it('moves the selection left and right in reading order', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.click(within(desktop).getByRole('option', { name: 'Resume.pdf' }))
    fireEvent.keyDown(desktop, { key: 'ArrowRight' })
    expect(within(desktop).getByRole('option', { name: 'About Me' })).toHaveAttribute('aria-selected', 'true')
    expect(desktop).toHaveAttribute('aria-activedescendant', within(desktop).getByRole('option', { name: 'About Me' }).id)
    fireEvent.keyDown(desktop, { key: 'ArrowLeft' })
    expect(within(desktop).getByRole('option', { name: 'Resume.pdf' })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves the selection by a row of columns on ArrowDown', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    // jsdom has no layout: report three laid-out tracks for the icons grid only.
    const original = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) =>
      el === desktop
        ? ({ gridTemplateColumns: '96px 96px 96px' } as CSSStyleDeclaration)
        : original(el, pseudo),
    )
    fireEvent.click(within(desktop).getByRole('option', { name: 'Resume.pdf' }))
    fireEvent.keyDown(desktop, { key: 'ArrowDown' })
    expect(within(desktop).getByRole('option', { name: 'Contact.vcf' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(desktop, { key: 'ArrowUp' })
    expect(within(desktop).getByRole('option', { name: 'Resume.pdf' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens a folder on Enter and Quick Look for a file on Enter', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.click(within(desktop).getByRole('option', { name: 'Projects' }))
    fireEvent.keyDown(desktop, { key: 'Enter' })
    expect(await screen.findByRole('listbox', { name: 'Projects items' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const back = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.click(within(back).getByRole('option', { name: 'Resume.pdf' }))
    fireEvent.keyDown(back, { key: 'Enter' })
    expect(await screen.findByRole('dialog', { name: 'Resume.pdf' })).toBeInTheDocument()
  })

  it('does nothing on Enter or Space without a selection, or on Space over a folder', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.keyDown(desktop, { key: 'Enter' })
    fireEvent.keyDown(desktop, { key: ' ' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    fireEvent.click(within(desktop).getByRole('option', { name: 'Projects' }))
    fireEvent.keyDown(desktop, { key: ' ' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('listbox', { name: 'Desktop items' })).toBeInTheDocument()
  })

  it('offers back and forward only when they can run', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    expect(canDispatch({ type: 'finder.back' })).toBe(false)
    expect(canDispatch({ type: 'finder.forward' })).toBe(false)

    fireEvent.doubleClick(within(desktop).getByRole('option', { name: 'Projects' }))
    await screen.findByRole('listbox', { name: 'Projects items' })
    expect(canDispatch({ type: 'finder.back' })).toBe(true)
    expect(canDispatch({ type: 'finder.forward' })).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('listbox', { name: 'Desktop items' })
    expect(canDispatch({ type: 'finder.back' })).toBe(false)
    expect(canDispatch({ type: 'finder.forward' })).toBe(true)
  })

  it('offers Open only when an item is selected', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    expect(canDispatch({ type: 'finder.open' })).toBe(false)

    fireEvent.click(within(desktop).getByRole('option', { name: 'Resume.pdf' }))
    expect(canDispatch({ type: 'finder.open' })).toBe(true)
  })

  it('opens Quick Look for the selected file on Space', async () => {
    useSystem.getState().openApp('finder')
    render(<WindowLayer />)
    const desktop = await screen.findByRole('listbox', { name: 'Desktop items' })
    fireEvent.click(within(desktop).getByRole('option', { name: 'Resume.pdf' }))
    fireEvent.keyDown(desktop, { key: ' ' })

    const quickLook = await screen.findByRole('dialog', { name: 'Resume.pdf' })
    expect(within(quickLook).getByText(getContent().profile.headline)).toBeInTheDocument()
    expect(within(quickLook).getByText('Preview — the full app is coming soon.')).toBeInTheDocument()
  })

  it('shows the placeholder for an empty folder', async () => {
    useSystem.getState().openApp('finder', { folderId: 'trash' })
    render(<WindowLayer />)
    expect(await screen.findByText('Trash is empty.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Trash' })).toBeInTheDocument()
  })
})
