export interface Box { x: number; y: number; width: number; height: number }

export const GENIE_MS = 450

const MAX_NODES = 5000
const MAX_STRIPS = 32
const MIN_STRIPS = 8
// Strips scale inversely with DOM size so large windows stay within the frame budget.
const STRIP_BUDGET = 40000
const IDENTITY = 'translate(0px, 0px) scale(1, 1)'

export function stripCount(nodeCount: number): number | null {
  if (nodeCount > MAX_NODES) return null
  return Math.min(MAX_STRIPS, Math.max(MIN_STRIPS, Math.floor(STRIP_BUDGET / nodeCount)))
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000
// 3 decimals on sy would leave seams up to 0.0005 * band height, over 0.01px on tall windows.
const round6 = (v: number) => Math.round(v * 1e6) / 1e6
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Eased progress of an element whose motion starts at `delay`.
function progress(t: number, delay: number): number {
  return easeInOut(clamp01((t - delay) / (1 - delay)))
}

export function genieKeyframes(from: Box, to: Box, strips: number, steps: number): Keyframe[][] {
  const frameCount = Math.max(1, steps)
  const degenerate = from.width <= 0 || from.height <= 0
  const bandH = from.height / strips
  const iconBandH = to.height / strips
  const fromCx = from.x + from.width / 2
  const toCx = to.x + to.width / 2
  const result: Keyframe[][] = []

  for (let i = 0; i < strips; i++) {
    const frames: Keyframe[] = []
    for (let k = 0; k <= frameCount; k++) {
      const t = k / frameCount
      if (degenerate) {
        frames.push({ offset: t, transform: IDENTITY })
        continue
      }
      // Boundary edges are shared by neighbouring strips, so they stay contiguous at every frame.
      const edge = (j: number) =>
        lerp(from.y + j * bandH, to.y + j * iconBandH, progress(t, 0.4 * (1 - j / strips)))
      const e = progress(t, 0.4 * (1 - (i + 0.5) / strips))
      // sx and sy are rounded first; tx and ty are derived from the rounded values.
      const sx = round6(lerp(from.width, to.width, e) / from.width)
      const sy = round6((edge(i + 1) - edge(i)) / bandH)
      const left = lerp(fromCx, toCx, e) - (sx * from.width) / 2
      const tx = round3(left - from.x)
      const ty = round3(edge(i) - from.y - sy * i * bandH)
      frames.push({ offset: t, transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})` })
    }
    result.push(frames)
  }
  return result
}
