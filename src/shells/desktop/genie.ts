export interface Box { x: number; y: number; width: number; height: number }

export const GENIE_MS = 450

const MAX_NODES = 5000
const MAX_STRIPS = 32
const MIN_STRIPS = 8
// Strips scale inversely with DOM size so large windows stay within the frame budget.
const STRIP_BUDGET = 40000

export function stripCount(nodeCount: number): number | null {
  if (nodeCount > MAX_NODES) return null
  return Math.min(MAX_STRIPS, Math.max(MIN_STRIPS, Math.floor(STRIP_BUDGET / nodeCount)))
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

export function genieKeyframes(from: Box, to: Box, strips: number, steps: number): Keyframe[][] {
  const bandH = from.height / strips
  const iconBandH = to.height / strips
  const fromCx = from.x + from.width / 2
  const toCx = to.x + to.width / 2
  const result: Keyframe[][] = []

  for (let i = 0; i < strips; i++) {
    const delay = 0.4 * (1 - (i + 0.5) / strips)
    const originTop = from.y + i * bandH
    const targetTop = to.y + i * iconBandH
    const frames: Keyframe[] = []

    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const e = easeInOut(clamp01((t - delay) / (1 - delay)))
      const width = from.width + (to.width - from.width) * e
      const left = fromCx + (toCx - fromCx) * e - width / 2
      const sx = width / from.width
      const sy = (bandH + (iconBandH - bandH) * e) / bandH
      const top = originTop + (targetTop - originTop) * e
      // Local y of a strip's band top is i * bandH, so the scaled band must be shifted back to `top`.
      const tx = left - from.x
      const ty = top - from.y - sy * i * bandH
      frames.push({
        offset: t,
        transform: `translate(${round3(tx)}px, ${round3(ty)}px) scale(${round3(sx)}, ${round3(sy)})`,
      })
    }
    result.push(frames)
  }
  return result
}
