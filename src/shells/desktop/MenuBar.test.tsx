import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DesktopShell } from './DesktopShell'
import { resetSystem, useSystem } from '../../system/store'

// The shell mounts the menu bar, the window layer and the global shortcut listener.
const shell = (extra?: ReactNode) =>
  render(
    <>
      <DesktopShell />
      {extra}
    </>,
  )

beforeEach(() => {
  resetSystem()
  useSystem.setState({ locked: false })
})

afterEach(() => {
  cleanup()
})

describe('MenuBar', () => {
  it('names the app menu after the focused app, or Finder when no window is focused', () => {
    shell()
    expect(screen.getByRole('menuitem', { name: 'Finder' })).toBeInTheDocument()
    act(() => {
      useSystem.getState().openApp('about')
    })
    expect(screen.getByRole('menuitem', { name: 'About This Mac' })).toBeInTheDocument()
  })

  it('lists every open window in the Window menu', () => {
    shell()
    act(() => {
      useSystem.getState().openApp('finder')
      useSystem.getState().openApp('about')
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Window' }))
    const menu = screen.getByRole('menu', { name: 'Window' })
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Finder' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'About This Mac' })).toBeInTheDocument()
  })

  it('closes the focused window with Option-W', async () => {
    shell()
    act(() => {
      useSystem.getState().openApp('about')
    })
    expect(await screen.findByRole('dialog', { name: 'About This Mac' })).toBeInTheDocument()
    fireEvent.keyDown(window, { code: 'KeyW', key: '∑', altKey: true })
    expect(screen.queryByRole('dialog', { name: 'About This Mac' })).not.toBeInTheDocument()
  })

  it('ignores Option-W while a text field has focus', async () => {
    shell(<input aria-label="Search field" />)
    act(() => {
      useSystem.getState().openApp('about')
    })
    const dialog = await screen.findByRole('dialog', { name: 'About This Mac' })
    const field = screen.getByRole('textbox', { name: 'Search field' })
    field.focus()
    fireEvent.keyDown(field, { code: 'KeyW', key: '∑', altKey: true })
    expect(dialog).toBeInTheDocument()
  })

  it('opens the keyboard shortcuts sheet from Help and closes it with Escape', () => {
    shell()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keyboard Shortcuts' }))
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument()
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('locks the screen from the system menu', () => {
    shell()
    fireEvent.click(screen.getByRole('menuitem', { name: 'bymaxOS' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Lock Screen' }))
    expect(useSystem.getState().locked).toBe(true)
  })
})
