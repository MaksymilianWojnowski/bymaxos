import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetSystem, useSystem } from '../../system/store'
import { StatusArea } from './StatusArea'

beforeEach(() => {
  resetSystem()
  render(<StatusArea />)
})

afterEach(() => {
  cleanup()
})

describe('StatusArea', () => {
  it('the clock is a button named Notification Center that toggles the panel', () => {
    const clock = screen.getByRole('button', { name: 'Notification Center' })
    expect(clock).toHaveAttribute('aria-expanded', 'false')
    expect(clock.querySelector('time')).not.toBeNull()

    fireEvent.click(clock)
    expect(useSystem.getState().overlay).toBe('notificationCenter')
    expect(clock).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(clock)
    expect(useSystem.getState().overlay).toBeNull()
    expect(clock).toHaveAttribute('aria-expanded', 'false')
  })
})
