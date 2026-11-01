// Past the edge the content lags the finger, like a rubber band.
export function rubberBand(offset: number, dimension: number, c = 0.55): number {
  return (1 - 1 / ((offset * c) / dimension + 1)) * dimension
}

// dy and velocity are upward-positive (px, px/ms): a drag past 30% of the height, or a flick of at least 5%.
export function shouldUnlock(dy: number, height: number, velocity: number): boolean {
  if (dy <= 0) return false
  return dy >= height * 0.3 || (velocity >= 0.5 && dy >= height * 0.05)
}

export interface Sample {
  y: number
  t: number
}

const WINDOW_MS = 100
const STALE_MS = 80

// Upward velocity (px/ms) over the trailing WINDOW_MS of samples. A finger that stopped before lifting has no flick.
export function releaseVelocity(samples: Sample[], releaseT: number): number {
  const last = samples[samples.length - 1]
  if (!last || releaseT - last.t > STALE_MS) return 0
  const first = samples.find((s) => last.t - s.t <= WINDOW_MS) ?? last
  const dt = last.t - first.t
  return dt > 0 ? (first.y - last.y) / dt : 0
}
