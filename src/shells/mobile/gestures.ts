// Past the edge the content lags the finger, like a rubber band.
export function rubberBand(offset: number, dimension: number, c = 0.55): number {
  return (1 - 1 / ((offset * c) / dimension + 1)) * dimension
}

// dy and velocity are upward-positive (px, px/ms): a drag past 30% of the height, or a flick of at least 5%.
export function shouldUnlock(dy: number, height: number, velocity: number): boolean {
  if (dy <= 0) return false
  return dy >= height * 0.3 || (velocity >= 0.5 && dy >= height * 0.05)
}
