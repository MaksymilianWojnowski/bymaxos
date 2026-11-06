import { describe, expect, it } from 'vitest'
import { genieKeyframes, stripCount, type Box } from './genie'

const from: Box = { x: 100, y: 300, width: 400, height: 200 }
const below: Box = { x: 600, y: 640, width: 80, height: 60 }
const above: Box = { x: 600, y: 20, width: 64, height: 64 }
const N = 4
const STEPS = 10

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

// The strip's band in window space after the frame's transform.
function bandAt(strips: Keyframe[][], i: number, k: number, n = N) {
  const t = parse(strips[i][k].transform)
  const top = from.y + (i * from.height) / n
  const bottom = from.y + ((i + 1) * from.height) / n
  const a = map(from, t, from.x, top)
  const b = map(from, t, from.x + from.width, bottom)
  return {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.min(a.y, b.y),
    bottom: Math.max(a.y, b.y),
  }
}

// Boundary y of strip i's bottom edge and strip i+1's top edge, both in window space.
function boundaryAt(strips: Keyframe[][], i: number, k: number) {
  const b = (j: number) => {
    const t = parse(strips[j][k].transform)
    return map(from, t, from.x, from.y + ((i + 1) * from.height) / N).y
  }
  return { bottom: b(i), top: b(i + 1) }
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
    const strips = genieKeyframes(from, below, N, STEPS)
    for (const frames of strips) {
      expect(frames[0].transform).toBe('translate(0px, 0px) scale(1, 1)')
    }
  })

  it.each([
    ['icon below', below],
    ['icon above', above],
  ])('the last frame of every strip is the exact icon band (%s)', (_, to) => {
    const strips = genieKeyframes(from, to, N, STEPS)
    strips.forEach((frames, i) => {
      const band = bandAt(strips, i, frames.length - 1)
      expect(band.top).toBeCloseTo(to.y + (i * to.height) / N, 0)
      expect(band.bottom - band.top).toBeCloseTo(to.height / N, 0)
      expect(band.left).toBeCloseTo(to.x, 0)
      expect(band.right).toBeCloseTo(to.x + to.width, 0)
    })
  })

  it.each([
    ['icon below', below],
    ['icon above', above],
  ])('strips stay contiguous at every frame (%s)', (_, to) => {
    const strips = genieKeyframes(from, to, N, STEPS)
    for (let k = 0; k <= STEPS; k++) {
      for (let i = 0; i < N - 1; i++) {
        const { bottom, top } = boundaryAt(strips, i, k)
        expect(Math.abs(bottom - top)).toBeLessThanOrEqual(0.01)
      }
    }
  })

  it.each([
    ['icon below', below],
    ['icon above', above],
  ])('a middle frame moves every strip partway (%s)', (_, to) => {
    const strips = genieKeyframes(from, to, N, STEPS)
    const mid = STEPS / 2
    strips.forEach((_frames, i) => {
      const start = from.y + (i * from.height) / N
      const end = to.y + (i * to.height) / N
      const { top } = bandAt(strips, i, mid)
      expect(top).toBeGreaterThan(Math.min(start, end))
      expect(top).toBeLessThan(Math.max(start, end))
    })
  })

  it('bottom strips move first', () => {
    const strips = genieKeyframes(from, below, N, STEPS)
    const mid = 5
    const widthAt = (i: number) => {
      const band = bandAt(strips, i, mid)
      return band.right - band.left
    }
    // Width shrinks from 400 towards 80, so a smaller width means more progress.
    expect(widthAt(N - 1)).toBeLessThan(widthAt(0))
  })

  it('every strip has steps + 1 frames with offsets 0 to 1', () => {
    const strips = genieKeyframes(from, below, N, STEPS)
    for (const frames of strips) {
      expect(frames).toHaveLength(STEPS + 1)
      frames.forEach((f, k) => expect(f.offset).toBeCloseTo(k / STEPS, 9))
    }
  })

  it('zero-size input gives identity frames, and steps 0 is treated as 1', () => {
    const flat: Box = { x: 0, y: 0, width: 0, height: 10 }
    const degenerate = genieKeyframes(flat, below, 2, 0)
    expect(degenerate).toHaveLength(2)
    for (const frames of degenerate) {
      expect(frames).toHaveLength(2)
      for (const f of frames) expect(f.transform).toBe('translate(0px, 0px) scale(1, 1)')
    }
  })
})
