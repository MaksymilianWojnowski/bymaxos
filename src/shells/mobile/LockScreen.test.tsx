import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
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

// fireEvent drops a timeStamp init key, and velocity needs the event time, so it is set on the event itself.
const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', node: HTMLElement, clientY: number, timeStamp: number) => {
  const event = createEvent[type](node, { clientX: 200, clientY })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  fireEvent(node, event)
}

describe('LockScreen', () => {
  it('shows the large clock, the date, the status bar and the swipe hint', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 9, 41))
    render(<LockScreen />)
    expect(screen.getByText('Thursday, October 29')).toBeInTheDocument()
    expect(screen.getAllByText('09:41')).toHaveLength(2)
    expect(screen.getByText('Swipe up to unlock')).toBeInTheDocument()
  })

  it('keeps the status bar and lock content clear of the side safe areas', () => {
    render(<LockScreen />)
    expect(document.querySelector('time')?.parentElement).toHaveClass(
      'pl-[max(1.5rem,env(safe-area-inset-left))]',
      'pr-[max(1.5rem,env(safe-area-inset-right))]',
    )
    expect(screen.getByText('Swipe up to unlock').parentElement).toHaveClass(
      'pl-[max(2rem,env(safe-area-inset-left))]',
      'pr-[max(2rem,env(safe-area-inset-right))]',
    )
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

  it('after ✕ focus moves to the next card\'s ✕', () => {
    render(<LockScreen />)
    const welcomeX = screen.getByRole('button', { name: 'Dismiss Welcome to bymaxOS' })
    welcomeX.focus()
    fireEvent.click(welcomeX)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dismiss Open to new roles' }))
  })

  it('after the last card is dismissed focus goes to the screen, so Enter still unlocks', () => {
    render(<LockScreen />)
    for (const n of notifications.slice(0, -1)) {
      fireEvent.click(screen.getByRole('button', { name: `Dismiss ${n.title}` }))
    }
    const lastX = screen.getByRole('button', { name: 'Dismiss Code on GitHub' })
    lastX.focus()
    fireEvent.click(lastX)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(screenEl())
    fireEvent.keyDown(screenEl(), { key: 'Enter' })
    expect(isLocked()).toBe(false)
  })

  it('a fast short flick past 5% unlocks', () => {
    vi.useFakeTimers()
    render(<LockScreen />)
    const screenNode = screenEl()
    pointer('pointerDown', screenNode, 500, 1000)
    pointer('pointerMove', screenNode, 400, 1040)
    pointer('pointerUp', screenNode, 400, 1040)
    act(() => vi.advanceTimersByTime(300))
    expect(isLocked()).toBe(false)
  })

  it('a fast drag that then holds still for 300ms and lifts stays locked and springs back', () => {
    vi.useFakeTimers()
    render(<LockScreen />)
    const screenNode = screenEl()
    pointer('pointerDown', screenNode, 500, 1000)
    pointer('pointerMove', screenNode, 400, 1020)
    pointer('pointerUp', screenNode, 400, 1320)
    act(() => vi.advanceTimersByTime(300))
    expect(isLocked()).toBe(true)
    expect(content().style.transform).toBe('none')
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

  it('a vertical drag that starts on a card unlocks', () => {
    vi.useFakeTimers()
    render(<LockScreen />)
    const welcome = card('Welcome to bymaxOS')
    fireEvent.pointerDown(welcome, { clientX: 200, clientY: HEIGHT - 50 })
    fireEvent.pointerMove(welcome, { clientX: 200, clientY: 50 })
    fireEvent.pointerUp(welcome, { clientX: 200, clientY: 50 })
    act(() => vi.advanceTimersByTime(300))
    expect(isLocked()).toBe(false)
  })

  it('a sideways drag on a card neither lifts the screen nor unlocks it', () => {
    render(<LockScreen />)
    const welcome = card('Welcome to bymaxOS')
    fireEvent.pointerDown(welcome, { clientX: 300, clientY: 400 })
    fireEvent.pointerMove(welcome, { clientX: 250, clientY: 400 })
    expect(content().style.transform).toBe('none')
    fireEvent.pointerUp(welcome, { clientX: 250, clientY: 400 })
    expect(isLocked()).toBe(true)
    expect(screen.getByText('Welcome to bymaxOS')).toBeInTheDocument()
  })

  it('the Unlock button and Enter unlock', () => {
    const { unmount } = render(<LockScreen />)
    // Enter is consumed here, so the keypress does not also activate the home control focus moves to.
    expect(fireEvent.keyDown(screenEl(), { key: 'Enter' })).toBe(false)
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
    const layer = screen.getByRole('button', { name: 'Tap to turn off flashlight' })
    expect(layer).toHaveFocus()

    fireEvent.click(layer)
    expect(screen.queryByRole('button', { name: 'Tap to turn off flashlight' })).not.toBeInTheDocument()
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
