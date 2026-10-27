import { afterEach, describe, expect, it } from 'vitest'
import type { MenuContext } from '../types'
import { finderMenus, finderViews } from './menus'

const ctx = (id: string): MenuContext => ({
  focused: { id, appId: 'finder', title: 'Desktop', rect: { x: 0, y: 0, w: 1, h: 1 }, mode: 'normal', z: 1 },
  windows: [],
  keyboardLocked: false,
})

afterEach(() => {
  finderViews.clear()
})

describe('finderMenus', () => {
  it('checks the view the focused Finder window shows', () => {
    finderViews.set('w1', 'list')
    const items = finderMenus(ctx('w1')).find((m) => m.id === 'view')?.items ?? []
    expect(items).toEqual([
      expect.objectContaining({ label: 'as Icons', checked: false }),
      expect.objectContaining({ label: 'as List', checked: true }),
    ])
  })

  it('defaults to icons for a window without a published view', () => {
    const items = finderMenus(ctx('unknown')).find((m) => m.id === 'view')?.items ?? []
    expect(items).toEqual([
      expect.objectContaining({ label: 'as Icons', checked: true }),
      expect.objectContaining({ label: 'as List', checked: false }),
    ])
  })
})
