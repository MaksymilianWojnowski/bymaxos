import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetSystem, useSystem } from '../../system/store'
import { MobileShell } from './MobileShell'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: true })
})

afterEach(() => {
  cleanup()
  resetSystem()
})

describe('MobileShell', () => {
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
})
