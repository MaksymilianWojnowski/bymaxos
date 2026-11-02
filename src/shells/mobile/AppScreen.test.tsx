import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { getApp } from '../../apps/registry'
import { dispatch, installSystemCommands } from '../../system/commands'
import { resetSystem, setAppLookup, setAppResolver, useSystem } from '../../system/store'
import type { WindowSpec } from '../../system/types'
import { AppScreen } from './AppScreen'
import { MobileShell } from './MobileShell'

vi.mock('../../apps/registry', async () => {
  const { createPortal } = await import('react-dom')
  // Like Mail's own sheet, a portal: its keys reach the app's React tree without reaching its DOM.
  const mailWithSheet = () => (
    <>
      <p>mail content</p>
      {createPortal(
        <div role="dialog" aria-label="Finish in your email app">
          <p>Draft</p>
        </div>,
        document.body,
      )}
    </>
  )
  const app = (id: string, name: string, presentation?: 'sheet') => ({
    id,
    name,
    icon: { glyph: () => null, background: '#000' },
    load: () => Promise.resolve({ default: id === 'mail' ? mailWithSheet : () => <p>{`${id} content`}</p> }),
    window: {
      defaultSize: { w: 600, h: 400 },
      minSize: { w: 300, h: 200 },
      resizable: true,
      singleInstance: false,
    },
    mobile: presentation ? { presentation } : undefined,
  })
  const apps = [app('finder', 'Finder'), app('resume', 'Resume'), app('mail', 'Mail', 'sheet')]
  return {
    getApp: (id: string) => apps.find((a) => a.id === id),
    mobileHomeApps: () => [apps[0]],
    mobileDockApps: () => [apps[1]],
    mobileLinkApps: () => [],
  }
})

const spec = (appId: string): WindowSpec => ({
  appId,
  title: appId,
  defaultSize: { w: 600, h: 400 },
  minSize: { w: 300, h: 200 },
  singleInstance: appId === 'mail',
  resizable: true,
})

let uninstall: () => void

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  setAppResolver(spec)
  // The registry is mocked here, so the store needs its lookup injected by hand.
  setAppLookup(getApp)
  uninstall = installSystemCommands()
})

afterEach(() => {
  cleanup()
  uninstall()
})

describe('AppScreen', () => {
  it('renders the focused window\'s app full screen with a status bar and a home indicator button named "Home"', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    expect(await screen.findByText('finder content')).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('moves focus into the app region when an app opens', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    const content = await screen.findByText('finder content')
    expect(document.activeElement).toBe(content.closest('[tabindex="-1"]'))
  })

  it('Home (click, Enter, or an upward swipe of at least 60px on the indicator) calls goHome', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    const home = await screen.findByRole('button', { name: 'Home' })

    fireEvent.click(home)
    expect(useSystem.getState().mobileHome).toBe(true)

    useSystem.getState().openMobileApp('finder')
    fireEvent.pointerDown(home, { clientY: 500 })
    fireEvent.pointerUp(home, { clientY: 430 })
    expect(useSystem.getState().mobileHome).toBe(true)
  })

  it('a drag that ends without a click does not swallow the next keyboard activation of Home', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    const home = await screen.findByRole('button', { name: 'Home' })
    fireEvent.pointerDown(home, { clientY: 500 })
    fireEvent.pointerUp(home, { clientY: 470 })
    expect(useSystem.getState().mobileHome).toBe(false)
    fireEvent.click(home, { detail: 0 })
    expect(useSystem.getState().mobileHome).toBe(true)
  })

  it('a swipe shorter than 60px does not go home', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    const home = await screen.findByRole('button', { name: 'Home' })
    fireEvent.pointerDown(home, { clientY: 500 })
    fireEvent.pointerUp(home, { clientY: 470 })
    expect(useSystem.getState().mobileHome).toBe(false)
  })

  it('a sheet app (Mail) renders in a dialog named after the app, with a Close button that goes home', async () => {
    useSystem.getState().openMobileApp('mail')
    render(<AppScreen />)
    expect(await screen.findByRole('dialog', { name: 'Mail' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useSystem.getState().mobileHome).toBe(true)
  })

  it('keeps the home screen behind a sheet, hidden from assistive technology', async () => {
    useSystem.getState().openMobileApp('mail')
    render(<MobileShell />)
    await screen.findByRole('dialog', { name: 'Mail' })
    const homeApp = screen.getByRole('button', { name: 'Finder', hidden: true })
    expect(homeApp.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('home buttons behind a sheet are inert, so focus cannot reach them', async () => {
    useSystem.getState().openMobileApp('mail')
    render(<MobileShell />)
    await screen.findByRole('dialog', { name: 'Mail' })
    const homeApp = screen.getByRole('button', { name: 'Finder', hidden: true })
    expect(homeApp.closest('[inert]')).not.toBeNull()
  })

  it('labels the app region with the app name', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    expect(await screen.findByRole('region', { name: 'Finder' })).toBeInTheDocument()
  })

  it('Escape closes the Mail sheet to the home screen', async () => {
    useSystem.getState().openMobileApp('mail')
    render(<AppScreen />)
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Mail' }), { key: 'Escape' })
    expect(useSystem.getState().mobileHome).toBe(true)
  })

  it('Escape from a sheet inside the Mail app closes only that sheet, not Mail', async () => {
    useSystem.getState().openMobileApp('mail')
    render(<AppScreen />)
    await screen.findByText('mail content')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Finish in your email app' }), { key: 'Escape' })
    expect(useSystem.getState().mobileHome).toBe(false)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Mail' }), { key: 'Escape' })
    expect(useSystem.getState().mobileHome).toBe(true)
  })

  it('clears the notch sideways in the app region and in the sheet dialog', async () => {
    useSystem.getState().openMobileApp('finder')
    const { unmount } = render(<AppScreen />)
    const region = (await screen.findByText('finder content')).closest('[tabindex="-1"]')
    expect(region).toHaveClass('pl-[env(safe-area-inset-left)]', 'pr-[env(safe-area-inset-right)]')
    unmount()

    useSystem.getState().openMobileApp('mail')
    render(<AppScreen />)
    expect(await screen.findByRole('dialog', { name: 'Mail' })).toHaveClass(
      'pl-[env(safe-area-inset-left)]',
      'pr-[env(safe-area-inset-right)]',
    )
  })

  it('app.open dispatched from inside an app (Resume to Mail) brings the new window to the foreground', async () => {
    useSystem.getState().openMobileApp('finder')
    render(<AppScreen />)
    await screen.findByText('finder content')
    act(() => {
      dispatch({ type: 'app.open', appId: 'resume' })
    })
    expect(await screen.findByText('resume content')).toBeInTheDocument()
    expect(useSystem.getState().wm.windows).toHaveLength(2)
  })
})
