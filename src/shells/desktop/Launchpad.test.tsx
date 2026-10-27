import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('clicking an app opens it and closes Launchpad', () => {
    fireEvent.click(panel().getByRole('button', { name: 'Mail' }))
    expect(useSystem.getState().wm.windows.some((w) => w.appId === 'mail')).toBe(true)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('clicking the background closes Launchpad', () => {
    fireEvent.mouseDown(screen.getByTestId('launchpad-backdrop'))
    expect(useSystem.getState().overlay).toBeNull()
  })
})
