import { describe, expect, it } from 'vitest'
import { formatDate, formatMonth, formatRange } from './format'

describe('format', () => {
  it('formats a year-month as an abbreviated month and year', () => {
    expect(formatMonth('2025-10')).toBe('Oct 2025')
  })

  it('formats a range with an en dash, Present for an open end', () => {
    expect(formatRange('2025-10')).toBe('Oct 2025 – Present')
    expect(formatRange('2024-07', '2025-09')).toBe('Jul 2024 – Sep 2025')
  })

  it('formats an ISO timestamp as a short date', () => {
    expect(formatDate('2026-10-12T12:00:00Z')).toBe('Oct 12, 2026')
  })
})
