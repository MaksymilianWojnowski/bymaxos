import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetSystem, useSystem } from '../../system/store'
import { DesktopShell } from './DesktopShell'

beforeEach(() => {
  resetSystem()
  useSystem.getState().unlock()
})

afterEach(() => {
  cleanup()
})

describe('DesktopShell', () => {
  it('Skip to Resume is the first focusable element and opens Resume', async () => {
    render(<DesktopShell />)
    await userEvent.tab()
    const link = screen.getByRole('link', { name: 'Skip to Resume' })
    expect(link).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'resume')).toHaveLength(1)
  })

  it('releasing Alt commits the switcher', async () => {
    const { openApp } = useSystem.getState()
    openApp('finder')
    openApp('textedit')
    openApp('contacts')
    render(<DesktopShell />)
    const finder = useSystem.getState().wm.windows.find((w) => w.appId === 'finder')?.id

    // Most recent first: contacts, textedit, finder. Two steps land on finder.
    await userEvent.keyboard('{Alt>}{Tab}{Tab}{/Alt}')

    expect(useSystem.getState().wm.focusedId).toBe(finder)
    expect(useSystem.getState().switcher).toBeNull()
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('window blur cancels the switcher', async () => {
    const { openApp } = useSystem.getState()
    openApp('finder')
    openApp('contacts')
    render(<DesktopShell />)
    const focused = useSystem.getState().wm.focusedId

    await userEvent.keyboard('{Alt>}{Tab}')
    expect(useSystem.getState().overlay).toBe('appSwitcher')
    fireEvent.blur(window)
    await userEvent.keyboard('{/Alt}')

    expect(useSystem.getState().overlay).toBeNull()
    expect(useSystem.getState().wm.focusedId).toBe(focused)
  })

  it('window blur leaves other overlays open', () => {
    render(<DesktopShell />)
    useSystem.getState().setOverlay('controlCenter')
    fireEvent.blur(window)
    expect(useSystem.getState().overlay).toBe('controlCenter')
  })
})
