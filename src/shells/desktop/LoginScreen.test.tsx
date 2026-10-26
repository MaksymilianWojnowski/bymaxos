import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LoginScreen } from './LoginScreen'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.documentElement.classList.remove('reduce-motion')
})

describe('LoginScreen', () => {
  it('shows the profile name and initials', () => {
    render(<LoginScreen onUnlock={() => {}} />)
    expect(screen.getByText('Maksymilian Wojnowski')).toBeInTheDocument()
    expect(screen.getByText('MW')).toBeInTheDocument()
  })

  it('unlocks immediately on Enter when reduce-motion is set', () => {
    document.documentElement.classList.add('reduce-motion')
    const onUnlock = vi.fn()
    render(<LoginScreen onUnlock={onUnlock} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Unlock' }), { key: 'Enter' })
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('unlocks on click after the 300ms animation', () => {
    vi.useFakeTimers()
    const onUnlock = vi.fn()
    render(<LoginScreen onUnlock={onUnlock} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(onUnlock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })
})
