import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { launchpadApps } from '../../apps/registry'
import { resetSystem, useSystem } from '../../system/store'
import { Dock } from './Dock'
import { Launchpad } from './Launchpad'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false, overlay: 'launchpad' })
  // Dock registers the global dock.activate command that Launchpad dispatches.
  render(
    <>
      <Dock />
      <Launchpad />
    </>,
  )
})

afterEach(() => {
  cleanup()
})

const panel = () => within(screen.getByRole('dialog', { name: 'Launchpad' }))
const search = () => panel().getByRole('searchbox', { name: 'Search apps' })
const appButtons = () => panel().queryAllByRole('button')

describe('Launchpad', () => {
  it('shows every launchpadApps() entry as a button named after the app', () => {
    expect(appButtons().map((b) => b.textContent)).toEqual(launchpadApps().map((a) => a.name))
    expect(panel().getByRole('button', { name: 'Mail' })).toBeInTheDocument()
  })

  it('focuses the search field on open', () => {
    expect(search()).toHaveFocus()
  })

  it('filters apps by name, case-insensitively, and shows No Results when nothing matches', () => {
    fireEvent.change(search(), { target: { value: 'MAI' } })
    expect(appButtons().map((b) => b.textContent)).toEqual(['Mail'])

    fireEvent.change(search(), { target: { value: 'zzqxnomatch' } })
    expect(appButtons()).toHaveLength(0)
    expect(panel().getByText('No Results')).toBeInTheDocument()
  })

  it('returns focus to the opener when the overlay closes', () => {
    cleanup()
    render(<button type="button">Opener</button>)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    const { unmount } = render(<Launchpad />)
    expect(search()).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
  })

  it('keeps Tab inside the panel: from the last app it wraps to the search field, and Shift+Tab goes back', () => {
    const buttons = appButtons()
    const last = buttons[buttons.length - 1]
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(search()).toHaveFocus()
    fireEvent.keyDown(search(), { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('uses a white focus ring, which stays visible over the dark scrim', () => {
    expect(search()).toHaveClass('focus-visible:ring-white')
    expect(appButtons()[0]).toHaveClass('focus-visible:ring-white')
  })

  it('clicking an app opens it and fades Launchpad out', async () => {
    fireEvent.click(panel().getByRole('button', { name: 'Mail' }))
    expect(useSystem.getState().wm.windows.some((w) => w.appId === 'mail')).toBe(true)
    await waitFor(() => expect(useSystem.getState().overlay).toBeNull())
  })

  it('clicking the background fades out, then closes Launchpad', async () => {
    fireEvent.mouseDown(screen.getByTestId('launchpad-backdrop'))
    expect(screen.getByTestId('launchpad-backdrop')).toHaveClass('launchpad-backdrop-closing')
    expect(useSystem.getState().overlay).toBe('launchpad')
    await waitFor(() => expect(useSystem.getState().overlay).toBeNull())
  })

  it('closes at once under reduce-motion', () => {
    act(() => {
      useSystem.getState().updateSettings({ reduceMotion: true })
    })
    fireEvent.mouseDown(screen.getByTestId('launchpad-backdrop'))
    expect(useSystem.getState().overlay).toBeNull()
  })
})
