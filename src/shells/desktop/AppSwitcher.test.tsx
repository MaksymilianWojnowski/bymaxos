import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetSystem, useSystem } from '../../system/store'
import { AppSwitcher } from './AppSwitcher'

beforeEach(() => {
  resetSystem()
  useSystem.getState().unlock()
  const { openApp, switcherStep } = useSystem.getState()
  openApp('finder')
  openApp('textedit')
  openApp('contacts')
  // Most recent first: Contacts, TextEdit, Finder. One step selects TextEdit.
  switcherStep(1)
})

afterEach(() => {
  cleanup()
})

describe('AppSwitcher', () => {
  it('renders a listbox named App Switcher with one option per app, the selected option aria-selected and its name visible', () => {
    render(<AppSwitcher />)
    const list = screen.getByRole('listbox', { name: 'App Switcher' })
    const options = within(list).getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(screen.getByRole('option', { name: 'TextEdit' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Contacts' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('TextEdit')).toBeVisible()
    expect(screen.queryByText('Contacts')).toBeNull()
  })

  it('marks the selected cell with a text-coloured ring, visible on the light glass', () => {
    render(<AppSwitcher />)
    expect(screen.getByRole('option', { name: 'TextEdit' })).toHaveClass('ring-2', 'ring-text-1', 'bg-black/15')
    expect(screen.getByRole('option', { name: 'Contacts' })).not.toHaveClass('ring-2')
  })

  it('clicking an option commits that app', async () => {
    render(<AppSwitcher />)
    await userEvent.click(screen.getByRole('option', { name: 'Contacts' }))
    const { wm, overlay } = useSystem.getState()
    const focused = wm.windows.find((w) => w.id === wm.focusedId)
    expect(focused?.appId).toBe('contacts')
    expect(overlay).toBeNull()
  })
})
