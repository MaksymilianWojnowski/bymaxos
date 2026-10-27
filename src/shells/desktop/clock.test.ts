import { describe, expect, it } from 'vitest'
import { formatMenuClock } from './clock'

describe('formatMenuClock', () => {
  it('formats the weekday, date and 12-hour time with two spaces before the time', () => {
    expect(formatMenuClock(new Date(2026, 9, 26, 17, 8))).toBe('Mon Oct 26  5:08 PM')
  })

  it('shows midnight and noon as 12', () => {
    expect(formatMenuClock(new Date(2026, 9, 26, 0, 3))).toBe('Mon Oct 26  12:03 AM')
    expect(formatMenuClock(new Date(2026, 9, 26, 12, 0))).toBe('Mon Oct 26  12:00 PM')
  })
})
