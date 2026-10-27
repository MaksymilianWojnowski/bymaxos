import { describe, expect, it } from 'vitest'
import { monthGrid } from './calendar'

describe('monthGrid', () => {
  it('October 2026 starts on Thursday', () => {
    const rows = monthGrid(2026, 9)
    expect(rows[0]).toEqual([null, null, null, null, 1, 2, 3])
    expect(rows).toHaveLength(5)
    expect(rows[4]).toEqual([25, 26, 27, 28, 29, 30, 31])
  })

  it('February 2026 fills exactly four rows', () => {
    const rows = monthGrid(2026, 1)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(rows[3]).toEqual([22, 23, 24, 25, 26, 27, 28])
  })

  it('pads the last row with null', () => {
    const rows = monthGrid(2026, 10)
    expect(rows[rows.length - 1]).toEqual([29, 30, null, null, null, null, null])
    expect(rows.every((r) => r.length === 7)).toBe(true)
  })
})
