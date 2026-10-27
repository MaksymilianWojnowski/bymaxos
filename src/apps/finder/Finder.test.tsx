import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { getContent } from '../../content'
import { WindowLayer } from '../../shells/desktop/WindowLayer'
import { dispatch, installSystemCommands } from '../../system/commands'
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
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
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
