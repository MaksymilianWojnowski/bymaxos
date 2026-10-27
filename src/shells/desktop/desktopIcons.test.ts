import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, safeStorage } from '../../system/storage'
import {
  cellToPx,
  defaultPositions,
  loadIconPositions,
  placeIcon,
  pxToCell,
  stepInColumn,
} from './desktopIcons'

const area = { x: 0, y: 24, w: 1440, h: 792 }

beforeEach(() => {
  window.localStorage.clear()
})

describe('desktop icon grid', () => {
  it('stacks default positions down column 0', () => {
    expect(defaultPositions(['a', 'b'])).toEqual({ a: { col: 0, row: 0 }, b: { col: 0, row: 1 } })
  })

  it('maps a cell to its top-left pixel from the right edge of the work area', () => {
    expect(cellToPx({ col: 0, row: 0 }, area)).toEqual({ x: 1440 - 12 - 96, y: 36 })
    expect(pxToCell(1332, 36, area)).toEqual({ col: 0, row: 0 })
  })

  it('moves an icon dropped on an occupied cell to the next free row of that column', () => {
    const pos = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 }, c: { col: 0, row: 2 } }
    const next = placeIcon(pos, 'a', { col: 0, row: 1 }, area)
    expect(next.a).toEqual({ col: 0, row: 3 })
    expect(next.b).toEqual({ col: 0, row: 1 })
  })

  it('keeps stored positions for known ids and drops unknown ones', () => {
    safeStorage.set('local', KEYS.icons, { a: { col: 2, row: 1 }, ghost: { col: 0, row: 0 } })
    expect(loadIconPositions(['a'])).toEqual({ a: { col: 2, row: 1 } })
  })

  it('falls back to defaults when stored data is garbage', () => {
    window.localStorage.setItem(KEYS.icons, '[1,2]')
    expect(loadIconPositions(['a', 'b'])).toEqual(defaultPositions(['a', 'b']))
    window.localStorage.setItem(KEYS.icons, '{not json')
    expect(loadIconPositions(['a', 'b'])).toEqual(defaultPositions(['a', 'b']))
  })
})

describe('stepInColumn', () => {
  it('walks the column top to bottom and stops at its ends', () => {
    const pos = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 }, c: { col: 1, row: 0 } }
    const ids = ['a', 'b', 'c']
    expect(stepInColumn(pos, ids, null, 1)).toBe('a')
    expect(stepInColumn(pos, ids, 'a', 1)).toBe('b')
    expect(stepInColumn(pos, ids, 'b', 1)).toBe('b')
    expect(stepInColumn(pos, ids, 'b', -1)).toBe('a')
  })
})
