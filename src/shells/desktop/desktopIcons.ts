import { KEYS, safeStorage } from '../../system/storage'
import type { Rect } from '../../system/types'

// col 0 is the rightmost column, as on macOS, so the default stack hugs the right edge.
export interface Cell {
  col: number
  row: number
}

export const CELL = { w: 96, h: 100, pad: 12 }

const gridSize = (area: Rect) => ({
  cols: Math.max(1, Math.floor((area.w - CELL.pad) / CELL.w)),
  rows: Math.max(1, Math.floor((area.h - CELL.pad) / CELL.h)),
})

// Keeps a cell inside the grid, e.g. after the viewport shrank below where an icon was saved.
export function clampCell(c: Cell, area: Rect): Cell {
  const { cols, rows } = gridSize(area)
  return {
    col: Math.min(Math.max(0, c.col), cols - 1),
    row: Math.min(Math.max(0, c.row), rows - 1),
  }
}

export function defaultPositions(ids: string[]): Record<string, Cell> {
  return Object.fromEntries(ids.map((id, row) => [id, { col: 0, row }]))
}

export function cellToPx(c: Cell, area: Rect): { x: number; y: number } {
  return {
    x: area.x + area.w - CELL.pad - (c.col + 1) * CELL.w,
    y: area.y + CELL.pad + c.row * CELL.h,
  }
}

// Nearest cell to the icon's top-left corner.
export function pxToCell(x: number, y: number, area: Rect): Cell {
  const col = Math.round((area.x + area.w - CELL.pad - CELL.w - x) / CELL.w)
  const row = Math.round((y - area.y - CELL.pad) / CELL.h)
  return clampCell({ col, row }, area)
}

// A dropped icon takes the target cell; if another icon holds it, the next free row of that column,
// then the next column. A full grid leaves the icon where it was.
export function placeIcon(
  pos: Record<string, Cell>,
  id: string,
  target: Cell,
  area: Rect,
): Record<string, Cell> {
  const { cols, rows } = gridSize(area)
  const key = (c: Cell) => `${c.col}:${c.row}`
  const taken = new Set(Object.entries(pos).filter(([other]) => other !== id).map(([, c]) => key(c)))
  for (let col = target.col; col < cols; col++) {
    for (let row = col === target.col ? target.row : 0; row < rows; row++) {
      if (!taken.has(key({ col, row }))) return { ...pos, [id]: { col, row } }
    }
  }
  return pos
}

// Arrow keys walk one column, top to bottom, as the desktop has a single column by default.
export function stepInColumn(
  pos: Record<string, Cell>,
  ids: string[],
  current: string | null,
  dir: 1 | -1,
): string | undefined {
  const col = current === null ? 0 : pos[current].col
  const column = ids
    .filter((id) => pos[id].col === col)
    .sort((a, b) => pos[a].row - pos[b].row)
  if (current === null) return dir === 1 ? column[0] : column[column.length - 1]
  const index = column.indexOf(current) + dir
  return column[Math.min(column.length - 1, Math.max(0, index))]
}

const isCell = (value: unknown): value is Cell =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as Cell).col) &&
  (value as Cell).col >= 0 &&
  Number.isInteger((value as Cell).row) &&
  (value as Cell).row >= 0

// Unknown ids are dropped and missing ones fall back to the default stack, so stale storage cannot hide icons.
export function loadIconPositions(ids: string[]): Record<string, Cell> {
  const positions = defaultPositions(ids)
  const stored = safeStorage.get<unknown>('local', KEYS.icons, null)
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return positions
  const saved = stored as Record<string, unknown>
  for (const id of ids) {
    const cell = saved[id]
    if (isCell(cell)) positions[id] = { col: cell.col, row: cell.row }
  }
  return positions
}
