import { describe, expect, it } from 'vitest'
import { genieKeyframes, stripCount, type Box } from './genie'

const from: Box = { x: 100, y: 300, width: 400, height: 200 }
const to: Box = { x: 600, y: 640, width: 80, height: 60 }

function parse(transform: Keyframe['transform']) {
  const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+), (-?[\d.]+)\)$/.exec(String(transform))
  if (!m) throw new Error(`unparsable transform: ${transform}`)
  return { tx: Number(m[1]), ty: Number(m[2]), sx: Number(m[3]), sy: Number(m[4]) }
}

// Maps a point of the strip element (window space) through the frame transform.
function map(box: Box, t: ReturnType<typeof parse>, px: number, py: number) {
  return {
    x: box.x + t.tx + (px - box.x) * t.sx,
    y: box.y + t.ty + (py - box.y) * t.sy,
  }
}

describe('stripCount', () => {
  it('gives 32 strips for small windows, 8 at the floor, and null above 5000 nodes', () => {
    expect(stripCount(100)).toBe(32)
    expect(stripCount(4000)).toBe(10)
    expect(stripCount(5000)).toBe(8)
    expect(stripCount(5001)).toBeNull()
  })
})

describe('genieKeyframes', () => {
  it('the first frame of every strip is the identity', () => {
    const strips = genieKeyframes(from, to, 4, 10)
    for (const frames of strips) {
      expect(frames[0].transform).toBe('translate(0px, 0px) scale(1, 1)')
    }
  })

  it('the last frame of every strip lies inside the icon box', () => {
    const n = 4
    const strips = genieKeyframes(from, to, n, 10)
    strips.forEach((frames, i) => {
      const t = parse(frames[frames.length - 1].transform)
      const top = from.y + (i * from.height) / n
      const bottom = from.y + ((i + 1) * from.height) / n
      const a = map(from, t, from.x, top)
      const b = map(from, t, from.x + from.width, bottom)
      expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(to.x - 0.5)
      expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(to.x + to.width + 0.5)
      expect(Math.min(a.y, b.y)).toBeGreaterThanOrEqual(to.y - 0.5)
      expect(Math.max(a.y, b.y)).toBeLessThanOrEqual(to.y + to.height + 0.5)
    })
  })

  it('bottom strips move first', () => {
    const n = 4
    const strips = genieKeyframes(from, to, n, 10)
    const mid = 5
    const widthAt = (i: number) => {
      const t = parse(strips[i][mid].transform)
      const left = map(from, t, from.x, 0).x
      const right = map(from, t, from.x + from.width, 0).x
      return right - left
    }
    // Width shrinks from 400 towards 80, so a smaller width means more progress.
    expect(widthAt(n - 1)).toBeLessThan(widthAt(0))
  })

  it('every strip has steps + 1 frames with offsets 0 to 1', () => {
    const steps = 10
    const strips = genieKeyframes(from, to, 4, steps)
    for (const frames of strips) {
      expect(frames).toHaveLength(steps + 1)
      frames.forEach((f, k) => expect(f.offset).toBeCloseTo(k / steps, 9))
    }
  })

  it('an icon above the window still ends inside the icon', () => {
    const above: Box = { x: 600, y: 20, width: 64, height: 64 }
    const n = 8
    const strips = genieKeyframes(from, above, n, 10)
    strips.forEach((frames, i) => {
      const t = parse(frames[frames.length - 1].transform)
      const top = from.y + (i * from.height) / n
      const bottom = from.y + ((i + 1) * from.height) / n
      const a = map(from, t, from.x, top)
      const b = map(from, t, from.x + from.width, bottom)
      expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(above.x - 0.5)
      expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(above.x + above.width + 0.5)
      expect(Math.min(a.y, b.y)).toBeGreaterThanOrEqual(above.y - 0.5)
      expect(Math.max(a.y, b.y)).toBeLessThanOrEqual(above.y + above.height + 0.5)
    })
  })
})
