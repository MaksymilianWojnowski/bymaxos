import { describe, expect, it } from 'vitest'
import { rubberBand, shouldUnlock } from './gestures'

describe('rubberBand', () => {
  it('does not move at rest', () => {
    expect(rubberBand(0, 800)).toBe(0)
  })

  it('resists more the further it is pulled', () => {
    expect(rubberBand(100, 800)).toBeCloseTo(51.46, 2)
    expect(rubberBand(800, 800)).toBeCloseTo(283.87, 2)
  })
})

describe('shouldUnlock', () => {
  it('unlocks at exactly 30% of the height', () => {
    expect(shouldUnlock(240, 800, 0)).toBe(true)
    expect(shouldUnlock(239, 800, 0.49)).toBe(false)
  })

  it('unlocks on a quick flick of at least 5% of the height', () => {
    expect(shouldUnlock(40, 800, 0.5)).toBe(true)
  })

  it('never unlocks on a downward drag', () => {
    expect(shouldUnlock(-50, 800, 2)).toBe(false)
  })
})
