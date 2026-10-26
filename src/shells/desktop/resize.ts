import type { Rect, Size } from '../../system/types'

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// The edge opposite the dragged one stays put; the origin only moves when a north or west edge hits the minimum.
export function resizeRect(start: Rect, dir: ResizeDir, dx: number, dy: number, min: Size): Rect {
  let { x, y, w, h } = start
  if (dir.includes('e')) w = Math.max(min.w, start.w + dx)
  if (dir.includes('s')) h = Math.max(min.h, start.h + dy)
  if (dir.includes('w')) {
    w = Math.max(min.w, start.w - dx)
    x = start.x + (start.w - w)
  }
  if (dir.includes('n')) {
    h = Math.max(min.h, start.h - dy)
    y = start.y + (start.h - h)
  }
  return { x, y, w, h }
}
