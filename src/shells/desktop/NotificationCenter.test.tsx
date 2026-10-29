import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { getContent } from '../../content'
import { resetSystem, useSystem } from '../../system/store'
import { KEYS } from '../../system/storage'
import { DesktopShell } from './DesktopShell'

const notifications = getContent().notifications

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  render(<DesktopShell />)
  useSystem.getState().setOverlay('notificationCenter')
})

afterEach(() => {
  cleanup()
})

const panel = () => screen.queryByRole('dialog', { name: 'Notification Center' })
const openedApps = () => useSystem.getState().wm.windows.map((w) => w.appId)

describe('NotificationCenter', () => {
  it('lists every content notification under a Notifications heading', () => {
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    for (const n of notifications) {
      expect(screen.getByText(n.title)).toBeInTheDocument()
      expect(screen.getByText(n.body)).toBeInTheDocument()
    }
  })

  it('clicking a card with appId opens that app and closes the panel', () => {
    const dialog = screen.getByRole('dialog', { name: 'Notification Center' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Welcome to bymaxOS/ }))
    expect(openedApps()).toContain('resume')
    expect(useSystem.getState().overlay).toBeNull()
    expect(panel()).not.toBeInTheDocument()
  })

  it('Dismiss removes one card, and the dismissal survives reopening', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Code on GitHub' }))
    expect(screen.queryByText('Code on GitHub')).not.toBeInTheDocument()
    expect(screen.getByText('Welcome to bymaxOS')).toBeInTheDocument()

    act(() => useSystem.getState().setOverlay(null))
    act(() => useSystem.getState().setOverlay('notificationCenter'))
    expect(screen.queryByText('Code on GitHub')).not.toBeInTheDocument()
    expect(screen.getByText('Welcome to bymaxOS')).toBeInTheDocument()
  })

  it('Clear All dismisses every card and shows No Notifications', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    for (const n of notifications) expect(screen.queryByText(n.title)).not.toBeInTheDocument()
    expect(screen.getByText('No Notifications')).toBeInTheDocument()
  })

  it('Escape and an outside click close the panel', () => {
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(useSystem.getState().overlay).toBeNull()

    act(() => useSystem.getState().setOverlay('notificationCenter'))
    fireEvent.mouseDown(document.body)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('the clock button closes an open panel instead of reopening it', () => {
    const clock = screen.getByRole('button', { name: /^Notification Center, / })
    fireEvent.mouseDown(clock)
    fireEvent.click(clock)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('moves focus into the panel on open', () => {
    act(() => useSystem.getState().setOverlay(null))
    act(() => useSystem.getState().setOverlay('notificationCenter'))
    expect(screen.getByRole('dialog', { name: 'Notification Center' })).toHaveFocus()
  })

  it('returns focus to the clock button when Escape closes the panel', () => {
    act(() => useSystem.getState().setOverlay(null))
    const clock = screen.getByRole('button', { name: /^Notification Center, / })
    clock.focus()
    act(() => useSystem.getState().setOverlay('notificationCenter'))
    expect(screen.getByRole('dialog', { name: 'Notification Center' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(useSystem.getState().overlay).toBeNull()
    expect(clock).toHaveFocus()
  })

  it.each(['{"a":1}', '"welcome"'])('ignores corrupt session storage %s and lists every card', (raw) => {
    cleanup()
    window.sessionStorage.setItem(KEYS.notifications, raw)
    render(<DesktopShell />)
    act(() => useSystem.getState().setOverlay(null))
    act(() => useSystem.getState().setOverlay('notificationCenter'))
    for (const n of notifications) expect(screen.getByText(n.title)).toBeInTheDocument()
  })
})
