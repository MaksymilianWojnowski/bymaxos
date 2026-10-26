import { describe, expect, it } from 'vitest'
import { resizeRect } from './resize'

const start = { x: 100, y: 100, w: 500, h: 400 }
const min = { w: 300, h: 200 }

describe('resizeRect', () => {
  it('grows from the south-east corner', () => {
    expect(resizeRect(start, 'se', 50, 30, min)).toEqual({ x: 100, y: 100, w: 550, h: 430 })
  })

  it('moves the origin when resizing from the north-west corner', () => {
    expect(resizeRect(start, 'nw', 50, 30, min)).toEqual({ x: 150, y: 130, w: 450, h: 370 })
  })

  it('stops moving the origin once the minimum width is reached', () => {
    expect(resizeRect(start, 'w', 400, 0, min)).toEqual({ x: 300, y: 100, w: 300, h: 400 })
  })
})
