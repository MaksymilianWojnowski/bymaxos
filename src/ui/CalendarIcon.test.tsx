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

// The icon is an SVG image; its text and colours live in the decoded data URL.
const drawn = (container: HTMLElement) =>
  decodeURIComponent(container.querySelector('img')!.getAttribute('src')!)

describe('CalendarIcon', () => {
  it('desktop shows the month and the day', () => {
    const { container } = render(<CalendarIcon size={128} />)
    expect(drawn(container)).toContain('NOV')
    expect(drawn(container)).toContain('>7<')
  })

  it('phone shows the weekday and the day', () => {
    shell.value = 'mobile'
    const { container } = render(<CalendarIcon size={128} />)
    expect(drawn(container)).toContain('Saturday')
    expect(drawn(container)).toContain('>7<')
  })

  it('the date rolls over at midnight', () => {
    shell.value = 'mobile'
    const { container } = render(<CalendarIcon size={128} />)
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(drawn(container)).toContain('Sunday')
    expect(drawn(container)).toContain('>8<')
    expect(drawn(container)).not.toContain('>7<')
  })

  it('the dark variant uses a dark tile', () => {
    const { container } = render(<CalendarIcon size={128} dark />)
    expect(drawn(container)).toContain('#1c1c1e')
  })
})
