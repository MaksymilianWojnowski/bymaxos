import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Switch } from './Switch'

afterEach(() => {
  cleanup()
})

describe('Switch', () => {
  it('gives the checked knob the window colour in dark mode, so it contrasts with the accent track', () => {
    render(<Switch label="Reduce motion" checked onChange={() => {}} />)
    const knob = screen.getByRole('switch').querySelector('span > span')
    expect(knob).toHaveClass('dark:bg-window')
  })
})
