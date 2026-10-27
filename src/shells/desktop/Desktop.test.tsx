import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DesktopShell } from './DesktopShell'
import { KEYS } from '../../system/storage'
import { resetSystem, useSystem } from '../../system/store'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  // jsdom has no pointer capture; the drag logic only needs the call to be safe.
  Element.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// The shell mounts the desktop, window layer, menu bar and dock together, as in the app.
const desktop = () => screen.getByRole('listbox', { name: 'Desktop' })

describe('Desktop', () => {
  it('renders the four desktop items in order', () => {
    render(<DesktopShell />)
    const names = within(desktop())
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(names).toEqual(['Resume.pdf', 'About Me', 'Projects', 'Contact.vcf'])
  })

  it('opens a Finder window at the folder on double-click', async () => {
    render(<DesktopShell />)
    fireEvent.doubleClick(within(desktop()).getByRole('option', { name: 'Projects' }))
    expect(await screen.findByRole('dialog', { name: 'Projects' })).toBeInTheDocument()
  })

  it('offers Clean Up from the context menu on empty space', () => {
    render(<DesktopShell />)
    fireEvent.contextMenu(desktop())
    expect(screen.getByRole('menuitem', { name: 'Clean Up' })).toBeInTheDocument()
  })

  it('deselects the windows when empty space is clicked, making Finder the menu bar app', () => {
    render(<DesktopShell />)
    act(() => {
      useSystem.getState().openApp('about')
    })
    expect(screen.getByRole('menuitem', { name: 'About This Mac' })).toBeInTheDocument()
    fireEvent.click(desktop())
    expect(screen.getByRole('menuitem', { name: 'Finder' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'About This Mac' })).not.toBeInTheDocument()
  })

  it('moves a dragged icon to a grid cell and saves it without selecting it', () => {
    render(<DesktopShell />)
    const option = within(desktop()).getByRole('option', { name: 'Resume.pdf' })
    fireEvent.pointerDown(option, { clientX: 0, clientY: 0, button: 0, pointerId: 1 })
    // 500px down lands on row 5, which no icon holds (rows 0-3 are taken).
    fireEvent.pointerMove(option, { clientX: 0, clientY: 500, pointerId: 1 })
    fireEvent.pointerUp(option, { clientX: 0, clientY: 500, pointerId: 1 })
    fireEvent.click(option)

    expect(JSON.parse(window.localStorage.getItem(KEYS.icons) ?? '{}')).toMatchObject({
      'resume-pdf': { col: 0, row: 5 },
    })
    expect(option).toHaveAttribute('aria-selected', 'false')
  })
})
