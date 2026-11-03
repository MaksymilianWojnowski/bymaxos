import { describe, expect, it } from 'vitest'
import { pageFromScroll, releaseVelocity, rubberBand, shouldEdgeBack, shouldUnlock } from './gestures'

describe('pageFromScroll', () => {
  it('picks the nearest page and clamps to the first and last', () => {
    expect(pageFromScroll(0, 390, 2)).toBe(0)
    expect(pageFromScroll(200, 390, 2)).toBe(1)
    expect(pageFromScroll(5000, 390, 2)).toBe(1)
    expect(pageFromScroll(-10, 390, 2)).toBe(0)
  })
})

describe('rubberBand', () => {
  it('does not move at rest', () => {
    expect(rubberBand(0, 800)).toBe(0)
  })

  it('resists more the further it is pulled', () => {
    expect(rubberBand(100, 800)).toBeCloseTo(51.46, 2)
    expect(rubberBand(800, 800)).toBeCloseTo(283.87, 2)
  })
})

describe('releaseVelocity', () => {
  it('measures upward speed over the trailing 100ms', () => {
    const samples = [
      { y: 500, t: 0 },
      { y: 400, t: 40 },
    ]
    expect(releaseVelocity(samples, 40)).toBe(2.5)
  })

  it('is zero when the finger stopped more than 80ms before lifting', () => {
    const samples = [
      { y: 500, t: 0 },
      { y: 400, t: 20 },
    ]
    expect(releaseVelocity(samples, 320)).toBe(0)
  })

  it('ignores samples older than the window', () => {
    const samples = [
      { y: 900, t: 0 },
      { y: 500, t: 300 },
      { y: 400, t: 340 },
    ]
    expect(releaseVelocity(samples, 340)).toBe(2.5)
  })

  it('is zero with no samples or a single one', () => {
    expect(releaseVelocity([], 0)).toBe(0)
    expect(releaseVelocity([{ y: 400, t: 0 }], 0)).toBe(0)
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

describe('shouldEdgeBack', () => {
  it('edge swipe past 30% goes back', () => {
    expect(shouldEdgeBack(10, 120, 5, 390, 0)).toBe(true)
  })

  it('a flick past 5% goes back', () => {
    expect(shouldEdgeBack(10, 25, 0, 390, 0.5)).toBe(true)
  })

  it('a start beyond 24px does not', () => {
    expect(shouldEdgeBack(30, 200, 0, 390, 2)).toBe(false)
  })

  it('a mostly vertical drag does not', () => {
    expect(shouldEdgeBack(10, 100, 120, 390, 2)).toBe(false)
  })

  it('a leftward drag does not', () => {
    expect(shouldEdgeBack(10, -200, 0, 390, 2)).toBe(false)
  })
})
