import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarIcon } from './CalendarIcon'

const shell = vi.hoisted(() => ({ value: 'desktop' as 'desktop' | 'mobile' }))

vi.mock('../system/shell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../system/shell')>()),
  useShell: () => shell.value,
}))

// Saturday 7 November 2026, 10 seconds before midnight.
const START = new Date(2026, 10, 7, 23, 59, 50)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  shell.value = 'desktop'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CalendarIcon', () => {
  it('desktop shows the month and the day', () => {
    const { container } = render(<CalendarIcon size={128} />)
    expect(container.textContent).toContain('NOV')
    expect(container.textContent).toContain('7')
  })

  it('phone shows the weekday and the day', () => {
    shell.value = 'mobile'
    const { container } = render(<CalendarIcon size={128} />)
    expect(container.textContent).toContain('Saturday')
    expect(container.textContent).toContain('7')
  })

  it('the date rolls over at midnight', () => {
    shell.value = 'mobile'
    const { container } = render(<CalendarIcon size={128} />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(container.textContent).toContain('Sunday')
    expect(container.textContent).toContain('8')
    expect(container.textContent).not.toContain('7')
  })

  it('the dark variant uses a dark tile', () => {
    const { container } = render(<CalendarIcon size={128} dark />)
    const tile = container.firstElementChild?.firstElementChild as HTMLElement
    expect(tile).toHaveStyle({ backgroundColor: '#1c1c1e' })
  })
})
