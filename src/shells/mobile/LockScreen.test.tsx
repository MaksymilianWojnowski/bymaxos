import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { getContent } from '../../content'
import { readDismissed } from '../../system/notifications'
import { resetSystem, useSystem } from '../../system/store'
import { KEYS } from '../../system/storage'
import { LockScreen } from './LockScreen'

const notifications = getContent().notifications
const HEIGHT = window.innerHeight

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.documentElement.classList.remove('reduce-motion')
  resetSystem()
})

// The drag area is the screen itself; its content layer carries the transform.
const screenEl = () => document.activeElement as HTMLElement
const content = () => document.querySelector('[data-lock-content]') as HTMLElement
const card = (title: string) => screen.getByText(title).closest('[data-card]') as HTMLElement
const isLocked = () => useSystem.getState().locked

describe('LockScreen', () => {
  it('shows the large clock, the date, the status bar and the swipe hint', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 9, 41))
    render(<LockScreen />)
    expect(screen.getByText('Thursday, October 29')).toBeInTheDocument()
    expect(screen.getAllByText('09:41')).toHaveLength(2)
    expect(screen.getByText('Swipe up to unlock')).toBeInTheDocument()
  })

  it('lists content notifications; the ✕ button and a left swipe over 80px dismiss one and persist it', () => {
    render(<LockScreen />)
    for (const n of notifications) expect(screen.getByText(n.title)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Code on GitHub' }))
    expect(screen.queryByText('Code on GitHub')).not.toBeInTheDocument()
    expect(readDismissed()).toEqual(['github'])

    const welcome = card('Welcome to bymaxOS')
    fireEvent.pointerDown(welcome, { clientX: 300, clientY: 400 })
    fireEvent.pointerMove(welcome, { clientX: 250, clientY: 400 })
    fireEvent.pointerUp(welcome, { clientX: 250, clientY: 400 })
    expect(screen.queryByText('Welcome to bymaxOS')).toBeInTheDocument()
    expect(readDismissed()).toEqual(['github'])

    fireEvent.pointerDown(welcome, { clientX: 300, clientY: 400 })
    fireEvent.pointerMove(welcome, { clientX: 200, clientY: 400 })
    fireEvent.pointerMove(welcome, { clientX: 150, clientY: 400 })
    fireEvent.pointerUp(welcome, { clientX: 150, clientY: 400 })
    expect(screen.queryByText('Welcome to bymaxOS')).not.toBeInTheDocument()
    expect(readDismissed()).toEqual(['github', 'welcome'])
  })

  it('a drag up past the threshold unlocks after the settle animation', () => {
    vi.useFakeTimers()
    render(<LockScreen />)
    const screenNode = screenEl()
    fireEvent.pointerDown(screenNode, { clientX: 200, clientY: HEIGHT - 50 })
    fireEvent.pointerMove(screenNode, { clientX: 200, clientY: 50 })
    fireEvent.pointerUp(screenNode, { clientX: 200, clientY: 50 })
    expect(content().style.transform).toBe('translateY(-100%)')
    expect(isLocked()).toBe(true)
    act(() => vi.advanceTimersByTime(300))
    expect(isLocked()).toBe(false)
  })

  it('a short slow drag springs back, the transform returns to none, and the screen stays locked', () => {
    vi.useFakeTimers()
    render(<LockScreen />)
    const screenNode = screenEl()
    fireEvent.pointerDown(screenNode, { clientX: 200, clientY: 500 })
    // 500ms for 50px is 0.1px/ms, well under a flick.
    vi.advanceTimersByTime(500)
    fireEvent.pointerMove(screenNode, { clientX: 200, clientY: 450 })
    expect(content().style.transform).toMatch(/^translateY\(-/)
    fireEvent.pointerUp(screenNode, { clientX: 200, clientY: 450 })
    act(() => vi.advanceTimersByTime(300))
    expect(content().style.transform).toBe('none')
    expect(isLocked()).toBe(true)
  })

  it('the Unlock button and Enter unlock', () => {
    const { unmount } = render(<LockScreen />)
    fireEvent.keyDown(screenEl(), { key: 'Enter' })
    expect(isLocked()).toBe(false)
    unmount()

    useSystem.setState({ locked: true })
    render(<LockScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(isLocked()).toBe(false)
  })

  it('Flashlight toggles a full-screen white layer; tapping the layer turns it off and focus returns to the button', () => {
    render(<LockScreen />)
    const flashlight = screen.getByRole('button', { name: 'Flashlight' })
    expect(flashlight).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(flashlight)
    expect(flashlight).toHaveAttribute('aria-pressed', 'true')
    const layer = screen.getByRole('button', { name: 'Turn off flashlight' })
    expect(layer).toHaveFocus()

    fireEvent.click(layer)
    expect(screen.queryByRole('button', { name: 'Turn off flashlight' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flashlight' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Flashlight' })).toHaveFocus()
  })

  it('Camera unlocks and opens Photos', () => {
    const openMobileApp = vi.fn()
    useSystem.setState({ openMobileApp })
    render(<LockScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Camera' }))
    expect(openMobileApp).toHaveBeenCalledWith('photos')
    expect(isLocked()).toBe(false)
  })

  it('a resize during a drag cancels it and resets the transform', () => {
    render(<LockScreen />)
    const screenNode = screenEl()
    fireEvent.pointerDown(screenNode, { clientX: 200, clientY: 500 })
    fireEvent.pointerMove(screenNode, { clientX: 200, clientY: 400 })
    expect(content().style.transform).toMatch(/^translateY\(-/)
    fireEvent(window, new Event('resize'))
    expect(content().style.transform).toBe('none')
    fireEvent.pointerUp(screenNode, { clientX: 200, clientY: 400 })
    expect(isLocked()).toBe(true)
    expect(content().style.transform).toBe('none')
  })

  it('a corrupt stored dismissal list shows every notification', () => {
    window.sessionStorage.setItem(KEYS.notifications, '{bad json')
    render(<LockScreen />)
    expect(screen.getByText('Code on GitHub')).toBeInTheDocument()
  })
})
