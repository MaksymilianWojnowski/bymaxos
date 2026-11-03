import { afterEach, beforeEach, it, expect, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import App from './App'
import { resetSystem, useSystem } from './system/store'

// Lets a test flip the narrow-viewport query and notify the listeners, as a resize would.
let narrow = false
const listeners = new Set<() => void>()

beforeEach(() => {
  narrow = false
  listeners.clear()
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(max-width: 767px)' && narrow,
        media: query,
        onchange: null,
        addEventListener: (_type: string, fn: () => void) => {
          listeners.add(fn)
        },
        removeEventListener: (_type: string, fn: () => void) => {
          listeners.delete(fn)
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('renders the bymaxOS root', () => {
  render(<App />)
  expect(screen.getByTestId('bymaxos-root')).toBeInTheDocument()
})

it('sets data-shell to desktop, and to mobile after the narrow query flips', () => {
  render(<App />)
  expect(document.documentElement.dataset.shell).toBe('desktop')

  narrow = true
  act(() => {
    listeners.forEach((fn) => fn())
  })

  expect(document.documentElement.dataset.shell).toBe('mobile')
})

it('switching the shell from desktop to mobile keeps the open windows (the focused one is shown)', async () => {
  resetSystem()
  useSystem.setState({ locked: false })
  useSystem.getState().openApp('about')
  useSystem.getState().openApp('contacts')
  render(<App />)
  expect(screen.getByTestId('desktop')).toBeInTheDocument()

  narrow = true
  act(() => {
    listeners.forEach((fn) => fn())
  })

  expect(screen.queryByTestId('desktop')).toBeNull()
  expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  expect(useSystem.getState().wm.windows).toHaveLength(2)
})
