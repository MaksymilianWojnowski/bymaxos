import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { mobileDockApps, mobileHomeApps } from '../../apps/registry'
import { resetSystem, useSystem } from '../../system/store'
import { HomeScreen } from './HomeScreen'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetSystem()
})

const renderHome = (onSearch = vi.fn()) => {
  render(<HomeScreen onSearch={onSearch} />)
  return onSearch
}

// The horizontal pager that holds both pages; the page sections are its children.
const scrollerOf = () => screen.getByRole('button', { name: /— open Resume$/ }).closest('section')!.parentElement!

// The pull is a touch gesture, so it is sent as touch events on the first page.
const touch = (type: 'touchStart' | 'touchEnd', el: HTMLElement, clientX: number, clientY: number) =>
  fireEvent[type](el, { touches: [{ clientX, clientY }], changedTouches: [{ clientX, clientY }] })

describe('HomeScreen', () => {
  it('page 1 has a profile widget that opens Resume and a calendar widget that opens Calendar', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: /— open Resume$/ }))
    expect(useSystem.getState().wm.windows.map((w) => w.appId)).toEqual(['resume'])
    fireEvent.click(screen.getByRole('button', { name: /— open Calendar$/ }))
    expect(useSystem.getState().wm.windows.map((w) => w.appId)).toEqual(['resume', 'calendar'])
  })

  it('page 1 grid shows every mobileHomeApps() app as a button named after the app; tapping opens it', () => {
    renderHome()
    const app = mobileHomeApps()[0]
    fireEvent.click(screen.getByRole('button', { name: app.name }))
    expect(useSystem.getState().wm.windows.map((w) => w.appId)).toContain(app.id)
  })

  it('page 2 shows mobileLinkApps() (LinkedIn, GitHub) which open in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderHome()
    fireEvent.click(screen.getByRole('tab', { name: 'Page 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }))
    expect(open).toHaveBeenCalledWith(
      'https://www.linkedin.com/in/maksymilian-wojnowski-647585254/',
      '_blank',
      'noopener,noreferrer',
    )
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument()
    expect(mobileDockApps().map((a) => a.id)).toEqual(['contacts', 'mail', 'safari', 'resume'])
  })

  it('page dots are a tablist with 2 tabs; tapping dot 2 selects it and arrow keys move between them', () => {
    renderHome()
    const tabs = screen.getByRole('tablist', { name: 'Home screen pages' })
    const [first, second] = screen.getAllByRole('tab')
    expect(tabs).toContainElement(second)
    expect(first).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
    fireEvent.keyDown(second, { key: 'ArrowLeft' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveFocus()
  })

  it('the dock shows Contacts, Mail, Safari, Resume', () => {
    renderHome()
    for (const name of ['Contacts', 'Mail', 'Safari', 'Resume']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('grid is 4 columns, switching to 6 on short (landscape) screens via CSS, not the store viewport', () => {
    render(<HomeScreen onSearch={vi.fn()} />)
    const grid = screen.getByRole('button', { name: mobileHomeApps()[0].name }).closest('ul')
    expect(grid).toHaveClass('grid-cols-4', '[@media(max-height:500px)]:grid-cols-6')
  })

  it('pulling down on page 1 by more than 60px opens search', () => {
    const onSearch = renderHome()
    const page = screen.getByRole('button', { name: /— open Resume$/ }).closest('section')!
    touch('touchStart', page, 100, 100)
    touch('touchEnd', page, 100, 170)
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('a pull of 60px or less, or a mostly sideways drag, does not open search', () => {
    const onSearch = renderHome()
    const page = screen.getByRole('button', { name: /— open Resume$/ }).closest('section')!
    touch('touchStart', page, 100, 100)
    touch('touchEnd', page, 100, 160)
    touch('touchStart', page, 100, 100)
    touch('touchEnd', page, 20, 180)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('dots keep the tapped page while its scroll is in flight, and follow the scroll once it lands', () => {
    renderHome()
    const [first, second] = screen.getAllByRole('tab')
    const scroller = scrollerOf()
    Object.defineProperty(scroller, 'clientWidth', { value: 390, configurable: true })
    fireEvent.click(second)
    // An intermediate offset during the smooth scroll leaves page 2 selected.
    scroller.scrollLeft = 100
    fireEvent.scroll(scroller)
    expect(second).toHaveAttribute('aria-selected', 'true')
    // Landing on page 2 ends the flight; scrolling back then moves the dots.
    scroller.scrollLeft = 390
    fireEvent(scroller, new Event('scrollend'))
    expect(second).toHaveAttribute('aria-selected', 'true')
    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveAttribute('aria-selected', 'false')
  })

  it('ends the flight after 500ms when scrollend never fires', () => {
    renderHome()
    const [first, second] = screen.getAllByRole('tab')
    const scroller = scrollerOf()
    Object.defineProperty(scroller, 'clientWidth', { value: 390, configurable: true })
    fireEvent.click(second)
    scroller.scrollLeft = 390
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(second).toHaveAttribute('aria-selected', 'true')
    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)
    expect(first).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the home controls clear of the side safe areas', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /— open Resume$/ }).closest('ul')).toHaveClass(
      'pl-[max(1rem,env(safe-area-inset-left))]',
      'pr-[max(1rem,env(safe-area-inset-right))]',
    )
    const row = screen.getByRole('tablist').parentElement
    expect(row).toHaveClass(
      'pl-[max(0px,env(safe-area-inset-left))]',
      'pr-[max(0px,env(safe-area-inset-right))]',
    )
    expect(row).toContainElement(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('toolbar', { name: 'Dock' })).toHaveClass(
      'ml-[max(0.75rem,env(safe-area-inset-left))]',
      'mr-[max(0.75rem,env(safe-area-inset-right))]',
    )
  })

  it('dock buttons show a light-theme-safe accent focus ring; grid tiles keep the white one over the wallpaper', () => {
    renderHome()
    expect(screen.getByRole('button', { name: 'Mail' })).toHaveClass(
      'focus-visible:ring-accent-link',
      'dark:focus-visible:ring-white',
    )
    expect(screen.getByRole('button', { name: 'Mail' })).not.toHaveClass('focus-visible:ring-white')
    expect(screen.getByRole('button', { name: /— open Resume$/ })).toHaveClass('focus-visible:ring-white')
  })

  it('the Search button opens search', () => {
    const onSearch = renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })
})
