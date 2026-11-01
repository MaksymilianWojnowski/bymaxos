import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesktopShell } from '../desktop/DesktopShell'
import { dispatch } from '../../system/commands'
import { resetDeepLinkForTests } from '../../system/shell'
import { resetSystem, useSystem } from '../../system/store'
import { MobileShell } from './MobileShell'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  resetDeepLinkForTests()
  useSystem.setState({ locked: true })
})

afterEach(() => {
  cleanup()
  resetSystem()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

const openedApps = () => useSystem.getState().wm.windows.map((w) => w.appId)
const goTo = (search: string) => window.history.replaceState(null, '', `/${search}`)

describe('MobileShell', () => {
  it('app.open and dock.activate go through the mobile rules: Mail opens, a hidden app does not', () => {
    useSystem.setState({ locked: false })
    render(<MobileShell />)
    expect(dispatch({ type: 'app.open', appId: 'mail' })).toBe(true)
    expect(openedApps()).toContain('mail')

    expect(dispatch({ type: 'app.open', appId: 'quicklook' })).toBe(true)
    expect(openedApps()).not.toContain('quicklook')
  })

  it('dock.activate opens the app full screen', () => {
    useSystem.setState({ locked: false })
    render(<MobileShell />)
    expect(dispatch({ type: 'dock.activate', appId: 'notes' })).toBe(true)
    expect(openedApps()).toContain('notes')
  })

  it('shows the lock screen while locked', () => {
    render(<MobileShell />)
    expect(screen.getByText('Swipe up to unlock')).toBeInTheDocument()
  })

  it('unlocking to home moves focus to the first home control, the profile widget', () => {
    render(<MobileShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(screen.queryByText('Swipe up to unlock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /— open Resume$/ })).toHaveFocus()
  })

  it('opens the search sheet from the Search pill, and the home layer goes inert behind it', () => {
    useSystem.setState({ locked: false })
    render(<MobileShell />)
    const resume = () => screen.getByRole('button', { name: /— open Resume$/, hidden: true })
    expect(resume().closest('[inert]')).toBeNull()
    const pill = screen.getByRole('button', { name: 'Search' })
    pill.focus()
    fireEvent.click(pill)
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus()
    expect(resume().closest('[inert]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(resume().closest('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Search' })).toHaveFocus()
  })

  describe('deep links', () => {
    it('?app=resume while locked: after unlock Resume is open', () => {
      goTo('?app=resume')
      render(<MobileShell />)
      expect(openedApps()).toEqual([])
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
      expect(openedApps()).toEqual(['resume'])
    })

    it('?app=mail opens the Mail sheet', () => {
      goTo('?app=mail')
      useSystem.setState({ locked: false })
      render(<MobileShell />)
      expect(screen.getByRole('dialog', { name: 'Mail' })).toBeInTheDocument()
    })

    it('?app=linkedin is not a deep link: it stays home and opens no tab', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      goTo('?app=linkedin')
      useSystem.setState({ locked: false })
      render(<MobileShell />)
      expect(openedApps()).toEqual([])
      expect(open).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /— open Resume$/ })).toBeInTheDocument()
    })

    it('?app=quicklook (hidden) stays home', () => {
      goTo('?app=quicklook')
      useSystem.setState({ locked: false })
      render(<MobileShell />)
      expect(openedApps()).toEqual([])
    })

    it('?app=notes&item=working-style opens Notes with props.item', () => {
      goTo('?app=notes&item=working-style')
      useSystem.setState({ locked: false })
      render(<MobileShell />)
      expect(useSystem.getState().wm.windows.find((w) => w.appId === 'notes')?.props).toEqual({
        item: 'working-style',
      })
    })

    it('a shell switch (mobile then desktop) does not reopen the app', () => {
      goTo('?app=mail')
      useSystem.setState({ locked: false })
      const mobile = render(<MobileShell />)
      expect(openedApps()).toEqual(['mail'])
      mobile.unmount()
      render(<DesktopShell />)
      expect(openedApps()).toEqual(['mail'])
    })

    it('a shell switch from the home screen stays on home; from an open app it shows that app', () => {
      useSystem.setState({ locked: false })
      const mobile = render(<MobileShell />)
      useSystem.getState().openMobileApp('notes')
      useSystem.getState().goHome()
      mobile.unmount()
      render(<DesktopShell />).unmount()
      render(<MobileShell />)
      expect(screen.getByRole('button', { name: /— open Resume$/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Home' })).toBeNull()
      cleanup()

      useSystem.getState().openMobileApp('notes')
      render(<DesktopShell />).unmount()
      render(<MobileShell />)
      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    })

    it('is handled once per page load: a remount does not reopen the app', () => {
      goTo('?app=mail')
      useSystem.setState({ locked: false })
      const first = render(<MobileShell />)
      const id = useSystem.getState().wm.windows[0].id
      useSystem.getState().close(id)
      first.unmount()
      render(<MobileShell />)
      expect(openedApps()).toEqual([])
    })
  })
})
